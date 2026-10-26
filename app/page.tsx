export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-xl">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Open source · MIT
        </p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          SplitChat
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Turn a messy WhatsApp group chat into a clean trip summary and a
          settle-up plan.
        </p>

        <div className="mt-10 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          <p>
            Upload a chat export, review the expenses we find, and see who owes
            whom — with the fewest transfers.
          </p>
          <p className="mt-3">
            Your chat never leaves this session. We don&apos;t store anything.
          </p>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Built with Next.js and open models.
        </p>
      </div>
    </main>
  );
}