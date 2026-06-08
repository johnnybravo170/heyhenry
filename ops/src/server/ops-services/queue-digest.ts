/**
 * Command Center morning digest — STRUCTURED input → email-safe HTML + a
 * plain-text alternative.
 *
 * The triage routine decides WHAT matters; this module owns HOW it looks, so
 * the digest can't drift between sends (the failure mode: the routine
 * hand-composing HTML some days and plain text others — the latter renders as
 * a monospace wall in Apple Mail). The routine now passes structured data and
 * gets back a consistent render.
 *
 * Email-safe CSS only: inline styles, a single 600px centered container, no
 * <style> block, no flexbox/grid. All interpolated text is escaped here — the
 * escape boundary is this module, not the caller.
 */

const DEFAULT_QUEUE_URL = 'https://ops.heyhenry.io/admin/queue';

// Palette is hardcoded — email clients don't honor CSS custom properties.
// Mirrors ops globals.css tokens.
const FG = '#0a0a0a';
const MUTED = '#71717a';
const BORDER = '#e4e4e7';
const CARD_BG = '#fafafa';
const CODE_BG = '#f4f4f5';
const FIRE = '#dc2626';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

export type DigestStreamCount = { label: string; count: number };
export type DigestItem = { title: string; teaser?: string };
export type DigestStream = { label: string; items: DigestItem[] };
export type DigestTopItem = {
  /** 'fire' prepends a red dot — reserve for genuinely broken-in-prod items. */
  severity?: 'fire' | 'normal';
  title: string;
  /** Markdown-lite: blank-line paragraphs, single \n → break, `code`, **bold**. */
  body: string;
};

export type QueueDigestInput = {
  /** Overrides the synthesized subject. Prefer a scannable summary like
   * "2 fires, 4 research calls, 2 stalled cards". */
  subject?: string;
  /** Short date label, e.g. "Tue May 26". */
  dateLabel?: string;
  /** Per-stream counts, rendered in the order given — keep urgency order. */
  counts: DigestStreamCount[];
  /** The single highest-leverage item, shown inline in full. */
  topItem?: DigestTopItem;
  /** Everything else, collapsed to title + one-line teaser per row. */
  streams?: DigestStream[];
  queueUrl?: string;
};

export type RenderedDigest = { subject: string; html: string; text: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CODE_STYLE = `font-family:${MONO};font-size:13px;background:${CODE_BG};padding:1px 4px;border-radius:3px;`;

// Sentinels wrap protected code spans before bold/escape so a `**` or a bare
// digit inside a code string can't be mis-rendered. This exact token can't
// occur in real digest text.
const CODE_OPEN = '\x01CODE';
const CODE_CLOSE = '\x01';

/** Escape, then render the inline markdown subset (code spans, bold). */
function inlineHtml(s: string): string {
  const codes: string[] = [];
  let out = s.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c);
    return `${CODE_OPEN}${codes.length - 1}${CODE_CLOSE}`;
  });
  out = escapeHtml(out);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(
    new RegExp(`${CODE_OPEN}(\\d+)${CODE_CLOSE}`, 'g'),
    (_m, i: string) => `<code style="${CODE_STYLE}">${escapeHtml(codes[Number(i)])}</code>`,
  );
  return out;
}

/** Strip the markdown markers for the plain-text alternative. */
function inlineText(s: string): string {
  return s.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
}

function bodyToHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split('\n').map(inlineHtml).join('<br>');
      return `<p style="margin:0 0 12px;color:${FG};font-size:15px;line-height:1.5;">${lines}</p>`;
    })
    .join('');
}

function countsLine(counts: DigestStreamCount[]): string {
  const sep = `<span style="color:${MUTED};"> &middot; </span>`;
  const html = counts
    .map(
      (c) =>
        `<span style="color:${MUTED};">${escapeHtml(c.label)}</span> <strong style="color:${FG};">${c.count}</strong>`,
    )
    .join(sep);
  return `<p style="margin:0;font-size:14px;line-height:1.6;">${html}</p>`;
}

