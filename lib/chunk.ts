import type { Message } from "./types";

/** ~50 messages per chunk with a 3-message overlap for context. */
export function chunkMessages(
  messages: Message[],
  size = 50,
  overlap = 3,
): Message[][] {
  const step = Math.max(1, size - overlap);
  const chunks: Message[][] = [];

  for (let start = 0; start < messages.length; start += step) {
    chunks.push(messages.slice(start, start + size));
    if (start + size >= messages.length) break;
  }

  return chunks;
}
