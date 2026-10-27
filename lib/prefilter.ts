import type { Message } from "./types";

const MONEY_HINT =
  /(\d|₹|\brs\.?\b|\binr\b|\b(paid|pay|diya|de diya|spent|kharcha|bill|total|split|owe|transfer|gpay|upi|cash|refund|it was)\b)/i;

export function looksLikeExpense(text: string): boolean {
  return MONEY_HINT.test(text);
}

/**
 * Keep likely-expense messages plus the message before and after each match,
 * so the model still sees what a "paid 500" line is replying to.
 */
export function prefilter(messages: Message[]): Message[] {
  const keep = new Set<number>();

  messages.forEach((message, index) => {
    if (!looksLikeExpense(message.text)) return;

    if (index > 0) keep.add(messages[index - 1].id);
    keep.add(message.id);
    if (index < messages.length - 1) keep.add(messages[index + 1].id);
  });

  return messages.filter((message) => keep.has(message.id));
}
