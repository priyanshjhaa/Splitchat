import { UploadDropzone } from "@/components/UploadDropzone";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
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

        <UploadDropzone />

        <p className="mt-8 text-xs text-muted-foreground">
          Your chat never leaves this session. We don&apos;t store anything.
        </p>
      </div>
    </main>
  );
}