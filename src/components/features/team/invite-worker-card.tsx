'use client';

/**
 * Card that generates a worker invite link and lets the owner copy it.
 */

import { Check, Copy, Loader2, Plus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createWorkerInviteAction } from '@/server/actions/team';

export function InviteWorkerCard() {
  const [pending, startTransition] = useTransition();
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    startTransition(async () => {
      const result = await createWorkerInviteAction();
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to create invite.');
        return;
      }
      setJoinUrl(result.joinUrl ?? null);
      toast.success('Invite link created.');
    });
  }

  async function handleCopy() {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    toast.success('Link copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a Worker</CardTitle>
        <CardDescription>
          Generate a link to invite someone to your team. Links expire after 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {joinUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded border bg-muted px-3 py-2 text-sm">
              {joinUrl}
            </code>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        ) : null}
        <Button onClick={handleGenerate} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Plus className="mr-2 size-4" />
              Generate invite link
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
