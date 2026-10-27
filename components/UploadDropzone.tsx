"use client";

import { useRef, useState, type DragEvent } from "react";
import JSZip from "jszip";
import { ExpenseTable } from "@/components/ExpenseTable";
import { ParticipantEditor } from "@/components/ParticipantEditor";
import { SettleUpCard } from "@/components/SettleUpCard";
import { FileText, Sparkles, Upload } from "lucide-react";
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

  function startOver() {
    setParsed(null);
    setPeople([]);
    setError(null);
    resetExtraction();
  }

  const fileInput = (
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
  );

  if (!parsed) {
    return (
      <section className="mx-auto max-w-2xl pt-4 text-center sm:pt-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Open source · runs on open models
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Who owes whom?
          <br />
          <span className="text-primary">Ask the group chat.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
          Drop in your WhatsApp trip chat. SplitChat finds every expense, lets
          you fix anything, and tells everyone exactly who pays whom.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`mt-10 rounded-2xl border-2 border-dashed bg-card p-8 shadow-sm transition-colors sm:p-10 ${
            dragging ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="size-5" />
          </span>
          <p className="mt-4 font-medium">Drop your WhatsApp export here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            .txt from Android, or .zip from iPhone
          </p>
          {fileInput}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              size="lg"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              {loading ? "Reading…" : "Choose file"}
            </Button>
            <Button variant="outline" size="lg" onClick={loadSample} disabled={loading}>
              Try sample chat
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <details className="mx-auto mt-4 max-w-md text-left text-sm text-muted-foreground">
          <summary className="cursor-pointer text-center hover:text-foreground">
            How do I export a WhatsApp chat?
          </summary>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Open the group chat and tap the group name.</li>
            <li>
              Tap <b>Export chat</b> (Android: ⋮ → More → Export chat).
            </li>
            <li>
              Choose <b>Without media</b> and save the file.
            </li>
          </ol>
        </details>

        <ol className="mt-12 grid gap-4 text-left sm:grid-cols-3">
          {[
            ["1", "Drop the chat", "Parsed on your device. Nothing is stored."],
            ["2", "Check the expenses", "AI finds them. You fix anything it missed."],
            ["3", "Settle up", "Fewest payments, ready to paste in the group."],
          ].map(([step, title, text]) => (
            <li key={step} className="rounded-xl border bg-card p-4">
              <span className="text-xs font-semibold text-primary">Step {step}</span>
              <p className="mt-1 font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{parsed.fileName}</p>
          <p className="text-sm text-muted-foreground">
            {parsed.messages.length} messages · {people.length} people
            {sampleLoaded && " · saved sample, no API calls"}
          </p>
        </div>
        {fileInput}
        {!sampleLoaded && (
          <Button onClick={findExpenses} disabled={extracting}>
            <Sparkles />
            {extracting ? progress ?? "Reading chat…" : expenses ? "Find again" : "Find expenses"}
          </Button>
        )}
        <Button variant="outline" onClick={startOver} disabled={extracting}>
          New chat
        </Button>
      </div>

      {extractError && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p role="alert" className="flex-1 text-sm text-destructive">
            {extractError}
          </p>
          {failedChunks.length > 0 && (
            <Button variant="outline" size="sm" onClick={retryFailed} disabled={extracting}>
              Retry
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ParticipantEditor
            people={people}
            canRemove={(person) => canRemovePerson(expenses ?? [], person)}
            onRename={handleRename}
            onAdd={(name) => setPeople([...people, name])}
            onRemove={handleRemove}
          />

          {expenses ? (
            <ExpenseTable
              expenses={expenses}
              people={people}
              messages={parsed.messages}
              onChange={setExpenses}
            />
          ) : (
            <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
              <p className="font-medium">
                {extracting ? progress ?? "Reading chat…" : "Ready when you are"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {extracting
                  ? "The AI is reading the messages that mention money."
                  : "Fix any names above, then press Find expenses."}
              </p>
            </div>
          )}
        </div>

        {expenses && (
          <div className="order-first lg:sticky lg:top-20 lg:order-none">
            <SettleUpCard expenses={expenses} people={people} />
          </div>
        )}
      </div>
    </section>
  );
}
