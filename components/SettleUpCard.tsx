"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";
import { computeBalances, settle } from "@/lib/settle";
import { settleUpMessage } from "@/lib/settleText";
import type { Expense } from "@/lib/types";

type Props = {
  expenses: Expense[];
  people: string[];
  title?: string;
};

export function SettleUpCard({ expenses, people, title }: Props) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  const valid = expenses.filter(
    (expense) => expense.amountPaise > 0 && expense.splitAmong.length > 0,
  );
  const balances = computeBalances(valid, people);
  const transfers = settle(balances);
  const total = valid.reduce((sum, expense) => sum + expense.amountPaise, 0);
  const skipped = expenses.length - valid.length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(settleUpMessage(transfers, total, title));
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2000);
  }

  return (
    <div className="mt-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Settle up</p>
          <p className="text-sm text-muted-foreground">
            Total spent {formatPaise(total)}
          </p>
        </div>
        <Button size="lg" onClick={copy} disabled={valid.length === 0}>
          {copied === "copied"
            ? "Copied ✓"
            : copied === "failed"
              ? "Couldn't copy"
              : "Copy for WhatsApp"}
        </Button>
      </div>

      {skipped > 0 && (
        <p className="mt-2 text-xs text-destructive">
          {skipped} {skipped === 1 ? "row is" : "rows are"} missing an amount or
          people and {skipped === 1 ? "isn't" : "aren't"} counted yet.
        </p>
      )}

      {transfers.length === 0 ? (
        <p className="mt-4 text-sm">Everyone is even. Nobody owes anything 🎉</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {transfers.map((transfer) => (
            <li
              key={`${transfer.from}-${transfer.to}`}
              className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
            >
              <span>
                <span className="font-medium">{transfer.from}</span>
                <span className="text-muted-foreground"> pays </span>
                <span className="font-medium">{transfer.to}</span>
              </span>
              <span className="font-semibold tabular-nums">
                {formatPaise(transfer.amountPaise)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <p className="text-sm font-medium">Balances</p>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {people.map((person) => {
            const amount = balances[person] ?? 0;
            return (
              <li key={person} className="flex justify-between gap-3">
                <span>{person}</span>
                <span
                  className={`tabular-nums ${
                    amount > 0
                      ? "text-green-600 dark:text-green-400"
                      : amount < 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {amount > 0
                    ? `gets back ${formatPaise(amount)}`
                    : amount < 0
                      ? `owes ${formatPaise(-amount)}`
                      : "even"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
