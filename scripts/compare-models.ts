import { readFileSync } from "node:fs";
import { chunkMessages } from "../lib/chunk";
import { extractWithModel } from "../lib/llm";
import { mergeExpenses } from "../lib/merge";
import { formatPaise } from "../lib/money";
import { parseChat } from "../lib/parser";
import { prefilter } from "../lib/prefilter";
import type { Expense, RawExpense } from "../lib/types";

type ExpectedExpense = {
  payer: string;
  amountPaise: number;
  description: string;
};

// 30s between calls keeps us well inside 8K tokens/min and 30 requests/min.
const DELAY_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function label(expense: { payer: string; amountPaise: number; description: string }) {
  return `${expense.payer} ${formatPaise(expense.amountPaise)} (${expense.description})`;
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

  const models = (process.env.LLM_EXTRACT_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  if (models.length === 0) {
    console.error("LLM_EXTRACT_MODELS is empty.");
    process.exitCode = 1;
    return;
  }

  const chat = readFileSync(
    new URL("../public/sample-chat.txt", import.meta.url),
    "utf8",
  );
  const expected = JSON.parse(
    readFileSync(
      new URL("../tests/fixtures/sample-expected.json", import.meta.url),
      "utf8",
    ),
  ) as ExpectedExpense[];

  const { messages, senders } = parseChat(chat);
  const chunks = chunkMessages(prefilter(messages));

  console.log(
    `Sample: ${messages.length} messages -> ${chunks.length} chunks; ${expected.length} expected expenses\n`,
  );

  for (const model of models) {
    console.log(`=== ${model} ===`);

    const collected: RawExpense[] = [];
    let totalTokens = 0;
    let failedCalls = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      try {
        const result = await extractWithModel(model, chunks[index], senders);
        collected.push(...result.expenses);
        totalTokens += result.totalTokens;
        console.log(
          `  chunk ${index + 1}/${chunks.length}: ${result.expenses.length} expenses, ${result.totalTokens} tokens`,
        );
      } catch (error) {
        failedCalls += 1;
        console.log(
          `  chunk ${index + 1}/${chunks.length}: failed (${error instanceof Error ? error.name : "error"})`,
        );
      }

      if (index < chunks.length - 1) await sleep(DELAY_MS);
    }

    const expenses = mergeExpenses(collected, senders);
    const used = new Set<number>();
    const falsePositives: Expense[] = [];

    for (const expense of expenses) {
      const match = expected.findIndex(
        (item, index) =>
          !used.has(index) &&
          item.payer === expense.payer &&
          item.amountPaise === expense.amountPaise,
      );

      if (match === -1) falsePositives.push(expense);
      else used.add(match);
    }

    const misses = expected.filter((_, index) => !used.has(index));

    console.log(`  expenses found: ${expenses.length}`);
    console.log(`  expected matches: ${used.size}/${expected.length}`);
    console.log(
      `  misses: ${misses.length === 0 ? "none" : misses.map(label).join("; ")}`,
    );
    console.log(
      `  false positives: ${
        falsePositives.length === 0
          ? "none"
          : falsePositives.map(label).join("; ")
      }`,
    );
    console.log(
      `  tokens: ${totalTokens}${failedCalls > 0 ? `, failed calls: ${failedCalls}` : ""}\n`,
    );

    // Delay between models too, since each model has its own minute bucket.
    if (model !== models[models.length - 1]) await sleep(DELAY_MS);
  }
}

void main().catch((error: unknown) => {
  console.error(
    `Comparison failed: ${error instanceof Error ? error.name : "unknown error"}`,
  );
  process.exitCode = 1;
});
