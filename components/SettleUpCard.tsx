"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, Sparkles } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useCountUp } from "@/components/useCountUp";
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
  const shownTotal = useCountUp(total);
  const largest = Math.max(1, ...people.map((person) => Math.abs(balances[person] ?? 0)));

  async function copy() {
    try {
      await navigator.clipboard.writeText(settleUpMessage(transfers, total, title));
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2200);
  }

  return (
    <div className="space-y-4">
      <div className="card-premium fade-up rounded-3xl p-6 shadow-2xl shadow-teal-950/30">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-medium tracking-[0.2em] text-white/70 uppercase">
            Total trip spend
          </p>
          <Sparkles className="size-4 text-emerald-200" />
        </div>
        <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
          {formatPaise(shownTotal)}
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {[
            `${valid.length} expenses`,
            `${people.length} people`,
            transfers.length === 0
              ? "all even"
              : `${transfers.length} ${transfers.length === 1 ? "payment" : "payments"}`,
          ].map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-white/10 px-2.5 py-1 text-white/90 ring-1 ring-white/15 backdrop-blur"
            >
              {chip}
            </span>
          ))}
        </div>
        <p className="mt-5 font-display text-lg text-white/80 italic">
          {transfers.length === 0
            ? "Everyone’s square. Rare. Beautiful."
            : transfers.length === 1
              ? "One payment and everyone’s square."
              : `${transfers.length} payments and everyone’s square.`}
        </p>
      </div>

      <div className="glass rounded-3xl p-5">
        <h2 className="font-semibold">Settle up</h2>
        {skipped > 0 && (
          <p className="mt-1 text-xs text-destructive">
            {skipped} incomplete {skipped === 1 ? "row isn't" : "rows aren't"}{" "}
            counted yet.
          </p>
        )}

        {transfers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nobody owes anything 🎉</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {transfers.map((transfer, index) => (
              <li
                key={`${transfer.from}-${transfer.to}-${transfer.amountPaise}`}
                style={{ "--i": index } as React.CSSProperties}
                className="fade-up flex items-center gap-2.5 rounded-2xl bg-background/70 px-3 py-2.5 ring-1 ring-border transition-shadow hover:shadow-md"
              >
                <Avatar name={transfer.from} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{transfer.from}</span>
                  <ArrowRight className="mx-1.5 inline size-3.5 text-primary" />
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
          className={`btn-glow mt-4 h-11 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white transition-all hover:opacity-95 ${
            copied === "copied" ? "scale-[0.99]" : ""
          }`}
          onClick={copy}
          disabled={valid.length === 0}
        >
          {copied === "copied" ? <Check /> : <Copy />}
          {copied === "copied"
            ? "Copied! Paste it in the group"
            : copied === "failed"
              ? "Couldn't copy"
              : "Copy for WhatsApp"}
        </Button>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="font-semibold">Balances</h3>
        <ul className="mt-3 space-y-3">
          {people.map((person, index) => {
            const amount = balances[person] ?? 0;
            const width = `${Math.round((Math.abs(amount) / largest) * 100)}%`;
            return (
              <li
                key={person}
                style={{ "--i": index } as React.CSSProperties}
                className="fade-up flex items-center gap-3"
              >
                <Avatar name={person} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{person}</span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        amount > 0
                          ? "text-primary"
                          : amount < 0
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {amount > 0
                        ? `+${formatPaise(amount)}`
                        : amount < 0
                          ? `−${formatPaise(-amount)}`
                          : "settled"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      style={{ width }}
                      className={`h-full rounded-full transition-[width] duration-700 ${
                        amount >= 0
                          ? "bg-gradient-to-r from-emerald-400 to-teal-600"
                          : "bg-gradient-to-r from-amber-400 to-orange-500"
                      }`}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          + gets money back · − owes money
        </p>
      </div>
    </div>
  );
}
