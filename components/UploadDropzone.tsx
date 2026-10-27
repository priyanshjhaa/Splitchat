"use client";

import { useRef, useState, type DragEvent } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { parseChat } from "@/lib/parser";
import type { Message } from "@/lib/types";

type ParsedChat = {
  fileName: string;
  messages: Message[];
  senders: string[];
};

async function readChatFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) return file.text();

  if (name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const entry = Object.values(zip.files).find(
      (item) => !item.dir && item.name.toLowerCase().endsWith(".txt"),
    );
    if (!entry) throw new Error("That zip has no .txt chat file inside.");
    return entry.async("string");
  }

  throw new Error("Please upload a .txt or .zip chat export.");
}

export function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedChat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  function parseRaw(raw: string, fileName: string) {
    const { messages, senders } = parseChat(raw);
    if (messages.length === 0) {
      throw new Error("No messages found. Is this a WhatsApp chat export?");
    }
    setParsed({ fileName, messages, senders });
  }

  async function loadFile(file: File) {
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      parseRaw(await readChatFile(file), file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that file.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSample() {
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const response = await fetch("/sample-chat.txt");
      if (!response.ok) throw new Error("Could not load the sample chat.");
      parseRaw(await response.text(), "sample-chat.txt");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the sample chat.");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void loadFile(file);
  }

  return (
    <section className="mt-10">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-foreground bg-muted" : "border-border"
        }`}
      >
        <p className="font-medium">Drop your WhatsApp export here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          .txt or .zip (iOS exports are zips)
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".txt,.zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadFile(file);
            event.target.value = "";
          }}
        />

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            size="lg"
          >
            {loading ? "Reading…" : "Choose file"}
          </Button>
          <Button variant="outline" size="lg" onClick={loadSample} disabled={loading}>
            Try sample chat
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {parsed && (
        <div className="mt-6 rounded-xl border bg-card p-5">
          <p className="font-medium">
            {parsed.messages.length} messages from {parsed.senders.length} people
          </p>
          <p className="text-sm text-muted-foreground">{parsed.fileName}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {parsed.senders.map((sender) => (
              <li
                key={sender}
                className="rounded-full bg-muted px-3 py-1 text-sm text-foreground"
              >
                {sender}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
