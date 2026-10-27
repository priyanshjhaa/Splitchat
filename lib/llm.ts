import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { z } from "zod";
import type { Message, RawExpense } from "./types";

export const SYSTEM_PROMPT = `You extract shared expenses from a WhatsApp group chat about a trip or outing.
Messages may be in English, Hindi or Hinglish.

Participants (use EXACTLY these names): {{participants}}

Return JSON: {"expenses": [ ... ]}. Each expense:
{
  "payer": one participant name,
  "amount": number in rupees (convert "2k" -> 2000, "1.5k" -> 1500),
  "description": short, e.g. "Petrol", "Hotel (2 nights)",
  "category": "food" | "travel" | "stay" | "activities" | "shopping" | "other",
  "splitAmong": list of participant names, or ["ALL"] if shared by everyone or unclear,
  "sourceMessageIds": ids of the messages this came from,
  "replacesMessageId": id of an earlier message this corrects, or null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- Only include money that was actually PAID, not plans, quotes or prices being discussed
  ("hotel is 4k per night?" is NOT an expense; "booked the hotel, paid 8k" IS).
- The payer is usually the sender when they say "I paid"/"maine diya". If they say someone else paid, use that person.
- If someone paid for one specific person ("I paid Sneha's ticket"), splitAmong is just that person.
- Ignore numbers that are not money: times, room numbers, counts of people, dates, phone numbers.
- If a message corrects an earlier amount, output the corrected expense and set replacesMessageId.
- Do NOT calculate who owes whom.
- If there are no expenses, return {"expenses": []}.`;

const rawExpenseSchema = z.object({
  payer: z.string(),
  amount: z.coerce.number().finite(),
  description: z.string(),
  category: z.enum([
    "food",
    "travel",
    "stay",
    "activities",
    "shopping",
    "other",
  ]),
  splitAmong: z.array(z.string()),
  sourceMessageIds: z.array(z.coerce.number().int()),
  replacesMessageId: z.coerce.number().int().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

const extractSchema = z.object({
  expenses: z.array(rawExpenseSchema),
});

type ExtractData = z.infer<typeof extractSchema>;

type LlmRequest<T> = {
  messages: ChatCompletionMessageParam[];
  schema: z.ZodType<T>;
};

type ModelFailureKind =
  | "rate-limit"
  | "timeout"
  | "server"
  | "network"
  | "api"
  | "invalid-output";

class ModelFailure extends Error {
  kind: ModelFailureKind;

  constructor(kind: ModelFailureKind) {
    super(kind);
    this.name = "ModelFailure";
    this.kind = kind;
  }
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;

  const baseURL = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  if (!baseURL || !apiKey) throw new Error("LLM is not configured");

  // maxRetries: 0 keeps the fallback rules in this file authoritative.
  client = new OpenAI({ baseURL, apiKey, timeout: 20_000, maxRetries: 0 });
  return client;
}

function parseModels(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

export function getExtractModels(): string[] {
  return parseModels(process.env.LLM_EXTRACT_MODELS);
}

function reasoningEffort(model: string): "none" | "low" | undefined {
  if (model.includes("gpt-oss")) return "low";
  if (model.includes("qwen")) return "none";
  return undefined;
}

async function complete(
  model: string,
  messages: ChatCompletionMessageParam[],
): Promise<{ content: string; totalTokens: number }> {
  const params: ChatCompletionCreateParamsNonStreaming = {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages,
  };

  const effort = reasoningEffort(model);
  if (effort) params.reasoning_effort = effort;

  const completion = await getClient().chat.completions.create(params);

  return {
    content: completion.choices[0]?.message?.content ?? "",
    totalTokens: completion.usage?.total_tokens ?? 0,
  };
}

function parseJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function failureKind(error: unknown): ModelFailureKind {
  if (error instanceof OpenAI.APIConnectionTimeoutError) return "timeout";
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) return "rate-limit";
    if (typeof error.status === "number" && error.status >= 500) return "server";
    return "api";
  }
  return "network";
}

function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof OpenAI.APIError)) return null;
  const value = error.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callModel<T>(
  model: string,
  request: LlmRequest<T>,
): Promise<{ data: T; totalTokens: number }> {
  let conversation = request.messages;
  let totalTokens = 0;
  let retriedRateLimit = false;
  let retriedInvalid = false;

  while (true) {
    let response: { content: string; totalTokens: number };

    try {
      response = await complete(model, conversation);
    } catch (error) {
      const kind = failureKind(error);

      if (kind === "rate-limit" && !retriedRateLimit) {
        const wait = retryAfterSeconds(error);
        if (wait !== null && wait <= 5) {
          retriedRateLimit = true;
          await sleep(wait * 1000);
          continue;
        }
      }

      throw new ModelFailure(kind);
    }

    totalTokens += response.totalTokens;

    let parsedData: T | undefined;
    let issue = "response was not valid JSON";

    try {
      const parsed = request.schema.safeParse(parseJson(response.content));
      if (parsed.success) {
        parsedData = parsed.data;
      } else {
        issue = parsed.error.issues
          .map((item) => `${item.path.join(".")}: ${item.message}`)
          .join("; ");
      }
    } catch {
      issue = "response was not valid JSON";
    }

    if (parsedData !== undefined) return { data: parsedData, totalTokens };
    if (retriedInvalid) throw new ModelFailure("invalid-output");

    retriedInvalid = true;
    conversation = [
      ...conversation,
      ...(response.content
        ? [{ role: "assistant" as const, content: response.content }]
        : []),
      {
        role: "user",
        content: `Your previous output was invalid: ${issue}. Return only the JSON object described above.`,
      },
    ];
  }
}

