'use client';

/**
 * "Add to crew" — the single role-led invite dialog (gap 3). Consolidates
 * the two old always-open cards (InviteWorkerCard + InviteBookkeeperCard)
 * into one flow: pick a role first, then name + email + role-specific prefs.
 *
 * Wired to the EXISTING `createWorkerInviteAction` — no new mutation.
 *
 * Role coverage:
 *  - Worker / Member / Bookkeeper — all minted by the existing invite path
 *    (the `worker_invites` CHECK allows worker|member|bookkeeper).
 *  - Admin — rendered as a DISABLED option for everyone: the invite CHECK
 *    does NOT permit `admin`, so an admin invite can't be sent without a
 *    migration (out of scope). Owners see a "promote after they join" note;
 *    no CHECK is widened here.
 *
 * Single rust accent: the trigger ("Add to crew") + the ✦ Henry draft cue.
 */

import { Check, ChevronDown, Copy, Loader2, Plus, Send, Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InvitePrefs, InviteRole } from '@/lib/db/queries/worker-invites';
import { cn } from '@/lib/utils';
import { createWorkerInviteAction } from '@/server/actions/team';
import { RoleBadge } from './role-badge';

type PickRole = 'worker' | 'admin' | 'member' | 'bookkeeper';

const ROLE_CARDS: {
  role: PickRole;
  badge: 'employee' | 'admin' | 'member' | 'bookkeeper';
  blurb: string;
}[] = [
  {
    role: 'worker',
    badge: 'employee',
    blurb: 'Employees & subs. Logs time. Lands on the field app.',
  },
  { role: 'admin', badge: 'admin', blurb: 'Everything operational. No billing or security.' },
  {
    role: 'member',
    badge: 'member',
    blurb: 'Office staff. Reads & light edits. No team or billing.',
  },
  { role: 'bookkeeper', badge: 'bookkeeper', blurb: 'Books-only access. Lands on /bk.' },
];

