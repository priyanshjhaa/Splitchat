"use client";

import { useState } from "react";
import { ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CATEGORY_STYLE, CategoryTile } from "@/components/category";
import { Button } from "@/components/ui/button";
import { formatPaise, toPaise } from "@/lib/money";
import type { Category, Expense, Message } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_STYLE) as Category[];

type Props = {
  expenses: Expense[];
  people: string[];
  messages: Message[];
  onChange: (expenses: Expense[]) => void;
};

const field =
  "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/20";

function splitLabel(expense: Expense, people: string[]): string {
  const count = expense.splitAmong.length;
  if (count === 0) return "not split yet";
  if (count === people.length) return `split ${count} ways`;
  if (count === 1) return `for ${expense.splitAmong[0]}`;
  return `split with ${expense.splitAmong.join(", ")}`;
}

export function ExpenseTable({ expenses, people, messages, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

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
    const id = crypto.randomUUID();
    onChange([
      ...expenses,
      {
        id,
        payer: people[0] ?? "",
        amountPaise: 0,
        description: "",
        category: "other",
        splitAmong: [...people],
        sourceMessageIds: [],
        confidence: "high",
      },
    ]);
    setOpenId(id);
  }

  const total = expenses.reduce((sum, expense) => sum + expense.amountPaise, 0);
  const unsure = expenses.filter((expense) => expense.confidence === "low").length;

  return (
    <div className="glass fade-up overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Expenses</h2>
          <p className="text-sm text-muted-foreground">
            {expenses.length} found · {formatPaise(total)} total
            {unsure > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {" "}
                · {unsure} to double-check
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" className="rounded-xl bg-background/60" onClick={addExpense}>
          <Plus />
          Add expense
        </Button>
      </div>

      {expenses.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          No expenses found. Add them manually.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 border-b border-black/5 bg-gradient-to-r from-emerald-50/80 to-transparent px-5 py-2 text-xs text-emerald-900/80 dark:from-emerald-950/40 dark:text-emerald-200">
          <Sparkles className="size-3.5" /> The AI found these. Tap any row to fix it.
        </p>
      )}

      <ul className="divide-y divide-black/5">
        {expenses.map((expense, index) => {
          const open = openId === expense.id;
          const invalid =
            expense.amountPaise <= 0 || expense.splitAmong.length === 0;
          const sources = messages.filter((message) =>
            expense.sourceMessageIds.includes(message.id),
          );

          return (
            <li
              key={expense.id}
              style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
              className={`fade-up transition-colors ${open ? "bg-white/50 dark:bg-white/5" : ""}`}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : expense.id)}
                aria-expanded={open}
                className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/60 dark:hover:bg-white/5"
              >
                <span className="transition-transform group-hover:scale-110 group-hover:-rotate-3">
                  <CategoryTile category={expense.category} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {expense.description || "Untitled expense"}
                    </span>
                    {expense.confidence === "low" && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        check
                      </span>
                    )}
                    {invalid && (
                      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        incomplete
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {expense.payer} paid · {splitLabel(expense, people)}
                  </span>
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums">
                  {formatPaise(expense.amountPaise)}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              {open && (
                <div className="space-y-4 px-5 pt-1 pb-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-muted-foreground">
                      What was it?
                      <input
                        value={expense.description}
                        onChange={(event) =>
                          update(expense.id, { description: event.target.value })
                        }
                        placeholder="e.g. Dinner at Britto's"
                        className={field}
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-muted-foreground">
                      Amount (₹)
                      <input
                        type="number"
                        min={0}
                        inputMode="decimal"
                        value={expense.amountPaise ? expense.amountPaise / 100 : ""}
                        onChange={(event) =>
                          update(expense.id, {
                            amountPaise: Math.max(
                              0,
                              toPaise(Number(event.target.value) || 0),
                            ),
                          })
                        }
                        placeholder="0"
                        className={`${field} tabular-nums`}
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-muted-foreground">
                      Paid by
                      <select
                        value={expense.payer}
                        onChange={(event) =>
                          update(expense.id, { payer: event.target.value })
                        }
                        className={field}
                      >
                        {people.map((person) => (
                          <option key={person} value={person}>
                            {person}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium text-muted-foreground">
                      Category
                      <select
                        value={expense.category}
                        onChange={(event) =>
                          update(expense.id, {
                            category: event.target.value as Category,
                          })
                        }
                        className={field}
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {CATEGORY_STYLE[category].label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Split equally between
                      </p>
                      <button
                        type="button"
                        onClick={() => update(expense.id, { splitAmong: [...people] })}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Everyone
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {people.map((person) => {
                        const on = expense.splitAmong.includes(person);
                        return (
                          <button
                            key={person}
                            type="button"
                            onClick={() => toggleSplit(expense, person)}
                            aria-pressed={on}
                            className={`flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors ${
                              on
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground opacity-60 hover:opacity-100"
                            }`}
                          >
                            <Avatar name={person} size="sm" />
                            {person}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {sources.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        From the chat
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {sources.map((message) => (
                          <li
                            key={message.id}
                            className="w-fit max-w-full rounded-2xl rounded-tl-sm bg-background px-3 py-2 text-sm shadow-xs ring-1 ring-border"
                          >
                            <span className="block text-xs font-semibold text-primary">
                              {message.sender}
                            </span>
                            {message.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        onChange(expenses.filter((item) => item.id !== expense.id));
                        setOpenId(null);
                      }}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                    <Button
                      className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                      onClick={() => setOpenId(null)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