export async function callWithFallback<T>(
  models: string[],
  request: LlmRequest<T>,
): Promise<{ data: T; modelUsed: string; totalTokens: number }> {
  for (const model of models) {
    try {
      const { data, totalTokens } = await callModel(model, request);
      return { data, modelUsed: model, totalTokens };
    } catch (error) {
      const type = error instanceof ModelFailure ? error.kind : "unknown";
      console.warn(`[llm] ${model} failed: ${type}`);
    }
  }

  throw new Error("All models failed");
}

function formatMessages(messages: Message[]): string {
  return messages
    .map((message) => `[${message.id}] ${message.sender}: ${message.text}`)
    .join("\n");
}

function extractRequest(
  messages: Message[],
  participants: string[],
): LlmRequest<ExtractData> {
  return {
    schema: extractSchema,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT.replace(
          "{{participants}}",
          participants.join(", "),
        ),
      },
      { role: "user", content: formatMessages(messages) },
    ],
  };
}

function normalizeExpenses(data: ExtractData): RawExpense[] {
  return data.expenses.map((expense) => ({
    payer: expense.payer,
    amount: expense.amount,
    description: expense.description,
    category: expense.category,
    splitAmong: expense.splitAmong,
    sourceMessageIds: expense.sourceMessageIds,
    replacesMessageId: expense.replacesMessageId ?? null,
    confidence: expense.confidence,
  }));
}

export async function extractExpenses(
  messages: Message[],
  participants: string[],
): Promise<{
  expenses: RawExpense[];
  modelUsed: string;
  totalTokens: number;
}> {
  const models = getExtractModels();
  if (models.length === 0) throw new Error("No extract models configured");

  const result = await callWithFallback(
    models,
    extractRequest(messages, participants),
  );

  return {
    expenses: normalizeExpenses(result.data),
    modelUsed: result.modelUsed,
    totalTokens: result.totalTokens,
  };
}

/** One model only; used by the model comparison script. */
export async function extractWithModel(
  model: string,
  messages: Message[],
  participants: string[],
): Promise<{ expenses: RawExpense[]; totalTokens: number }> {
  const result = await callModel(
    model,
    extractRequest(messages, participants),
  );

  return {
    expenses: normalizeExpenses(result.data),
    totalTokens: result.totalTokens,
  };
}
