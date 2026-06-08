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
import { StatusBadge } from '@/components/ui/status-badge';

export function VisibilityBadge({
  clientVisible,
  className,
}: {
  clientVisible: boolean;
  className?: string;
}) {
  return clientVisible ? (
    <StatusBadge
      tone="info"
      label="Client visible"
      icon={Globe}
      data-slot="visibility-badge"
      data-visibility="client"
      title="Visible on the client's portal"
      className={className}
    />
  ) : (
    <StatusBadge
      tone="neutral"
      label="Internal"
      icon={Lock}
      data-slot="visibility-badge"
      data-visibility="internal"
      title="Internal only — the client cannot see this"
      className={className}
    />
  );
}
