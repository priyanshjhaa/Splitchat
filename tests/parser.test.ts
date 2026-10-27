import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChat } from "../lib/parser";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

describe("parseChat — Android", () => {
  const { messages, senders } = parseChat(fixture("android.txt"));

  it("parses messages and detects senders", () => {
    expect(messages).toHaveLength(7);
    expect(senders).toEqual(["Rahul", "Priya", "Aman", "Sneha"]);
  });

  it("converts timestamps to ISO and 12-hour times to 24-hour", () => {
    expect(messages[0].timestamp).toBe("2026-10-26T21:41:00.000Z");
    expect(messages[6].timestamp).toBe("2026-10-27T08:06:00.000Z");
  });

  it("joins multi-line messages onto the previous message", () => {
    expect(messages[4].text).toBe("Shack near Baga\nbeach shack, cheap and good");
  });

  it("skips system, media and deleted messages", () => {
    const everything = messages.map((message) => message.text).join("\n");
    expect(everything).not.toMatch(/end-to-end encrypted/);
    expect(everything).not.toMatch(/Media omitted/);
    expect(everything).not.toMatch(/added Sneha/);
    expect(everything).not.toMatch(/deleted/);
  });

  it("numbers messages by their index", () => {
    expect(messages.map((message) => message.id)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
  });
});

describe("parseChat — iOS", () => {
  it("skips iOS deleted messages that end with a period", () => {
    const { messages } = parseChat(
      "\u200e[06/10/26, 7:45:30\u202fPM] Dev: Uber 380 split\r\n" +
        "\u200e[06/10/26, 7:46:00\u202fPM] Meera: \u200eThis message was deleted.\r\n",
    );
    expect(messages.map((message) => message.text)).toEqual(["Uber 380 split"]);
  });

  const { messages, senders } = parseChat(fixture("ios.txt"));

  it("parses bracket timestamps with seconds", () => {
    expect(messages).toHaveLength(5);
    expect(messages[0].timestamp).toBe("2026-10-26T21:41:05.000Z");
    expect(senders).toEqual(["Rahul", "Priya", "Karan"]);
  });

  it("strips the left-to-right mark and narrow no-break space", () => {
    const raw =
      "\u200E[26/10/26, 9:41:05\u202FPM] Rahul: hello\u200E\n" +
      "\u200E[26/10/26, 9:42:00\u202FPM] Priya: hi";

    const result = parseChat(raw);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].text).toBe("hello");
    expect(result.messages[0].timestamp).toBe("2026-10-26T21:41:05.000Z");
    expect(result.messages[1].timestamp).toBe("2026-10-26T21:42:00.000Z");
  });
});

describe("parseChat — dates and times", () => {
  it("detects dd/mm when the first number is over 12", () => {
    const { messages } = parseChat("13/02/26, 10:00 am - A: hello");
    expect(messages[0].timestamp).toBe("2026-02-13T10:00:00.000Z");
  });

  it("detects mm/dd when the second number is over 12", () => {
    const { messages } = parseChat("02/13/26, 10:00 am - A: hello");
    expect(messages[0].timestamp).toBe("2026-02-13T10:00:00.000Z");
  });

  it("defaults ambiguous dates to dd/mm", () => {
    const { messages } = parseChat("02/03/26, 10:00 am - A: hello");
    expect(messages[0].timestamp).toBe("2026-03-02T10:00:00.000Z");
  });

  it("supports 24-hour times", () => {
    const { messages } = parseChat("26/10/26, 21:41 - A: hello");
    expect(messages[0].timestamp).toBe("2026-10-26T21:41:00.000Z");
  });

  it("handles 12 am and 12 pm", () => {
    expect(parseChat("26/10/26, 12:05 am - A: late").messages[0].timestamp).toBe(
      "2026-10-26T00:05:00.000Z",
    );
    expect(parseChat("26/10/26, 12:05 pm - A: lunch").messages[0].timestamp).toBe(
      "2026-10-26T12:05:00.000Z",
    );
  });

  it("returns nothing for a file without messages", () => {
    const result = parseChat("not a whatsapp chat\njust some text");
    expect(result.messages).toEqual([]);
    expect(result.senders).toEqual([]);
  });
});

describe("parseChat — sample chat", () => {
  const sample = readFileSync(
    new URL("../public/sample-chat.txt", import.meta.url),
    "utf8",
  );
  const { messages, senders } = parseChat(sample);

  it("detects all five friends in order", () => {
    expect(senders).toEqual(["Rahul", "Priya", "Aman", "Sneha", "Karan"]);
  });

  it("keeps a realistic number of messages", () => {
    expect(messages.length).toBeGreaterThanOrEqual(120);
    expect(messages.length).toBeLessThanOrEqual(150);
  });

  it("drops media and deleted lines", () => {
    for (const message of messages) {
      expect(message.text).not.toMatch(/^<media omitted>$/i);
      expect(message.text).not.toMatch(/^this message was deleted$/i);
    }
  });
});