export function AddToCrewDialog({
  isOwnerViewer,
  fullWidthTrigger,
}: {
  /** Admin option is gated to owner — and disabled for everyone (see note). */
  isOwnerViewer: boolean;
  fullWidthTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [role, setRole] = useState<PickRole>('worker');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const [workerType, setWorkerType] = useState<'employee' | 'subcontractor'>('employee');
  const [canExpenses, setCanExpenses] = useState<'inherit' | 'yes' | 'no'>('inherit');
  const [canInvoice, setCanInvoice] = useState<'inherit' | 'yes' | 'no'>('inherit');
  const [payRate, setPayRate] = useState('');
  const [chargeRate, setChargeRate] = useState('');

  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setRole('worker');
    setName('');
    setEmail('');
    setShowPrefs(false);
    setWorkerType('employee');
    setCanExpenses('inherit');
    setCanInvoice('inherit');
    setPayRate('');
    setChargeRate('');
    setJoinUrl(null);
    setSentTo(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleCreate() {
    startTransition(async () => {
      // Admin is never sendable via the invite path — guard defensively.
      const inviteRole: InviteRole = role === 'worker' ? 'worker' : (role as InviteRole);
      const prefs: InvitePrefs | undefined =
        role === 'worker'
          ? {
              worker_type: workerType,
              can_log_expenses: canExpenses,
              can_invoice: canInvoice,
              default_hourly_rate_cents: payRate ? Math.round(Number(payRate) * 100) : null,
              default_charge_rate_cents: chargeRate ? Math.round(Number(chargeRate) * 100) : null,
            }
          : undefined;

      const result = await createWorkerInviteAction({
        role: inviteRole,
        invited_name: name.trim() || undefined,
        invited_email: email.trim() || undefined,
        invite_prefs: prefs,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to create invite.');
        return;
      }
      setJoinUrl(result.joinUrl ?? null);
      setSentTo(email.trim() || null);
      toast.success(email.trim() ? `Invite sent to ${email.trim()}.` : 'Invite link created.');
    });
  }

  async function handleCopy() {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const firstName = name.trim().split(/\s+/)[0] || 'them';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className={cn(
            'bg-brand text-white hover:bg-brand/90',
            fullWidthTrigger && 'min-h-11 w-full',
          )}
        >
          <Plus className="size-4" />
          Add to crew
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        {joinUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite created</DialogTitle>
              <DialogDescription>
                {sentTo
                  ? `Invite email sent to ${sentTo}. Share the link too if you like.`
                  : 'Share this link with them — it expires in 7 days.'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded border bg-muted px-3 py-2 text-sm">
                {joinUrl}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopy} title="Copy link">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                <Plus className="size-4" />
                Invite another
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add to crew</DialogTitle>
              <DialogDescription>
                Generate an invite link (or send it now). Links expire after 7 days.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Step 1 — role picker */}
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ROLE_CARDS.map((card) => {
                    const isAdmin = card.role === 'admin';
                    // Admin can't be invited (CHECK doesn't allow it) — always
                    // disabled; only owners even see the explanatory note.
                    const disabled = isAdmin;
                    const selected = role === card.role;
                    return (
                      <button
                        type="button"
                        key={card.role}
                        disabled={disabled}
                        aria-disabled={disabled}
                        onClick={() => !disabled && setRole(card.role)}
                        className={cn(
                          'relative flex flex-col gap-1 rounded-lg border p-3 text-left',
                          disabled
                            ? 'cursor-not-allowed bg-paper-soft opacity-60'
                            : 'cursor-pointer hover:border-rule hover:bg-paper-soft',
                          selected && 'border-foreground bg-paper-soft ring-1 ring-foreground',
                        )}
                      >
                        <RoleBadge role={card.badge} />
                        <span className="text-xs leading-snug text-muted-foreground">
                          {card.blurb}
                        </span>
                        {isAdmin ? (
                          <span className="mt-1 text-[11px] leading-snug text-muted-foreground">
                            {isOwnerViewer
                              ? 'Promote a member to admin after they join.'
                              : 'Owner only.'}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2 — name + email */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="crew-name" className="text-xs">
                    Name <span className="text-muted-foreground">optional</span>
                  </Label>
                  <Input
                    id="crew-name"
                    className="min-h-11"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="crew-email" className="text-xs">
                    Email <span className="text-muted-foreground">sends invite automatically</span>
                  </Label>
                  <Input
                    id="crew-email"
                    type="email"
                    className="min-h-11"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Henry draft cue — labelled, read-only suggestion (✦). */}
              {email.trim() ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-brand/20 bg-brand/5 p-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-white text-brand">
                    <Sparkles className="size-3" aria-hidden />
                  </span>
                  <p className="text-xs leading-relaxed text-foreground/80">
                    <strong className="font-semibold text-foreground">
                      Henry can personalize the invite.
                    </strong>{' '}
                    The standard transactional email goes out either way — Henry only drafts the
                    human line on top. (Coming soon.)
                  </p>
                </div>
              ) : null}

              {/* Worker prefs — only for the worker role */}
              {role === 'worker' ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowPrefs((v) => !v)}
                    className="flex w-max items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn('size-3.5 transition-transform', showPrefs && 'rotate-180')}
                    />
                    Worker setup
                    <span className="font-normal text-muted-foreground/70">
                      type, capabilities, rates — applied when {firstName} accepts
                    </span>
                  </button>

                  {showPrefs ? (
                    <div className="flex flex-col gap-3 rounded-lg border bg-paper-soft p-3.5">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Worker type</Label>
                          <Select
                            value={workerType}
                            onValueChange={(v) => setWorkerType(v as typeof workerType)}
                          >
                            <SelectTrigger className="min-h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="employee">Employee</SelectItem>
                              <SelectItem value="subcontractor">Subcontractor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Log expenses</Label>
                          <Select
                            value={canExpenses}
                            onValueChange={(v) => setCanExpenses(v as typeof canExpenses)}
                          >
                            <SelectTrigger className="min-h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Default</SelectItem>
                              <SelectItem value="yes">Allow</SelectItem>
                              <SelectItem value="no">Block</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Submit invoices</Label>
                          <Select
                            value={canInvoice}
                            onValueChange={(v) => setCanInvoice(v as typeof canInvoice)}
                          >
                            <SelectTrigger className="min-h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Default</SelectItem>
                              <SelectItem value="yes">Allow</SelectItem>
                              <SelectItem value="no">Block</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Pay{' '}
                            <span className="font-normal text-muted-foreground">
                              what you pay {firstName}
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="min-h-11"
                            value={payRate}
                            onChange={(e) => setPayRate(e.target.value)}
                            placeholder="0.00"
                            aria-label="Pay rate — what you pay them, CAD per hour"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Charge{' '}
                            <span className="font-normal text-muted-foreground">
                              what you bill the client
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="min-h-11"
                            value={chargeRate}
                            onChange={(e) => setChargeRate(e.target.value)}
                            placeholder="0.00"
                            aria-label="Charge rate — what you bill the client, CAD per hour"
                          />
                        </div>
                      </div>
                      <p className="font-mono text-[11px] tracking-wide text-muted-foreground">
                        Not visible to {firstName}.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {role === 'bookkeeper' ? (
                <div className="flex flex-col gap-2 rounded-lg border bg-paper-soft p-3.5 text-xs text-foreground/80">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                    Books-only scope
                  </span>
                  <p className="leading-relaxed">
                    They get access to expenses, bills, invoices, GST/HST remittance, and year-end
                    exports — no client details or project content.
                  </p>
                </div>
              ) : null}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleCreate} disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Copy className="size-4" />
                )}
                Create link
              </Button>
              <Button onClick={handleCreate} disabled={pending || !email.trim()}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Create &amp; send
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
