/**
 * <PublicBrandHeader> — the GC's letterhead bar for the *non-money* public
 * surfaces (Portal hub, Tap-to-decide). It is the document-shell analogue of
 * <CustomerDocument>'s header (PATTERNS.md §28): the brand on the page is the
 * contractor's — signed logo (or text-name fallback) + business name +
 * optional context line — never HeyHenry's chrome. A quiet "secure" lock
 * signals the no-login trust boundary.
 *
 * Mobile-first: clients open these from an SMS / email link on a phone. The
 * bar is a white card row floating on the warm Paper background, matching the
 * `gc-bar` recipe in `od-public-pages/screens/mobile.html`.
 *
 * Hard boundary: this is brand chrome only — it renders no project data
 * beyond the business name + a caller-supplied context string. It never sees
 * cost / margin / supplier fields.
 *
 * PATTERNS.md §32.
 */

import { Lock } from 'lucide-react';

export type PublicBrandHeaderProps = {
  /** Signed URL to the GC's logo (private photos bucket), or null → text name. */
  logoUrl: string | null;
  /** GC business name. Doubles as the logo's alt text. */
  businessName: string;
  /**
   * Optional context line under the name — the project name + client first
   * name, or a short "a quick decision for {name}". Caller-supplied; never
   * a money / internal figure.
   */
  context?: string | null;
  /** Hide the "secure" lock affordance (rarely needed). */
  hideSecure?: boolean;
};

/** Two-letter fallback badge from the business name, when no logo is set. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PublicBrandHeader({
  logoUrl,
  businessName,
  context,
  hideSecure = false,
}: PublicBrandHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b bg-card px-4 py-3 sm:rounded-t-2xl">
      {logoUrl ? (
        // biome-ignore lint/performance/noImgElement: signed URLs bypass next/image
        <img
          src={logoUrl}
          alt={businessName}
          className="h-9 w-auto max-w-[180px] shrink-0 object-contain"
        />
      ) : (
        <div
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-sm font-extrabold tracking-tight text-background"
        >
          {initials(businessName)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight tracking-tight text-foreground">
          {businessName}
        </p>
        {context ? (
          <p className="truncate text-xs leading-snug text-muted-foreground">{context}</p>
        ) : null}
      </div>
      {hideSecure ? null : (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          <Lock aria-hidden className="h-3 w-3 text-emerald-600" />
          secure
        </span>
      )}
    </header>
  );
}
