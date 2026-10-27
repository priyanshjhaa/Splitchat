import type { Expense, Message } from "./types";

function swap(name: string, from: string, to: string): string {
  return name === from ? to : name;
}

/**
 * Rename a person everywhere. Renaming to a name that already exists merges
 * the two people (e.g. "+91 98xxx" → "Rahul").
 */
export function renamePerson(
  people: string[],
  expenses: Expense[],
  messages: Message[],
  from: string,
  to: string,
): { people: string[]; expenses: Expense[]; messages: Message[] } {
  return {
    people: [...new Set(people.map((person) => swap(person, from, to)))],
    expenses: expenses.map((expense) => ({
      ...expense,
      payer: swap(expense.payer, from, to),
      splitAmong: [
        ...new Set(expense.splitAmong.map((person) => swap(person, from, to))),
      ],
    })),
    messages: messages.map((message) => ({
      ...message,
      sender: swap(message.sender, from, to),
    })),
  };
}

/** A person who paid for something can't be removed until that row changes. */
export function canRemovePerson(expenses: Expense[], person: string): boolean {
  return !expenses.some((expense) => expense.payer === person);
}

export function removePerson(
  people: string[],
  expenses: Expense[],
  person: string,
): { people: string[]; expenses: Expense[] } {
  return {
    people: people.filter((name) => name !== person),
    expenses: expenses.map((expense) => ({
      ...expense,
      splitAmong: expense.splitAmong.filter((name) => name !== person),
    })),
  };
}
