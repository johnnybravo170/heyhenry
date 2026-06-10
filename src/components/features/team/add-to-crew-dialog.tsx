'use client';

/**
 * "Add to crew" dialog.
 *
 * Workers: direct-add by name (no app account required). Optional "send
 * invite" toggle creates a join link so they can set up their own account
 * later if they want. No invite link is required to use a worker in time
 * logging, job assignments, etc. — they're live in the system immediately.
 *
 * Admin / Member / Bookkeeper: invite-link flow unchanged (they need an
 * account to do anything useful). Admin is still disabled — the invite
 * CHECK doesn't allow it.
 */

import { Check, ChevronDown, Copy, Loader2, Plus, Send, UserPlus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { addWorkerDirectAction, createWorkerInviteAction } from '@/server/actions/team';
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
    blurb: 'Employees & subs. Logs time. Optionally gets the field app.',
  },
  { role: 'admin', badge: 'admin', blurb: 'Everything operational. No billing or security.' },
  {
    role: 'member',
    badge: 'member',
    blurb: 'Office staff. Reads & light edits. No team or billing.',
  },
  { role: 'bookkeeper', badge: 'bookkeeper', blurb: 'Books-only access. Lands on /bk.' },
];

type DoneState = {
  addedName: string;
  /** Set if an invite was also created. */
  joinUrl?: string;
  sentTo?: string;
};

