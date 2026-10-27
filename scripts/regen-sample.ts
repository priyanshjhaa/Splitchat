import { readFileSync, writeFileSync } from "node:fs";
import { chunkMessages } from "../lib/chunk";
import { extractExpenses } from "../lib/llm";
import { mergeExpenses } from "../lib/merge";
import { parseChat } from "../lib/parser";
import { prefilter } from "../lib/prefilter";
import type { RawExpense } from "../lib/types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // .env.local wins over .env; shell env wins over both.
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // File may not exist.
    }
  }

  const chat = readFileSync(
    new URL("../public/sample-chat.txt", import.meta.url),
    "utf8",
  );
  const { messages, senders } = parseChat(chat);
  const chunks = chunkMessages(prefilter(messages));

  const collected: RawExpense[] = [];
  let totalTokens = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const result = await extractExpenses(chunks[index], senders);
    collected.push(...result.expenses);
    totalTokens += result.totalTokens;
    console.log(
      `Chunk ${index + 1}/${chunks.length}: ${result.expenses.length} expenses via ${result.modelUsed} (${result.totalTokens} tokens)`,
    );

    if (index < chunks.length - 1) await sleep(25_000);
  }

  const expenses = mergeExpenses(collected, senders).map((expense, index) => ({
    ...expense,
    id: `sample-${index + 1}`,
  }));

  const resultUrl = new URL("../public/sample-result.json", import.meta.url);
  let summary: unknown = null;
  try {
    const current = JSON.parse(readFileSync(resultUrl, "utf8")) as {
      summary?: unknown;
    };
    summary = current.summary ?? null;
  } catch {
    // First run: there is no existing sample result.
  }

  writeFileSync(
    resultUrl,
    `${JSON.stringify({ expenses, summary }, null, 2)}\n`,
  );

  console.log(
    `Wrote ${expenses.length} expenses to public/sample-result.json (${totalTokens} tokens)`,
  );
}

void main().catch((error: unknown) => {
  console.error(
    `Regenerating the sample failed: ${error instanceof Error ? error.name : "unknown error"}`,
  );
  process.exitCode = 1;
});
