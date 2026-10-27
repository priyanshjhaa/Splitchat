import Link from "next/link";
import { Receipt } from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";

export default function Home() {
  return (
    <div className="grain flex min-h-full flex-1 flex-col">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-700 text-white shadow-md shadow-emerald-700/30">
              <Receipt className="size-4" />
            </span>
            <span className="text-lg tracking-tight">
              Split<span className="font-display text-xl italic">Chat</span>
            </span>
          </Link>
          <a
            href="https://github.com/priyanshjhaa/Splitchat"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            GitHub · MIT
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <UploadDropzone />
      </main>

      <footer className="border-t border-white/60 py-6 text-center text-xs text-muted-foreground">
        Your chat never leaves this session. Nothing is stored. Built with open
        models for #OpenFire.
      </footer>
    </div>
  );
}
