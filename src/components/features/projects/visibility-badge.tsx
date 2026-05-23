/**
 * Client-visibility badge — the #1 trust signal on the Photos and Documents
 * tabs. Answers "who can see this?" at a glance, and it MUST do so with
 * label + glyph, never colour alone (WCAG 2.2 AA / SC 1.4.1).
 *
 *   - Internal   → lock glyph + "Internal" label  (client cannot see this)
 *   - Client     → globe glyph + "Client visible"  (on the client's portal)
 *
 * Both variants carry a `title` so the meaning is reachable on hover and by
 * assistive tech. Colour is a reinforcement, not the carrier of meaning.
 *
 * Shared so a photo overlay badge and a document-row badge can't drift.
 */

import { Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VisibilityBadge({
  clientVisible,
  className,
}: {
  clientVisible: boolean;
  className?: string;
}) {
  return clientVisible ? (
    <span
      data-slot="visibility-badge"
      data-visibility="client"
      title="Visible on the client's portal"
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide',
        'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-300',
        className,
      )}
    >
      <Globe className="size-3 shrink-0" aria-hidden />
      Client visible
    </span>
  ) : (
    <span
      data-slot="visibility-badge"
      data-visibility="internal"
      title="Internal only — the client cannot see this"
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide',
        'border border-border bg-muted text-muted-foreground',
        className,
      )}
    >
      <Lock className="size-3 shrink-0" aria-hidden />
      Internal
    </span>
  );
}
