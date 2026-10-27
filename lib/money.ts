const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,234 (Indian grouping), with paise only when they are non-zero. */
export function formatPaise(amountPaise: number): string {
  const sign = amountPaise < 0 ? "-" : "";
  const absolute = Math.abs(amountPaise);
  const wholeRupees = Math.floor(absolute / 100);
  const paise = absolute % 100;

  if (paise === 0) return `${sign}₹${rupees.format(wholeRupees)}`;
  return `${sign}₹${rupees.format(wholeRupees)}.${String(paise).padStart(2, "0")}`;
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
