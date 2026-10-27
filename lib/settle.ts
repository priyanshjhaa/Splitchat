import type { Expense, Transfer } from "./types";

/** Positive amount = gets money back, negative = owes money. */
export type Balances = Record<string, number>;

type Side = { person: string; amountPaise: number };

export function computeBalances(
  expenses: Expense[],
  people: string[],
): Balances {
  const balances: Balances = {};
  for (const person of people) balances[person] = 0;

  for (const expense of expenses) {
    // Invalid rows are surfaced in the UI instead of being settled.
    if (expense.amountPaise === 0 || expense.splitAmong.length === 0) continue;

    const count = expense.splitAmong.length;
    const base = Math.floor(expense.amountPaise / count);
    const leftover = expense.amountPaise % count;

    balances[expense.payer] =
      (balances[expense.payer] ?? 0) + expense.amountPaise;

    expense.splitAmong.forEach((person, index) => {
      // Spread leftover paise one at a time so the shares add up exactly.
      const share = base + (index < leftover ? 1 : 0);
      balances[person] = (balances[person] ?? 0) - share;
    });
  }

  return balances;
}

export function settle(balances: Balances): Transfer[] {
  const debtors: Side[] = Object.entries(balances)
    .filter(([, amount]) => amount < 0)
    .map(([person, amount]) => ({ person, amountPaise: -amount }))
    .sort((a, b) => b.amountPaise - a.amountPaise || a.person.localeCompare(b.person));

  const creditors: Side[] = Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .map(([person, amount]) => ({ person, amountPaise: amount }))
    .sort((a, b) => b.amountPaise - a.amountPaise || a.person.localeCompare(b.person));

  const transfers: Transfer[] = [];
  let debtor = 0;
  let creditor = 0;

  while (debtor < debtors.length && creditor < creditors.length) {
    // Largest debtor pays the largest creditor as much as possible.
    const amountPaise = Math.min(
      debtors[debtor].amountPaise,
      creditors[creditor].amountPaise,
    );

    transfers.push({
      from: debtors[debtor].person,
      to: creditors[creditor].person,
      amountPaise,
    });

    debtors[debtor].amountPaise -= amountPaise;
    creditors[creditor].amountPaise -= amountPaise;

    if (debtors[debtor].amountPaise === 0) debtor += 1;
    if (creditors[creditor].amountPaise === 0) creditor += 1;
  }

  return transfers;
}
