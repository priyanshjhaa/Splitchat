import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { extractExpenses } from "../lib/llm";
import type { Message } from "../lib/types";

const messages: Message[] = [
  {
    id: 0,
    timestamp: "2026-10-24T09:07:00.000Z",
    sender: "Rahul",
    text: "I paid 600 for the cab",
  },
];

const calls = new Map<string, number>();
const requests: Array<{ model: string; reasoning_effort?: string }> = [];
let server: Server;

function validPayload() {
  return {
    id: "completion-1",
    object: "chat.completion",
    created: 0,
    model: "mock",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify({
            expenses: [
              {
                payer: "Rahul",
                amount: 600,
                description: "Cab",
                category: "travel",
                splitAmong: ["ALL"],
                sourceMessageIds: [0],
                replacesMessageId: null,
                confidence: "high",
              },
            ],
          }),
        },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  };
}

beforeAll(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as { model: string; reasoning_effort?: string };
      const count = (calls.get(parsed.model) ?? 0) + 1;
      calls.set(parsed.model, count);
      requests.push(parsed);

      if (parsed.model.includes("bad")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            ...validPayload(),
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "not json" },
                finish_reason: "stop",
              },
            ],
          }),
        );
        return;
      }

      if (parsed.model.includes("invalid-once") && count === 1) {
        const payload = validPayload();
        payload.choices[0].message.content = "not json";
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(payload));
        return;
      }

      if (parsed.model.includes("429-long") && count === 1) {
        response.writeHead(429, {
          "content-type": "application/json",
          "retry-after": "30",
        });
        response.end(JSON.stringify({ error: { message: "rate limited" } }));
        return;
      }

      if (parsed.model.includes("429") && count === 1) {
        response.writeHead(429, {
          "content-type": "application/json",
          "retry-after": "0",
        });
        response.end(JSON.stringify({ error: { message: "rate limited" } }));
        return;
      }

      if (parsed.model.includes("500") && count === 1) {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "server error" } }));
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(validPayload()));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;
  process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.LLM_API_KEY = "test-key";
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  calls.clear();
  requests.length = 0;
});

describe("callWithFallback (via extractExpenses)", () => {
  it("retries invalid JSON once on the same model", async () => {
    process.env.LLM_EXTRACT_MODELS = "qwen/mock-invalid-once";

    const result = await extractExpenses(messages, ["Rahul", "Priya"]);

    expect(result.modelUsed).toBe("qwen/mock-invalid-once");
    expect(result.expenses).toHaveLength(1);
    expect(calls.get("qwen/mock-invalid-once")).toBe(2);
  });

  it("moves to the next model after a second invalid output", async () => {
    process.env.LLM_EXTRACT_MODELS = "qwen/mock-bad,openai/mock-ok";

    const result = await extractExpenses(messages, ["Rahul", "Priya"]);

    expect(result.modelUsed).toBe("openai/mock-ok");
    expect(calls.get("qwen/mock-bad")).toBe(2);
    expect(calls.get("openai/mock-ok")).toBe(1);
  });

  it("sends reasoning_effort per model family", async () => {
    process.env.LLM_EXTRACT_MODELS = "qwen/mock,openai/mock";

    await extractExpenses(messages, ["Rahul", "Priya"]);
    expect(requests[0].reasoning_effort).toBe("none");

    calls.clear();
    requests.length = 0;
    process.env.LLM_EXTRACT_MODELS = "openai/gpt-oss-mock";

    await extractExpenses(messages, ["Rahul", "Priya"]);
    expect(requests[0].reasoning_effort).toBe("low");
  });

  it("waits and retries a 429 when retry-after is 5s or less", async () => {
    process.env.LLM_EXTRACT_MODELS = "qwen/mock-429";

    const result = await extractExpenses(messages, ["Rahul", "Priya"]);

    expect(result.modelUsed).toBe("qwen/mock-429");
    expect(calls.get("qwen/mock-429")).toBe(2);
  });

  it("moves to the next model when retry-after is long", async () => {
    process.env.LLM_EXTRACT_MODELS = "qwen/mock-429-long,openai/mock-ok";

    const result = await extractExpenses(messages, ["Rahul", "Priya"]);

    expect(result.modelUsed).toBe("openai/mock-ok");
    expect(calls.get("qwen/mock-429-long")).toBe(1);
  });

  it("moves to the next model on a 5xx", async () => {
    process.env.LLM_EXTRACT_MODELS = "qwen/mock-500,openai/mock-ok";

    const result = await extractExpenses(messages, ["Rahul", "Priya"]);

    expect(result.modelUsed).toBe("openai/mock-ok");
    expect(calls.get("qwen/mock-500")).toBe(1);
  });

  it("throws a clear error when every model fails", async () => {
    process.env.LLM_EXTRACT_MODELS = "qwen/mock-bad";

    await expect(extractExpenses(messages, ["Rahul", "Priya"])).rejects.toThrow(
      "All models failed",
    );
  });
});
