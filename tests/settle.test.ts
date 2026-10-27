import { describe, expect, it } from "vitest";
import { formatPaise, toPaise } from "../lib/money";
import { computeBalances, settle } from "../lib/settle";
import type { Expense } from "../lib/types";

function expense(
  overrides: Pick<Expense, "payer" | "amountPaise" | "splitAmong">,
): Expense {
  return {
    id: "e1",
    description: "test",
    category: "other",
    sourceMessageIds: [],
    confidence: "high",
    ...overrides,
  };
}

const people = ["Rahul", "Priya", "Aman", "Sneha"];

describe("computeBalances", () => {
  it("handles a simple two-person expense", () => {
    const balances = computeBalances(
      [
        expense({
          payer: "Rahul",
          amountPaise: 100_000,
          splitAmong: ["Rahul", "Priya"],
        }),
      ],
      ["Rahul", "Priya"],
    );

    expect(balances).toEqual({ Rahul: 50_000, Priya: -50_000 });
    expect(settle(balances)).toEqual([
      { from: "Priya", to: "Rahul", amountPaise: 50_000 },
    ]);
  });

  it("handles a four-person expense", () => {
    const balances = computeBalances(
      [expense({ payer: "Rahul", amountPaise: 400_000, splitAmong: people })],
      people,
    );

    expect(balances).toEqual({
      Rahul: 300_000,
      Priya: -100_000,
      Aman: -100_000,
      Sneha: -100_000,
    });

    expect(settle(balances)).toEqual([
      { from: "Aman", to: "Rahul", amountPaise: 100_000 },
      { from: "Priya", to: "Rahul", amountPaise: 100_000 },
      { from: "Sneha", to: "Rahul", amountPaise: 100_000 },
    ]);
  });

  it("handles a subset split", () => {
    const balances = computeBalances(
      [
        expense({
          payer: "Sneha",
          amountPaise: 80_000,
          splitAmong: ["Sneha", "Aman"],
        }),
      ],
      people,
    );

    expect(balances).toEqual({ Rahul: 0, Priya: 0, Aman: -40_000, Sneha: 40_000 });
    expect(settle(balances)).toEqual([
      { from: "Aman", to: "Sneha", amountPaise: 40_000 },
    ]);
  });

  it("splits uneven paise exactly (₹100 among 3)", () => {
    const balances = computeBalances(
      [expense({ payer: "A", amountPaise: 10_000, splitAmong: ["A", "B", "C"] })],
      ["A", "B", "C"],
    );

    // A's share is 3334 (the leftover paise goes to the first person).
    expect(balances).toEqual({ A: 6_666, B: -3_333, C: -3_333 });
    expect(Object.values(balances).reduce((sum, value) => sum + value, 0)).toBe(0);
    expect(settle(balances)).toEqual([
      { from: "B", to: "A", amountPaise: 3_333 },
      { from: "C", to: "A", amountPaise: 3_333 },
    ]);
  });

  it("returns no transfers when everyone is even", () => {
    const balances = computeBalances(
      [
        expense({ payer: "A", amountPaise: 30_000, splitAmong: ["A", "B", "C"] }),
        expense({ payer: "B", amountPaise: 30_000, splitAmong: ["A", "B", "C"] }),
        expense({ payer: "C", amountPaise: 30_000, splitAmong: ["A", "B", "C"] }),
      ],
      ["A", "B", "C"],
    );

    expect(balances).toEqual({ A: 0, B: 0, C: 0 });
    expect(settle(balances)).toEqual([]);
  });

  it("keeps balances summing to zero across mixed expenses", () => {
    const balances = computeBalances(
      [
        expense({ payer: "Rahul", amountPaise: 100_000, splitAmong: people }),
        expense({ payer: "Priya", amountPaise: 50_000, splitAmong: people }),
        expense({
          payer: "Aman",
          amountPaise: 80_000,
          splitAmong: ["Aman", "Sneha"],
        }),
      ],
      people,
    );

    expect(Object.values(balances).reduce((sum, value) => sum + value, 0)).toBe(0);
  });

  it("ignores zero amounts and empty splits", () => {
    const balances = computeBalances(
      [
        expense({ payer: "Rahul", amountPaise: 0, splitAmong: ["Rahul", "Priya"] }),
        expense({ payer: "Priya", amountPaise: 10_000, splitAmong: [] }),
      ],
      ["Rahul", "Priya"],
    );

    expect(balances).toEqual({ Rahul: 0, Priya: 0 });
    expect(settle(balances)).toEqual([]);
  });
});

describe("settle", () => {
  it("returns nothing for empty or zero balances", () => {
    expect(settle({})).toEqual([]);
    expect(settle({ Rahul: 0, Priya: 0 })).toEqual([]);
  });

  it("uses at most n-1 transfers", () => {
    const balances = { A: 100_000, B: -50_000, C: -30_000, D: -20_000 };
    const transfers = settle(balances);

    expect(transfers).toHaveLength(3);
    expect(transfers.every((transfer) => transfer.amountPaise > 0)).toBe(true);
  });
});

describe("money", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatPaise(123_400)).toBe("₹1,234");
    expect(formatPaise(123_456_789)).toBe("₹12,34,567.89");
    expect(formatPaise(0)).toBe("₹0");
  });

  it("shows paise only when non-zero", () => {
    expect(formatPaise(123_456)).toBe("₹1,234.56");
    expect(formatPaise(50)).toBe("₹0.50");
    expect(formatPaise(123_400)).toBe("₹1,234");
  });

  it("handles negatives", () => {
    expect(formatPaise(-50_000)).toBe("-₹500");
  });

  it("converts rupees to integer paise", () => {
    expect(toPaise(1234.56)).toBe(123_456);
    expect(toPaise(850)).toBe(85_000);
  });
});
