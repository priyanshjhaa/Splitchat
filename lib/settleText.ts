import { formatPaise } from "./money";
import type { Transfer } from "./types";

/** Copy-for-WhatsApp text. Built from the settle results, never by an LLM. */
export function settleUpMessage(
  transfers: Transfer[],
  totalPaise: number,
  title = "Trip",
): string {
  const lines = [
    `🧾 ${title} — Settle up (via SplitChat)`,
    `Total spent: ${formatPaise(totalPaise)}`,
    "",
  ];

  if (transfers.length === 0) {
    lines.push("Everyone is even. Nobody owes anything 🎉");
  } else {
    for (const transfer of transfers) {
      lines.push(
        `${transfer.from} pays ${transfer.to} ${formatPaise(transfer.amountPaise)}`,
      );
    }
  }

  return lines.join("\n");
}
