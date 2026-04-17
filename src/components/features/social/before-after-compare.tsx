/**
 * Before/after photo comparison — side by side on desktop, stacked on mobile.
 *
 * Clean, shareable-looking layout with overlaid labels. Used inside the
 * social post preview card.
 */

'use client';

type BeforeAfterCompareProps = {
  beforeUrl: string;
  afterUrl: string;
};

export function BeforeAfterCompare({ beforeUrl, afterUrl }: BeforeAfterCompareProps) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      <div className="relative overflow-hidden rounded-lg bg-muted">
        {/* biome-ignore lint/performance/noImgElement: signed URLs bypass next/image optimizer */}
        <img src={beforeUrl} alt="Before" className="aspect-square w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white">
          Before
        </span>
      </div>
      <div className="relative overflow-hidden rounded-lg bg-muted">
        {/* biome-ignore lint/performance/noImgElement: signed URLs bypass next/image optimizer */}
        <img src={afterUrl} alt="After" className="aspect-square w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white">
          After
        </span>
      </div>
    </div>
  );
}
