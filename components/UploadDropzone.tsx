"use client";

import { useRef, useState, type DragEvent } from "react";
import JSZip from "jszip";
import { ExpenseTable } from "@/components/ExpenseTable";
import { ParticipantEditor } from "@/components/ParticipantEditor";
import { SettleUpCard } from "@/components/SettleUpCard";
import { Button } from "@/components/ui/button";
import { chunkMessages } from "@/lib/chunk";
import { mergeExpenses } from "@/lib/merge";
import { parseChat } from "@/lib/parser";
import { canRemovePerson, removePerson, renamePerson } from "@/lib/people";
import { prefilter } from "@/lib/prefilter";
import type { Expense, Message, RawExpense } from "@/lib/types";

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
  const [people, setPeople] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const [chunkList, setChunkList] = useState<Message[][]>([]);
  const [rawByChunk, setRawByChunk] = useState<Record<number, RawExpense[]>>({});
  const [failedChunks, setFailedChunks] = useState<number[]>([]);

  function resetExtraction() {
    setExpenses(null);
    setExtractError(null);
    setProgress(null);
    setSampleLoaded(false);
    setChunkList([]);
    setRawByChunk({});
    setFailedChunks([]);
  }

  function parseRaw(raw: string, fileName: string) {
    const { messages, senders } = parseChat(raw);
    if (messages.length === 0) {
      throw new Error("No messages found. Is this a WhatsApp chat export?");
    }
    resetExtraction();
    setParsed({ fileName, messages, senders });
    setPeople(senders);
  }

  async function runChunks(
    chunks: Message[][],
    indexes: number[],
    existing: Record<number, RawExpense[]>,
  ) {
    if (!parsed) return;

    const raw = { ...existing };
    const failed: number[] = [];
    const retrying = indexes.length !== chunks.length;

    setExtracting(true);
    setExtractError(null);

    for (let position = 0; position < indexes.length; position += 1) {
      const chunkIndex = indexes[position];
      setProgress(
        retrying
          ? `Retrying… ${position + 1}/${indexes.length}`
          : `Reading chat… ${chunkIndex + 1}/${chunks.length}`,
      );

      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participants: people,
            messages: chunks[chunkIndex],
          }),
        });
        if (!response.ok) throw new Error("Extraction request failed");

        const data = (await response.json()) as {
          expenses: RawExpense[];
          error: boolean;
        };
        if (data.error) throw new Error("Extraction failed");
        raw[chunkIndex] = data.expenses;
      } catch {
        failed.push(chunkIndex);
      }
    }

    setRawByChunk(raw);
    setFailedChunks(failed);
    setExpenses(mergeExpenses(Object.values(raw).flat(), people));
    if (failed.length > 0) {
      setExtractError(
        "Too many people splitting bills right now 😅 Try again in a minute",
      );
    }
    setExtracting(false);
    setProgress(null);
  }

  async function findExpenses() {
    if (!parsed || extracting) return;

    const chunks = chunkMessages(prefilter(parsed.messages));
    setChunkList(chunks);
    setRawByChunk({});
    setFailedChunks([]);
    setExpenses(null);
    setExtractError(null);

    if (chunks.length === 0) {
      setExpenses([]);
      return;
    }

    await runChunks(chunks, chunks.map((_, index) => index), {});
  }

  function retryFailed() {
    if (!parsed || extracting || failedChunks.length === 0) return;
    void runChunks(chunkList, failedChunks, rawByChunk);
  }

  async function loadFile(file: File) {
    setLoading(true);
    setError(null);
    setParsed(null);
    resetExtraction();
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
    resetExtraction();
    try {
      // The saved sample never calls the API, so the demo cannot be rate-limited.
      const [chatResponse, resultResponse] = await Promise.all([
        fetch("/sample-chat.txt"),
        fetch("/sample-result.json"),
      ]);
      if (!chatResponse.ok || !resultResponse.ok) {
        throw new Error(
          "The saved sample isn't available yet. Run npm run regen-sample.",
        );
      }

      const { messages, senders } = parseChat(await chatResponse.text());
      if (messages.length === 0) {
        throw new Error("Could not read the sample chat.");
      }

      const saved = (await resultResponse.json()) as { expenses?: Expense[] };
      if (!Array.isArray(saved.expenses)) {
        throw new Error("The saved sample file is invalid.");
      }

      setParsed({ fileName: "sample-chat.txt", messages, senders });
      setPeople(senders);
      setExpenses(saved.expenses);
      setSampleLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the sample chat.");
    } finally {
      setLoading(false);
    }
  }

  function handleRename(from: string, to: string) {
    if (!parsed) return;
    const result = renamePerson(people, expenses ?? [], parsed.messages, from, to);
    setPeople(result.people);
    setParsed({ ...parsed, messages: result.messages });
    if (expenses) setExpenses(result.expenses);
  }

  function handleRemove(person: string) {
    const result = removePerson(people, expenses ?? [], person);
    setPeople(result.people);
    if (expenses) setExpenses(result.expenses);
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
          <ParticipantEditor
            people={people}
            canRemove={(person) => canRemovePerson(expenses ?? [], person)}
            onRename={handleRename}
            onAdd={(name) => setPeople([...people, name])}
            onRemove={handleRemove}
          />

          {sampleLoaded ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Saved sample result loaded — no API calls.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={findExpenses} disabled={extracting} size="lg">
                {extracting ? "Reading chat…" : "Find expenses"}
              </Button>
              {progress && (
                <span className="text-sm text-muted-foreground">{progress}</span>
              )}
            </div>
          )}
        </div>
      )}

      {extractError && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">
            {extractError}
          </p>
          {failedChunks.length > 0 && (
            <Button variant="outline" size="sm" onClick={retryFailed} disabled={extracting}>
              Retry
            </Button>
          )}
        </div>
      )}

      {expenses && parsed && (
        <>
          <ExpenseTable
            expenses={expenses}
            people={people}
            messages={parsed.messages}
            onChange={setExpenses}
          />
          <SettleUpCard expenses={expenses} people={people} />
        </>
      )}
    </section>
  );
}
