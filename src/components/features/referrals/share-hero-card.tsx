'use client';

import {
  Check,
  Copy,
  Info,
  Link2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { draftReferralNote } from '@/lib/referral/draft-note';
import { cn } from '@/lib/utils';
import { sendReferralEmailAction, sendReferralSMSAction } from '@/server/actions/referrals';

/**
 * Normalize a user-typed phone string into E.164. Strips spaces, dashes,
 * parens; assumes North American (+1) when the user types 10 digits with no
 * country code. The server-side Zod schema is the authority — this is a UX
 * nicety so people don't have to remember the +1 prefix.
 */
function normalizeToE164(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

type Channel = 'email' | 'text';

/**
 * The share-first cockpit. The one job on this page is *share*, so the link
 * (copy + native share) and the invite (email/text + a Henry-drafted note)
 * live together as the hero.
 *
 * Rust is reserved for the single primary affordance per state: the **Share**
 * button when idle, the **Send invite** button while composing. Everything
 * else is ink-on-Paper.
 */
export function ShareHeroCard({ url, code }: { url: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<Channel>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Henry draft state. The note is editable free text; `draftVariant` cycles
  // templates via "Try another draft". `note` is the live editable buffer —
  // null means no draft is open. We NEVER auto-send: the operator hits Send.
  const [note, setNote] = useState<string | null>(null);
  const [draftVariant, setDraftVariant] = useState(0);

  const [pending, startTransition] = useTransition();

  const recipient = channel === 'email' ? email : phone;
  const hasRecipient = recipient.trim().length > 0;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link.');
    }
  }

  async function shareLink() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Try HeyHenry',
          text: 'I use HeyHenry to run my contracting business. Check it out!',
          url,
        });
      } catch {
        // User cancelled the share sheet — not an error.
      }
    } else {
      await copyLink();
    }
  }

  function openDraft() {
    setDraftVariant(0);
    setNote(draftReferralNote({ referrerName: code, referralUrl: url }, 0));
  }

  function regenerateDraft() {
    const next = draftVariant + 1;
    setDraftVariant(next);
    setNote(draftReferralNote({ referrerName: code, referralUrl: url }, next));
  }

  function send() {
    const trimmedNote = note?.trim() || undefined;
    startTransition(async () => {
      if (channel === 'email') {
        if (!email.trim()) return;
        const result = await sendReferralEmailAction(email.trim(), trimmedNote);
        if (result.ok) {
          toast.success('Referral invite sent!');
          setEmail('');
          setNote(null);
        } else {
          toast.error(result.error);
        }
      } else {
        const e164 = normalizeToE164(phone);
        if (!e164) return;
        const result = await sendReferralSMSAction(e164, trimmedNote);
        if (result.ok) {
          toast.success('Referral invite sent!');
          setPhone('');
          setNote(null);
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* Hero head */}
      <div className="border-b p-4 sm:px-5">
        <p className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-brand">
          <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
          The one job · share
        </p>
        <h2 className="text-base font-bold leading-tight tracking-tight text-foreground">
          Your link is ready
        </h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Copy it, share it from your phone, or send it to a specific contractor by email or text.
          No quotas, no leaderboard — just your link.
        </p>
      </div>

      <div className="flex flex-col gap-5 p-4 sm:px-5">
        {/* Link block */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="referral-link"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground"
          >
            <Link2 className="size-3 text-muted-foreground" aria-hidden="true" />
            Your referral link
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="referral-link"
              value={url}
              readOnly
              className="min-w-0 flex-1 bg-muted/40 font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={copyLink}
                className="h-10 flex-1 sm:flex-none"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                Copy
              </Button>
              <Button
                type="button"
                onClick={shareLink}
                className="h-10 flex-1 bg-brand text-brand-foreground hover:bg-brand/90 sm:flex-none"
              >
                <Share2 className="size-4" />
                Share
              </Button>
            </div>
          </div>
          <p className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">
            Code: <span className="text-foreground">{code}</span>
          </p>
        </div>

        {/* Invite block */}
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">Send an invite</span>
            <div
              className="inline-flex rounded-lg border bg-muted/40 p-0.5"
              role="tablist"
              aria-label="Invite channel"
            >
              {(['email', 'text'] as const).map((c) => {
                const Icon = c === 'email' ? Mail : MessageSquare;
                const on = channel === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setChannel(c)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors',
                      on
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-3" aria-hidden="true" />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {channel === 'email' ? (
              <Input
                type="email"
                placeholder="contractor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                aria-label="Invite by email"
                className="min-w-0 flex-1"
              />
            ) : (
              <Input
                type="tel"
                placeholder="+1 (604) 555-0142"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={pending}
                aria-label="Invite by text"
                className="min-w-0 flex-1"
              />
            )}
            {note === null ? (
              <Button
                type="button"
                onClick={send}
                disabled={pending || !hasRecipient}
                className="h-10 bg-brand text-brand-foreground hover:bg-brand/90"
              >
                <Send className="size-4" />
                {pending ? 'Sending…' : 'Send'}
              </Button>
            ) : null}
          </div>

          {/* Henry draft */}
          {note === null ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={openDraft}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-brand transition-colors hover:bg-brand/10"
              >
                <Sparkles className="size-3" aria-hidden="true" />
                Draft a note for me
              </button>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3 text-muted-foreground/60" aria-hidden="true" />
                Only invite people you personally know — your invite, your words.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 rounded-lg border border-brand/20 border-l-2 border-l-brand bg-brand/5 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-brand">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Henry drafted this
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  Peer-to-peer · editable
                </span>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Invite note"
                rows={6}
                className="resize-y bg-card text-sm"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs leading-snug text-muted-foreground">
                  <span className="font-semibold text-foreground">Never auto-sent.</span> Edit
                  freely, or rewrite from scratch.
                </span>
                <div className="inline-flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={regenerateDraft}
                    className="h-8 text-brand hover:text-brand"
                  >
                    <RefreshCw className="size-3" />
                    Try another
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNote(null)}
                    className="h-8 text-muted-foreground"
                  >
                    <Trash2 className="size-3" />
                    Discard
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-brand/10 pt-2.5">
                <Button
                  type="button"
                  onClick={send}
                  disabled={pending || !hasRecipient}
                  className="h-10 bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  <Send className="size-4" />
                  {pending ? 'Sending…' : 'Send invite'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
