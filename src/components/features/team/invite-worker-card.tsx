'use client';

/**
 * Card that generates a worker invite link and lets the owner copy or email it.
 */

import { Check, Copy, Loader2, Mail, Plus, Send } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createWorkerInviteAction, sendWorkerInviteEmailAction } from '@/server/actions/team';

export function InviteWorkerCard() {
  const [pending, startTransition] = useTransition();
  const [sendingEmail, startEmailTransition] = useTransition();
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');

  function handleGenerate() {
    startTransition(async () => {
      const result = await createWorkerInviteAction();
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to create invite.');
        return;
      }
      setJoinUrl(result.joinUrl ?? null);
      setInviteCode(result.code ?? null);
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

  function handleSendEmail() {
    if (!email.trim() || !joinUrl) return;
    startEmailTransition(async () => {
      const result = await sendWorkerInviteEmailAction(email.trim(), joinUrl);
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to send invite.');
        return;
      }
      toast.success(`Invite sent to ${email}`);
      setEmail('');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a Worker</CardTitle>
        <CardDescription>
          Generate a link to invite someone to your team, or send it directly via email. Links expire after 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {joinUrl ? (
          <>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded border bg-muted px-3 py-2 text-sm">
                {joinUrl}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <Input
                type="email"
                placeholder="worker@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
                className="h-9"
              />
              <Button size="sm" onClick={handleSendEmail} disabled={sendingEmail || !email.trim()}>
                {sendingEmail ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </>
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