function topItemHtml(item: DigestTopItem): string {
  const dot =
    item.severity === 'fire' ? `<span style="color:${FIRE};font-size:16px;">&#9679;</span> ` : '';
  return [
    `<div style="margin:20px 0;padding:16px 18px;background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px;">`,
    `<p style="margin:0 0 10px;font-size:17px;font-weight:600;line-height:1.35;color:${FG};">${dot}${inlineHtml(item.title)}</p>`,
    bodyToHtml(item.body),
    `</div>`,
  ].join('');
}

function streamsHtml(streams: DigestStream[]): string {
  const withItems = streams.filter((s) => s.items.length > 0);
  if (withItems.length === 0) return '';
  const blocks = withItems
    .map((s) => {
      const rows = s.items
        .map((it) => {
          const teaser = it.teaser
            ? ` <span style="color:${MUTED};">&mdash; ${inlineHtml(it.teaser)}</span>`
            : '';
          return `<li style="margin:0 0 6px;font-size:14px;line-height:1.45;color:${FG};"><strong>${inlineHtml(it.title)}</strong>${teaser}</li>`;
        })
        .join('');
      return [
        `<p style="margin:16px 0 6px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};">${escapeHtml(s.label)}</p>`,
        `<ul style="margin:0;padding:0 0 0 18px;">${rows}</ul>`,
      ].join('');
    })
    .join('');
  return [
    `<p style="margin:24px 0 0;font-size:15px;font-weight:600;color:${FG};">Other items in your queue</p>`,
    blocks,
  ].join('');
}

function rule(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:20px 0;">`;
}

export function renderQueueDigest(input: QueueDigestInput): RenderedDigest {
  const queueUrl = input.queueUrl ?? DEFAULT_QUEUE_URL;
  const total = input.counts.reduce((n, c) => n + c.count, 0);

  const subject =
    input.subject ??
    `HeyHenry Command Center${input.dateLabel ? ` · ${input.dateLabel}` : ''} · ${total} open`;

  const header = input.dateLabel
    ? `<p style="margin:0 0 4px;font-size:13px;color:${MUTED};">${escapeHtml(input.dateLabel)}</p>`
    : '';

  const html = [
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`,
    `<body style="margin:0;padding:0;background:#ffffff;">`,
    `<div style="max-width:600px;margin:0 auto;padding:24px 20px;font-family:${FONT};color:${FG};">`,
    header,
    countsLine(input.counts),
    rule(),
    input.topItem ? topItemHtml(input.topItem) : '',
    input.streams ? streamsHtml(input.streams) : '',
    rule(),
    `<p style="margin:0;"><a href="${escapeHtml(queueUrl)}" style="display:inline-block;font-size:15px;font-weight:600;color:${FG};text-decoration:underline;">Open your queue &rarr;</a></p>`,
    `</div></body></html>`,
  ].join('');

  const text = renderText(input, queueUrl);

  return { subject, html, text };
}

function renderText(input: QueueDigestInput, queueUrl: string): string {
  const lines: string[] = [];
  if (input.dateLabel) lines.push(input.dateLabel, '');
  lines.push(input.counts.map((c) => `${c.label} ${c.count}`).join('  ·  '));
  lines.push('');

  if (input.topItem) {
    const prefix = input.topItem.severity === 'fire' ? '🔴 ' : '';
    lines.push(`${prefix}${inlineText(input.topItem.title)}`);
    lines.push('');
    lines.push(inlineText(input.topItem.body));
    lines.push('');
  }

  const withItems = (input.streams ?? []).filter((s) => s.items.length > 0);
  if (withItems.length > 0) {
    lines.push('Other items in your queue');
    for (const s of withItems) {
      lines.push('', s.label.toUpperCase());
      for (const it of s.items) {
        lines.push(`  - ${inlineText(it.title)}${it.teaser ? ` — ${inlineText(it.teaser)}` : ''}`);
      }
    }
    lines.push('');
  }

  lines.push(`Open your queue → ${queueUrl}`);
  return lines.join('\n');
}
