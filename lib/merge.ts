import { toPaise } from "./money";
import type { Expense, RawExpense } from "./types";

function overlaps(a: number[], b: number[]): boolean {
  return a.some((id) => b.includes(id));
}

function mapExpense(raw: RawExpense, participants: string[]): Expense | null {
  if (!participants.includes(raw.payer)) return null;

  const amountPaise = toPaise(raw.amount);
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) return null;

  const splitAmong = [
    ...new Set(
      raw.splitAmong
        .flatMap((name) =>
          name.trim().toUpperCase() === "ALL" ? participants : [name.trim()],
        )
        .filter((name) => participants.includes(name)),
    ),
  ];

  return {
    id: crypto.randomUUID(),
    payer: raw.payer,
    amountPaise,
    description: raw.description.trim() || "Expense",
    category: raw.category,
    splitAmong,
    sourceMessageIds: raw.sourceMessageIds,
    confidence: raw.confidence,
  };
}

/**
 * Combine chunk results: apply corrections, drop duplicates from the chunk
 * overlap, then convert rupees to paise and "ALL" to the participant list.
 */
export function mergeExpenses(
  expenses: RawExpense[],
  participants: string[],
): Expense[] {
  const replacedIds = new Set(
    expenses.flatMap((expense) =>
      expense.replacesMessageId === null ? [] : [expense.replacesMessageId],
    ),
  );

  const corrected = expenses.filter(
    (expense) =>
      expense.replacesMessageId !== null ||
      !overlaps(expense.sourceMessageIds, [...replacedIds]),
  );

  const unique: RawExpense[] = [];
  for (const expense of corrected) {
    const duplicate = unique.some(
      (kept) =>
        kept.payer === expense.payer &&
        kept.amount === expense.amount &&
        overlaps(kept.sourceMessageIds, expense.sourceMessageIds),
    );
    if (!duplicate) unique.push(expense);
  }

  return unique.flatMap((expense) => {
    const mapped = mapExpense(expense, participants);
    return mapped ? [mapped] : [];
  });
}
