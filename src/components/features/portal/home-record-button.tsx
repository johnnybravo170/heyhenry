'use client';

/**
 * Operator-side "Generate Home Record" button. Shown on the Documents
 * tab and the Portal tab.
 *
 * If a record exists already, shows two affordances: View (opens the
 * permanent share link in a new tab) + Regenerate (re-runs the
 * snapshot to pick up newer photos / selections / etc — keeps the
 * same slug so links already shared with the homeowner keep working).
 */

import { ExternalLink, Loader2, RotateCw, Sparkles } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { generateHomeRecordAction } from '@/server/actions/home-records';

type Props = {
  projectId: string;
  existingSlug: string | null;
};

export function HomeRecordButton({ projectId, existingSlug }: Props) {
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const res = await generateHomeRecordAction(projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(existingSlug ? 'Home Record refreshed.' : 'Home Record generated.');
    });
  }

  if (!existingSlug) {
    return (
      <Button type="button" onClick={generate} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Generate Home Record
      </Button>
    );
  }

  const url = `/home-record/${existingSlug}`;
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="default" size="sm">
        <a href={url} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" />
          View Home Record
        </a>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={generate} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
        Regenerate
      </Button>
    </div>
  );
}
