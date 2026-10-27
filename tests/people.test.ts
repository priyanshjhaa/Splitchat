import { describe, expect, it } from "vitest";
import { canRemovePerson, removePerson, renamePerson } from "../lib/people";
import { settleUpMessage } from "../lib/settleText";
import type { Expense, Message } from "../lib/types";

const expense = (overrides: Partial<Expense>): Expense => ({
  id: "1",
  payer: "Rahul",
  amountPaise: 60000,
  description: "Cab",
  category: "travel",
  splitAmong: ["Rahul", "Priya"],
  sourceMessageIds: [1],
  confidence: "high",
  ...overrides,
});

const message: Message = {
  id: 1,
  timestamp: "2026-10-01T10:00:00.000Z",
  sender: "+91 98765 43210",
  text: "paid 600",
};

describe("renamePerson", () => {
  it("renames payer, split and message senders", () => {
    const result = renamePerson(
      ["Rahul", "Priya"],
      [expense({})],
      [{ ...message, sender: "Rahul" }],
      "Rahul",
      "Rahul S",
    );
    expect(result.people).toEqual(["Rahul S", "Priya"]);
    expect(result.expenses[0].payer).toBe("Rahul S");
    expect(result.expenses[0].splitAmong).toEqual(["Rahul S", "Priya"]);
    expect(result.messages[0].sender).toBe("Rahul S");
  });

  it("merges into an existing person without duplicates", () => {
    const result = renamePerson(
      ["Rahul", "+91 98765 43210", "Priya"],
      [expense({ splitAmong: ["Rahul", "+91 98765 43210"] })],
      [message],
      "+91 98765 43210",
      "Rahul",
    );
    expect(result.people).toEqual(["Rahul", "Priya"]);
    expect(result.expenses[0].splitAmong).toEqual(["Rahul"]);
    expect(result.messages[0].sender).toBe("Rahul");
  });
});

describe("removePerson", () => {
  it("blocks removing someone who paid", () => {
    expect(canRemovePerson([expense({})], "Rahul")).toBe(false);
    expect(canRemovePerson([expense({})], "Priya")).toBe(true);
  });

  it("drops the person from splits", () => {
    const result = removePerson(["Rahul", "Priya"], [expense({})], "Priya");
    expect(result.people).toEqual(["Rahul"]);
    expect(result.expenses[0].splitAmong).toEqual(["Rahul"]);
  });
});

describe("settleUpMessage", () => {
  it("lists transfers with the total", () => {
    const text = settleUpMessage(
      [{ from: "Rahul", to: "Priya", amountPaise: 85000 }],
      3845000,
      "Goa Trip",
    );
    expect(text).toBe(
      "🧾 Goa Trip — Settle up (via SplitChat)\nTotal spent: ₹38,450\n\nRahul pays Priya ₹850",
    );
  });

  it("says everyone is even when there are no transfers", () => {
    expect(settleUpMessage([], 0)).toContain("Everyone is even");
  });
});
