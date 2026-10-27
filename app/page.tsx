import Link from "next/link";
import { Receipt } from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Receipt className="size-4" />
            </span>
            SplitChat
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

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Your chat never leaves this session. Nothing is stored. Built with open
        models for #OpenFire.
      </footer>
    </>
  );
}
