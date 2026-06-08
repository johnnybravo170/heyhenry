/**
 * Property Record 404 / expired link. Server-rendered, no client JS — a calm
 * branded message on the same Paper field as the artifact, with the quiet
 * "Powered by HeyHenry" mark. Links don't expire on their own, but a fresh
 * slug is minted whenever the record is reset — so we point the reader back
 * to their contractor for the current link rather than dead-ending.
 */

import { Unlink } from 'lucide-react';

export default function PropertyRecordNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-center">
      <div className="grid size-20 place-items-center rounded-2xl border bg-card text-muted-foreground">
        <Unlink className="size-9" aria-hidden />
      </div>
      <p className="mt-6 font-mono text-xs font-bold uppercase tracking-[0.18em] text-brand">
        Property Record
      </p>
      <h1 className="mt-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
        We can&apos;t find this record.
      </h1>
      <p className="mt-3.5 max-w-md text-base leading-relaxed text-foreground/90">
        This link isn&apos;t valid — it may have been replaced by a newer version, or the project
        was reset by your contractor.
      </p>
      <div className="mt-7 w-full max-w-md rounded-xl border bg-paper-soft px-5 py-4 text-left">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground">
          What to do
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
          Check the most recent email or text from your contractor for an updated link, or reply to
          ask them for a fresh one. Property Record links don&apos;t expire on their own — but a new
          one is issued whenever the record is regenerated.
        </p>
      </div>
      <p className="mt-10 font-mono text-xs uppercase tracking-wide text-muted-foreground/70">
        Powered by <span className="font-semibold text-muted-foreground">HeyHenry</span>
      </p>
    </div>
  );
}
