"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { Avatar } from "@/components/Avatar";
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
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="bg-primary px-5 py-5 text-primary-foreground">
        <p className="text-sm opacity-90">Total trip spend</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatPaise(total)}
        </p>
        <p className="mt-1 text-sm opacity-90">
          {transfers.length === 0
            ? "Everyone is even"
            : transfers.length === 1 ? "1 payment settles everything" : `${transfers.length} payments settle everything`}
        </p>
      </div>

      <div className="p-5">
        <h2 className="font-semibold">Settle up</h2>

        {skipped > 0 && (
          <p className="mt-1 text-xs text-destructive">
            {skipped} incomplete {skipped === 1 ? "row isn't" : "rows aren't"}{" "}
            counted yet.
          </p>
        )}

        {transfers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nobody owes anything 🎉
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {transfers.map((transfer) => (
              <li
                key={`${transfer.from}-${transfer.to}`}
                className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
              >
                <Avatar name={transfer.from} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{transfer.from}</span>
                  <ArrowRight className="mx-1 inline size-3.5 text-muted-foreground" />
                  <span className="font-medium">{transfer.to}</span>
                </span>
                <span className="shrink-0 font-semibold text-primary tabular-nums">
                  {formatPaise(transfer.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Button
          size="lg"
          className="mt-4 h-10 w-full"
          onClick={copy}
          disabled={valid.length === 0}
        >
          {copied === "copied" ? <Check /> : <Copy />}
          {copied === "copied"
            ? "Copied, paste it in the group"
            : copied === "failed"
              ? "Couldn't copy"
              : "Copy for WhatsApp"}
        </Button>

        <h3 className="mt-6 text-sm font-semibold">Balances</h3>
        <ul className="mt-2 space-y-2.5">
          {people.map((person) => {
            const amount = balances[person] ?? 0;
            return (
              <li key={person} className="flex items-center gap-3">
                <Avatar name={person} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {person}
                </span>
                <span className="text-right text-sm tabular-nums">
                  {amount > 0 ? (
                    <>
                      <span className="block text-[11px] text-muted-foreground">
                        gets back
                      </span>
                      <span className="font-semibold text-primary">
                        {formatPaise(amount)}
                      </span>
                    </>
                  ) : amount < 0 ? (
                    <>
                      <span className="block text-[11px] text-muted-foreground">
                        owes
                      </span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {formatPaise(-amount)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">settled up</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
