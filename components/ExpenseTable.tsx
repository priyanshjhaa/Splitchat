"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPaise, toPaise } from "@/lib/money";
import type { Category, Expense, Message } from "@/lib/types";

const CATEGORIES: Category[] = [
  "food",
  "travel",
  "stay",
  "activities",
  "shopping",
  "other",
];

type Props = {
  expenses: Expense[];
  people: string[];
  messages: Message[];
  onChange: (expenses: Expense[]) => void;
};

const field =
  "h-8 rounded-lg border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50";

export function ExpenseTable({ expenses, people, messages, onChange }: Props) {
  const [openSource, setOpenSource] = useState<string | null>(null);

  function update(id: string, patch: Partial<Expense>) {
    onChange(
      expenses.map((expense) =>
        expense.id === id ? { ...expense, ...patch } : expense,
      ),
    );
  }

  function toggleSplit(expense: Expense, person: string) {
    const splitAmong = expense.splitAmong.includes(person)
      ? expense.splitAmong.filter((name) => name !== person)
      : people.filter(
          (name) => name === person || expense.splitAmong.includes(name),
        );
    update(expense.id, { splitAmong });
  }

  function addExpense() {
    onChange([
      ...expenses,
      {
        id: crypto.randomUUID(),
        payer: people[0] ?? "",
        amountPaise: 0,
        description: "",
        category: "other",
        splitAmong: [...people],
        sourceMessageIds: [],
        confidence: "high",
      },
    ]);
  }

  const total = expenses.reduce((sum, expense) => sum + expense.amountPaise, 0);

  return (
    <div className="mt-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {expenses.length} {expenses.length === 1 ? "expense" : "expenses"} ·{" "}
          {formatPaise(total)}
        </p>
        <p className="text-xs text-muted-foreground">
          Check each row. Fix anything the AI got wrong.
        </p>
      </div>

      {expenses.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          No expenses found. Add them manually.
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {expenses.map((expense) => {
          const invalid =
            expense.amountPaise <= 0 || expense.splitAmong.length === 0;
          const sources = messages.filter((message) =>
            expense.sourceMessageIds.includes(message.id),
          );

          return (
            <li
              key={expense.id}
              className={`rounded-lg border p-3 ${
                expense.confidence === "low"
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
                  : ""
              }`}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_8rem_9rem_7rem_auto]">
                <input
                  value={expense.description}
                  onChange={(event) =>
                    update(expense.id, { description: event.target.value })
                  }
                  placeholder="What was it?"
                  className={`${field} col-span-2 sm:col-span-1`}
                  aria-label="Description"
                />
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={expense.amountPaise ? expense.amountPaise / 100 : ""}
                  onChange={(event) =>
                    update(expense.id, {
                      amountPaise: Math.max(0, toPaise(Number(event.target.value) || 0)),
                    })
                  }
                  placeholder="₹"
                  className={field}
                  aria-label="Amount in rupees"
                />
                <select
                  value={expense.payer}
                  onChange={(event) =>
                    update(expense.id, { payer: event.target.value })
                  }
                  className={field}
                  aria-label="Paid by"
                >
                  {people.map((person) => (
                    <option key={person} value={person}>
                      {person} paid
                    </option>
                  ))}
                </select>
                <select
                  value={expense.category}
                  onChange={(event) =>
                    update(expense.id, {
                      category: event.target.value as Category,
                    })
                  }
                  className={field}
                  aria-label="Category"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  onClick={() =>
                    onChange(expenses.filter((item) => item.id !== expense.id))
                  }
                  aria-label="Delete expense"
                >
                  Delete
                </Button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Split:</span>
                <button
                  type="button"
                  onClick={() => update(expense.id, { splitAmong: [...people] })}
                  className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                >
                  Everyone
                </button>
                {people.map((person) => {
                  const on = expense.splitAmong.includes(person);
                  return (
                    <button
                      key={person}
                      type="button"
                      onClick={() => toggleSplit(expense, person)}
                      aria-pressed={on}
                      className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                        on
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {person}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {expense.confidence === "low" && (
                  <span className="text-amber-700 dark:text-amber-400">
                    AI wasn&apos;t sure about this one
                  </span>
                )}
                {invalid && (
                  <span className="text-destructive">
                    Needs an amount and at least one person to split with
                  </span>
                )}
                {sources.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSource(openSource === expense.id ? null : expense.id)
                    }
                    className="text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {openSource === expense.id ? "Hide" : "Show"} message
                  </button>
                )}
              </div>

              {openSource === expense.id && (
                <ul className="mt-2 space-y-1 rounded-md bg-muted p-2 text-xs">
                  {sources.map((message) => (
                    <li key={message.id}>
                      <span className="font-medium">{message.sender}:</span>{" "}
                      {message.text}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <Button variant="outline" className="mt-3" onClick={addExpense}>
        + Add expense
      </Button>
    </div>
  );
}