export function AddToCrewDialog({
  isOwnerViewer,
  fullWidthTrigger,
}: {
  isOwnerViewer: boolean;
  fullWidthTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [role, setRole] = useState<PickRole>('worker');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const [workerType, setWorkerType] = useState<'employee' | 'subcontractor'>('employee');
  const [canExpenses, setCanExpenses] = useState<'inherit' | 'yes' | 'no'>('inherit');
  const [canInvoice, setCanInvoice] = useState<'inherit' | 'yes' | 'no'>('inherit');
  const [payRate, setPayRate] = useState('');
  const [chargeRate, setChargeRate] = useState('');

  // Worker direct-add extras
  const [sendInvite, setSendInvite] = useState(false);

  const [done, setDone] = useState<DoneState | null>(null);
  const [copied, setCopied] = useState(false);

  // Invite-only path (non-worker roles)
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function reset() {
    setRole('worker');
    setName('');
    setPhone('');
    setEmail('');
    setShowPrefs(false);
    setWorkerType('employee');
    setCanExpenses('inherit');
    setCanInvoice('inherit');
    setPayRate('');
    setChargeRate('');
    setSendInvite(false);
    setDone(null);
    setJoinUrl(null);
    setSentTo(null);
    setCopied(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  /** Worker direct-add path. */
  function handleAddWorker() {
    startTransition(async () => {
      const result = await addWorkerDirectAction({
        name: name.trim(),
        phone: phone.trim() || undefined,
        worker_type: workerType,
        default_hourly_rate_cents: payRate ? Math.round(Number(payRate) * 100) : null,
        default_charge_rate_cents: chargeRate ? Math.round(Number(chargeRate) * 100) : null,
        can_log_expenses: canExpenses === 'inherit' ? null : canExpenses === 'yes',
        can_invoice: canInvoice === 'inherit' ? null : canInvoice === 'yes',
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to add worker.');
        return;
      }

      let inviteUrl: string | undefined;
      let inviteSentTo: string | undefined;

      if (sendInvite) {
        const inviteResult = await createWorkerInviteAction({
          role: 'worker',
          invited_name: name.trim() || undefined,
          invited_email: email.trim() || undefined,
          invite_prefs: {
            worker_type: workerType,
            can_log_expenses: canExpenses,
            can_invoice: canInvoice,
            default_hourly_rate_cents: payRate ? Math.round(Number(payRate) * 100) : null,
            default_charge_rate_cents: chargeRate ? Math.round(Number(chargeRate) * 100) : null,
          },
        });
        if (inviteResult.ok) {
          inviteUrl = inviteResult.joinUrl;
          inviteSentTo = email.trim() || undefined;
        }
      }

      setDone({ addedName: name.trim(), joinUrl: inviteUrl, sentTo: inviteSentTo });
      toast.success(`${name.trim()} added to the crew.`);
    });
  }

  /** Invite-link path for non-worker roles. */
  function handleInvite() {
    startTransition(async () => {
      const inviteRole: InviteRole = role as InviteRole;
      const result = await createWorkerInviteAction({
        role: inviteRole,
        invited_name: name.trim() || undefined,
        invited_email: email.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to create invite.');
        return;
      }
      setJoinUrl(result.joinUrl ?? null);
      setSentTo(email.trim() || null);
      toast.success(email.trim() ? `Invite sent to ${email.trim()}.` : 'Invite link created.', {
        duration: 8000,
      });
    });
  }

  async function handleCopyInvite(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const firstName = name.trim().split(/\s+/)[0] || 'them';

  // ─── Done state for non-worker invite path ─────────────────────────────
  if (joinUrl) {
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
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopyInvite(joinUrl)}
              title="Copy link"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset}>
              <Plus className="size-4" />
              Invite another
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
        {/* ─── Worker done state ─────────────────────────────────────── */}
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>{done.addedName} added to the crew</DialogTitle>
              <DialogDescription>
                They can be selected in time logging and job assignments right away — no app account
                needed.
              </DialogDescription>
            </DialogHeader>
            {done.joinUrl ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {done.sentTo
                    ? `Invite email sent to ${done.sentTo}. Share the link below if you like.`
                    : "Invite link created. Share it when they're ready to set up their account."}
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded border bg-muted px-3 py-2 text-sm">
                    {done.joinUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyInvite(done.joinUrl!)}
                    title="Copy invite link"
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                <Plus className="size-4" />
                Add another
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add to crew</DialogTitle>
              <DialogDescription>
                {role === 'worker'
                  ? 'Workers are added instantly — no app account required. Send an invite later if they want one.'
                  : 'Generate an invite link (or send it now). Links expire after 7 days.'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Role picker */}
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ROLE_CARDS.map((card) => {
                    const isAdmin = card.role === 'admin';
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

              {/* ─── Worker direct-add form ─────────────────────────── */}
              {role === 'worker' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="crew-name" className="text-xs">
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="crew-name"
                        className="min-h-11"
                        placeholder="Jane Smith"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="crew-phone" className="text-xs">
                        Phone <span className="text-muted-foreground">optional</span>
                      </Label>
                      <Input
                        id="crew-phone"
                        type="tel"
                        className="min-h-11"
                        placeholder="(613) 555-0100"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Worker prefs */}
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
                        type, capabilities, rates
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

                  {/* Optional invite */}
                  <div className="rounded-lg border bg-paper-soft p-3.5">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="send-invite"
                        checked={sendInvite}
                        onCheckedChange={(v) => setSendInvite(!!v)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-1">
                        <label htmlFor="send-invite" className="cursor-pointer text-sm font-medium">
                          Also send an app invite
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Creates a join link so {firstName} can set up their own account. Optional
                          — skip it for crew who won't use the app.
                        </p>
                      </div>
                    </div>
                    {sendInvite ? (
                      <div className="mt-3 space-y-1.5">
                        <Label htmlFor="crew-email" className="text-xs">
                          Email{' '}
                          <span className="text-muted-foreground">sends invite automatically</span>
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
                    ) : null}
                  </div>
                </>
              ) : (
                // ─── Non-worker invite form (unchanged) ────────────────
                <>
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
                        Email{' '}
                        <span className="text-muted-foreground">sends invite automatically</span>
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

                  {role === 'bookkeeper' ? (
                    <div className="flex flex-col gap-2 rounded-lg border bg-paper-soft p-3.5 text-xs text-foreground/80">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                        Books-only scope
                      </span>
                      <p className="leading-relaxed">
                        They get access to expenses, bills, invoices, GST/HST remittance, and
                        year-end exports — no client details or project content.
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              {role === 'worker' ? (
                <Button onClick={handleAddWorker} disabled={pending || !name.trim()}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Add to crew
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleInvite} disabled={pending}>
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    Create link
                  </Button>
                  <Button onClick={handleInvite} disabled={pending || !email.trim()}>
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Create &amp; send
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
