import type { Message } from "./types";

type DateOrder = "dmy" | "mdy";

type Header = {
  first: number;
  second: number;
  year: number;
  hour: number;
  minute: number;
  secondOfMinute: number;
  meridiem?: string;
  rest: string;
};

// Groups: 1 first date part, 2 second date part, 3 year, 4 hour, 5 minute,
// 6 seconds, 7 am/pm, 8 the rest of the line.
const DATE_TIME = String.raw`(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?`;

const ANDROID_HEADER = new RegExp(String.raw`^${DATE_TIME}\s*[-–]\s?(.*)$`, "i");
const IOS_HEADER = new RegExp(String.raw`^\[${DATE_TIME}\]\s?(.*)$`, "i");

// <Media omitted>, image/video/... omitted, deleted messages and literal "null".
const SKIPPED_TEXT =
  /^(?:<media omitted>|(?:image|video|audio|sticker|gif|document) omitted|this message was deleted|you deleted this message|null)$/i;

function normalizeRaw(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    // Zero-width and direction marks, including the iOS left-to-right mark.
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "")
    // Narrow no-break space (before AM/PM in iOS) and regular no-break space.
    .replace(/[\u202F\u00A0]/g, " ");
}

function matchHeader(line: string): Header | null {
  const match = ANDROID_HEADER.exec(line) ?? IOS_HEADER.exec(line);
  if (!match) return null;

  return {
    first: Number(match[1]),
    second: Number(match[2]),
    year: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    secondOfMinute: match[6] ? Number(match[6]) : 0,
    meridiem: match[7]?.toLowerCase().replace(/\./g, ""),
    rest: match[8],
  };
}

function detectDateOrder(headers: Header[]): DateOrder {
  const firstOver12 = headers.some((header) => header.first > 12);
  const secondOver12 = headers.some((header) => header.second > 12);
  return !firstOver12 && secondOver12 ? "mdy" : "dmy";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIso(header: Header, order: DateOrder): string | null {
  const day = order === "dmy" ? header.first : header.second;
  const month = order === "dmy" ? header.second : header.first;
  const year = header.year < 100 ? 2000 + header.year : header.year;

  let hour = header.hour;
  if (header.meridiem) {
    hour = hour % 12;
    if (header.meridiem === "pm") hour += 12;
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    header.minute > 59 ||
    header.secondOfMinute > 59
  ) {
    return null;
  }

  // WhatsApp exports carry no timezone, so treat the local chat time as UTC.
  // This keeps timestamps deterministic across machines.
  const date = new Date(
    Date.UTC(year, month - 1, day, hour, header.minute, header.secondOfMinute),
  );
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;

  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(
    header.minute,
  )}:${pad(header.secondOfMinute)}.000Z`;
}

function splitSender(rest: string): { sender: string; text: string } | null {
  const match = /^([^:]{1,80}):\s?([\s\S]*)$/.exec(rest);
  if (!match) return null;

  const sender = match[1].trim();
  const text = match[2].trim();
  if (!sender || !text || SKIPPED_TEXT.test(text)) return null;

  return { sender, text };
}

export function parseChat(raw: string): {
  messages: Message[];
  senders: string[];
} {
  const lines = normalizeRaw(raw).split(/\r\n|\r|\n/);

  const headers: Header[] = [];
  for (const line of lines) {
    const header = matchHeader(line);
    if (header) headers.push(header);
  }
  const dateOrder = detectDateOrder(headers);

  const messages: Message[] = [];
  const senders: string[] = [];
  let pending: { timestamp: string; sender: string; text: string } | null = null;

  const flush = () => {
    if (!pending) return;
    const text = pending.text.trim();
    if (text) {
      if (!senders.includes(pending.sender)) senders.push(pending.sender);
      messages.push({ id: messages.length, ...pending, text });
    }
    pending = null;
  };

  for (const line of lines) {
    const header = matchHeader(line);

    if (!header) {
      if (pending) pending.text += `\n${line}`;
      continue;
    }

    flush();

    const timestamp = toIso(header, dateOrder);
    const parsed = splitSender(header.rest);
    // A line with no "sender: text" is a WhatsApp system message.
    if (!timestamp || !parsed) continue;

    pending = { timestamp, sender: parsed.sender, text: parsed.text };
  }

  flush();

  return { messages, senders };
}
