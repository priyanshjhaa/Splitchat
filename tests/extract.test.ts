import { describe, expect, it } from "vitest";
import { chunkMessages } from "../lib/chunk";
import { mergeExpenses } from "../lib/merge";
import { prefilter } from "../lib/prefilter";
import type { Message, RawExpense } from "../lib/types";

function message(id: number, text: string): Message {
  return { id, timestamp: "2026-10-26T10:00:00.000Z", sender: "Rahul", text };
}

function raw(overrides: Partial<RawExpense> = {}): RawExpense {
  return {
    payer: "Rahul",
    amount: 1000,
    description: "Test",
    category: "other",
    splitAmong: ["Rahul", "Priya"],
    sourceMessageIds: [1],
    replacesMessageId: null,
    confidence: "high",
    ...overrides,
  };
}

const participants = ["Rahul", "Priya", "Aman", "Sneha"];

describe("prefilter", () => {
  const messages = [
    message(0, "hello"),
    message(1, "Guys Goa ka plan"),
    message(2, "I paid 2k for petrol"),
    message(3, "nice"),
    message(4, "reach by 7"),
    message(5, "bill bhej do"),
    message(6, "ok"),
  ];

  it("keeps money messages and their neighbours", () => {
    expect(prefilter(messages).map((item) => item.id)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("matches amount and money-word hints", () => {
    for (const text of [
      "₹600 cab",
      "paid rs 450/-",
      "inr 700",
      "1.5k diya",
      "kharcha likh le",
      "cash diya",
      "total kitna?",
      "split karte hain",
      "it was 650",
    ]) {
      expect(prefilter([message(0, text)])).toHaveLength(1);
    }
  });

  it("drops messages with no money signal", () => {
    expect(prefilter([message(0, "hello"), message(1, "sunset dekhne chalo")])).toEqual(
      [],
    );
  });

  it("returns nothing for an empty chat", () => {
    expect(prefilter([])).toEqual([]);
  });
});

describe("chunkMessages", () => {
  const messages = Array.from({ length: 250 }, (_, index) => message(index, "hi"));

  it("splits into ~50-message chunks", () => {
    const chunks = chunkMessages(messages);

    expect(chunks).toHaveLength(6);
    expect(chunks[0]).toHaveLength(50);
    expect(chunks[5]).toHaveLength(15);
  });

  it("overlaps consecutive chunks by three messages", () => {
    const chunks = chunkMessages(messages);

    expect(chunks[0][47].id).toBe(chunks[1][0].id);
    expect(chunks[1][47].id).toBe(chunks[2][0].id);
  });

  it("keeps short chats as a single chunk", () => {
    expect(chunkMessages(messages.slice(0, 20))).toHaveLength(1);
  });

  it("returns nothing for an empty chat", () => {
    expect(chunkMessages([])).toEqual([]);
  });
});

describe("mergeExpenses", () => {
  it("de-duplicates the same expense from overlapping chunks", () => {
    const merged = mergeExpenses(
      [
        raw({ sourceMessageIds: [10, 11] }),
        raw({ sourceMessageIds: [11, 12] }),
      ],
      participants,
    );

    expect(merged).toHaveLength(1);
  });

  it("keeps expenses that only share a payer and amount but no message", () => {
    const merged = mergeExpenses(
      [
        raw({ sourceMessageIds: [10] }),
        raw({ sourceMessageIds: [20] }),
      ],
      participants,
    );

    expect(merged).toHaveLength(2);
  });

  it("keeps different payers or amounts", () => {
    const merged = mergeExpenses(
      [
        raw({ payer: "Rahul", sourceMessageIds: [10] }),
        raw({ payer: "Priya", sourceMessageIds: [10] }),
        raw({ amount: 500, sourceMessageIds: [10] }),
      ],
      participants,
    );

    expect(merged).toHaveLength(3);
  });

  it("replaces the corrected expense", () => {
    const merged = mergeExpenses(
      [
        raw({ amount: 600, sourceMessageIds: [10] }),
        raw({
          amount: 650,
          sourceMessageIds: [12],
          replacesMessageId: 10,
        }),
      ],
      participants,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].amountPaise).toBe(65_000);
    expect(merged[0]).not.toHaveProperty("replacesMessageId");
  });

  it("keeps a correction even if its source overlaps the replaced message", () => {
    const merged = mergeExpenses(
      [
        raw({ amount: 600, sourceMessageIds: [10] }),
        raw({
          amount: 650,
          sourceMessageIds: [10, 12],
          replacesMessageId: 10,
        }),
      ],
      participants,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].amountPaise).toBe(65_000);
  });

  it("maps ALL to every participant", () => {
    const merged = mergeExpenses(
      [raw({ splitAmong: ["ALL"], sourceMessageIds: [1] })],
      participants,
    );

    expect(merged[0].splitAmong).toEqual(participants);
  });

  it("converts rupees to integer paise", () => {
    const merged = mergeExpenses(
      [raw({ amount: 1234.56, sourceMessageIds: [1] })],
      participants,
    );

    expect(merged[0].amountPaise).toBe(123_456);
  });

  it("drops expenses with an unknown payer", () => {
    const merged = mergeExpenses(
      [raw({ payer: "Ghost", sourceMessageIds: [1] })],
      participants,
    );

    expect(merged).toEqual([]);
  });

  it("filters unknown names out of the split", () => {
    const merged = mergeExpenses(
      [raw({ splitAmong: ["Rahul", "Ghost"], sourceMessageIds: [1] })],
      participants,
    );

    expect(merged[0].splitAmong).toEqual(["Rahul"]);
  });
});
