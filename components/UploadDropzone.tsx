"use client";

import { useRef, useState, type DragEvent } from "react";
import JSZip from "jszip";
import { ExpenseTable } from "@/components/ExpenseTable";
import { HeroDemo } from "@/components/HeroDemo";
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
      <section className="grid items-center gap-12 pt-2 lg:grid-cols-[1.1fr_0.9fr] lg:pt-10">
        <div className="text-center lg:text-left">
          <span className="fade-up glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Open source · runs on open models · nothing stored
          </span>
          <h1
            style={{ "--i": 1 } as React.CSSProperties}
            className="fade-up mt-6 text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-7xl"
          >
            Who owes whom?
            <br />
            <span className="text-shine font-display font-normal italic">
              Ask the group chat.
            </span>
          </h1>
          <p
            style={{ "--i": 2 } as React.CSSProperties}
            className="fade-up mx-auto mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0"
          >
            Drop in your WhatsApp trip chat. SplitChat finds every expense, even
            the Hinglish ones, lets you fix anything, and tells everyone exactly
            who pays whom.
          </p>

          <div
            style={{ "--i": 3 } as React.CSSProperties}
            className="fade-up ring-glow mt-9 rounded-3xl"
          >
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`rounded-3xl bg-card/90 p-6 backdrop-blur-xl transition-all sm:p-8 ${
                dragging ? "scale-[1.01] bg-emerald-50" : ""
              }`}
            >
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:text-left">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-700 text-white shadow-lg shadow-emerald-700/30">
                  <Upload className="size-5" />
                </span>
                <div className="flex-1 text-center sm:text-left">
                  <p className="font-medium">Drop your WhatsApp export here</p>
                  <p className="text-sm text-muted-foreground">
                    .txt from Android, or .zip from iPhone
                  </p>
                </div>
              </div>
              {fileInput}
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Button
                  size="lg"
                  className="btn-glow h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-95"
                  onClick={() => inputRef.current?.click()}
                  disabled={loading}
                >
                  {loading ? "Reading…" : "Choose file"}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 rounded-xl bg-background/60"
                  onClick={loadSample}
                  disabled={loading}
                >
                  <Sparkles className="text-primary" />
                  Try sample chat
                </Button>
              </div>
              {error && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </div>

          <details
            style={{ "--i": 4 } as React.CSSProperties}
            className="fade-up mt-4 text-left text-sm text-muted-foreground"
          >
            <summary className="cursor-pointer text-center hover:text-foreground lg:text-left">
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
        </div>

        <div style={{ "--i": 3 } as React.CSSProperties} className="fade-up">
          <HeroDemo />
        </div>

        <ol className="grid gap-4 text-left sm:grid-cols-3 lg:col-span-2">
          {[
            ["01", "Drop the chat", "Parsed right on your device. Nothing is stored."],
            ["02", "Check the expenses", "AI finds them. You fix anything it missed."],
            ["03", "Settle up", "Fewest payments, ready to paste in the group."],
          ].map(([step, title, text], index) => (
            <li
              key={step}
              style={{ "--i": index + 5 } as React.CSSProperties}
              className="fade-up glass group rounded-2xl p-5 transition-transform hover:-translate-y-1"
            >
              <span className="font-display text-3xl text-primary italic">{step}</span>
              <p className="mt-2 font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section>
      <div className="glass fade-up flex flex-wrap items-center gap-3 rounded-3xl p-4">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-700 text-white shadow-lg shadow-emerald-700/30">
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
          <Button
            onClick={findExpenses}
            disabled={extracting}
            className="btn-glow rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
          >
            <Sparkles />
            {extracting ? progress ?? "Reading chat…" : expenses ? "Find again" : "Find expenses"}
          </Button>
        )}
        <Button variant="outline" className="rounded-xl bg-background/60" onClick={startOver} disabled={extracting}>
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
            <div className="glass fade-up overflow-hidden rounded-3xl">
              <div className="px-5 py-5">
                <p className="font-medium">
                  {extracting ? progress ?? "Reading chat…" : "Ready when you are"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {extracting
                    ? "An open model is reading every message that mentions money."
                    : "Fix any names above, then press Find expenses."}
                </p>
              </div>
              {extracting && (
                <ul className="space-y-3 border-t border-black/5 px-5 py-4">
                  {[0, 1, 2, 3].map((row) => (
                    <li key={row} className="flex items-center gap-3">
                      <span className="shimmer size-10 rounded-xl" />
                      <span className="flex-1 space-y-2">
                        <span className="shimmer block h-3 w-2/3 rounded-full" />
                        <span className="shimmer block h-2.5 w-1/3 rounded-full" />
                      </span>
                      <span className="shimmer h-4 w-14 rounded-full" />
                    </li>
                  ))}
                </ul>
              )}
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
