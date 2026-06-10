'use client';

import { ChevronRight, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function ExpenseDropzone() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push('/expenses/import')}
      className="flex w-full items-center gap-4 rounded-xl border border-dashed border-brand/40 border-l-[3px] border-l-brand bg-brand/5 px-5 py-4 text-left transition-colors hover:bg-brand/10"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-brand/20 bg-card text-brand">
        <Upload className="size-5" aria-hidden />
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand">
          ✦ Henry · fastest path
        </span>
        <span className="font-medium text-foreground">
          Drop receipts here. Henry reads vendor, date, amount, and GST.
        </span>
        <span className="text-xs text-muted-foreground">
          Up to 50 at once · JPG, PNG, HEIC, PDF ·{' '}
          <Link
            href="/expenses/new"
            className="font-semibold text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            or log one manually
          </Link>
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-brand" aria-hidden />
    </button>
  );
}
