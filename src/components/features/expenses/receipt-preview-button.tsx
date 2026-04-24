'use client';

/**
 * Receipt preview on the overhead expenses list.
 *
 * Click the paperclip/pdf icon → full-size modal of the receipt. Works
 * the same on mobile and desktop (simpler than hover-vs-tap branching;
 * Radix doesn't ship a HoverCard in this codebase and the juice isn't
 * worth adding the dep).
 *
 * Signed URLs for every row's receipt are generated server-side in one
 * batch in `listOverheadExpenses`, so this component is zero-fetch.
 */

import { FileText, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Props = {
  url: string | null;
  mimeHint: 'image' | 'pdf' | null;
  vendor: string | null;
};

export function ReceiptPreviewButton({ url, mimeHint, vendor }: Props) {
  const [open, setOpen] = useState(false);

  if (!url) return null;

  const label = vendor ? `Receipt — ${vendor}` : 'Receipt';
  const isPdf = mimeHint === 'pdf';

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        aria-label={label}
        title={label}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        {isPdf ? <FileText className="size-3.5" /> : <Paperclip className="size-3.5" />}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">{label}</DialogTitle>
          </DialogHeader>
          {isPdf ? (
            <iframe src={url} title={label} className="h-[75vh] w-full rounded-sm border" />
          ) : (
            // biome-ignore lint/performance/noImgElement: signed URL, dynamic per row
            <img src={url} alt={label} className="max-h-[75vh] w-full rounded-sm object-contain" />
          )}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:underline"
          >
            Open in new tab ↗
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
