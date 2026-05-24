'use client';

/**
 * Operator-side Home Record flow on the project Documents tab.
 *
 * Replaces the old six-button card with a 3-step generate → preview → send
 * state strip (PATTERNS §27) + a readiness line (Web link · PDF · ZIP). One
 * primary action per state:
 *   No record  → Generate Home Record (empty-state shape, PATTERNS §6)
 *   Snapshot   → Preview & finish   (opens the preview drawer where formats build)
 *   Ready      → Email to client    (opens the send dialog)
 *   Sent       → Resend             (calm success strip)
 *
 * Format-building (PDF / ZIP) + the ✦ Henry closeout-summary editor live in
 * the preview drawer — not as toolbar buttons. Regenerate collapses to ONE
 * AlertDialog (PATTERNS §3): the slug stays the same, rebuild formats after.
 *
 * The preview drawer is a wide Dialog (no Sheet primitive in this app yet);
 * it shows the artifact-as-the-client-sees-it on the left and the build /
 * summary controls on the right.
 */

import {
  AlertTriangle,
  Archive,
  Check,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Mail,
  RotateCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { formatDateTime } from '@/lib/date/format';
import { cn } from '@/lib/utils';
import {
  draftHomeRecordSummaryAction,
  emailHomeRecordAction,
  generateHomeRecordAction,
  generateHomeRecordPdfAction,
  generateHomeRecordZipAction,
  keepHomeRecordSummaryAction,
} from '@/server/actions/home-records';

type Props = {
  projectId: string;
  existingSlug: string | null;
  hasPdf: boolean;
  hasZip: boolean;
  emailedAt: string | null;
  emailedTo: string | null;
  defaultEmail: string | null;
  /** The approved Henry summary already on the record (editor seed). */
  summary: string | null;
  /**
   * Snapshot was regenerated after the last PDF/ZIP build → attached formats
   * would be older than the live web link. Currently always false (regen
   * nulls pdf_path/zip_path, so a built-but-stale state can't occur without a
   * build-vs-generate timestamp) — wired through so the warning lights up the
   * day that column lands. See report → deferred.
   */
  pdfStale?: boolean;
  zipStale?: boolean;
};

type ChipState = 'built' | 'pending' | 'stale';

function ReadinessChip({
  name,
  state,
  detail,
}: {
  name: string;
  state: ChipState;
  detail: string;
}) {
  const Icon = state === 'built' ? Check : state === 'stale' ? AlertTriangle : null;
  const tone =
    state === 'built'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
      : state === 'stale'
        ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-card text-muted-foreground border-border';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide',
        tone,
      )}
    >
      {Icon ? (
        <Icon className="size-3" aria-hidden />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-40" aria-hidden />
      )}
      <span>{name}</span>
      <span className="font-medium opacity-80">{detail}</span>
    </span>
  );
}

export function HomeRecordFlow({
  projectId,
  existingSlug,
  hasPdf,
  hasZip,
  emailedAt,
  emailedTo,
  defaultEmail,
  summary,
  pdfStale = false,
  zipStale = false,
}: Props) {
  const tz = useTenantTimezone();
  const [genPending, startGen] = useTransition();
  const [regenOpen, setRegenOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const allBuilt = hasPdf && hasZip;
  const sent = Boolean(emailedAt);
  const state: 'empty' | 'snapshot' | 'ready' | 'sent' = !existingSlug
    ? 'empty'
    : sent
      ? 'sent'
      : allBuilt
        ? 'ready'
        : 'snapshot';

  function generate() {
    startGen(async () => {
      const res = await generateHomeRecordAction(projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(existingSlug ? 'Home Record refreshed.' : 'Home Record generated.');
      setRegenOpen(false);
    });
  }

  const viewUrl = existingSlug ? `/home-record/${existingSlug}` : '#';
  const pdfUrl = existingSlug ? `/home-record/${existingSlug}/download` : '#';
  const zipUrl = existingSlug ? `/home-record/${existingSlug}/download-zip` : '#';

  // ── EMPTY ────────────────────────────────────────────────────────────
  if (state === 'empty') {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed bg-paper-soft p-6 sm:flex-row sm:items-center">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-card text-brand">
          <FileText className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">No Home Record yet.</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Assemble the finished job into one permanent package for your client — they keep the
            link forever for repairs, insurance, or the next reno.
          </p>
        </div>
        <Button type="button" onClick={generate} disabled={genPending} className="shrink-0">
          {genPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
          Generate Home Record
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* State strip — one lifecycle row, current step emphasized */}
      <section
        aria-label="Home Record state"
        className={cn(
          'flex flex-col gap-3 rounded-lg border border-l-[3px] p-3 sm:flex-row sm:items-center sm:gap-4',
          state === 'snapshot' && 'border-l-brand bg-[var(--rust-soft)]',
          state === 'ready' && 'border-l-emerald-600 bg-card',
          state === 'sent' &&
            'border-emerald-200 border-l-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
        )}
      >
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-full',
            state === 'snapshot' && 'bg-brand text-white',
            state === 'ready' && 'bg-emerald-100 text-emerald-700',
            state === 'sent' && 'bg-emerald-600 text-white',
          )}
          aria-hidden
        >
          {state === 'snapshot' ? (
            <span className="font-mono text-xs font-bold">2</span>
          ) : (
            <Check className="size-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          {state === 'snapshot' ? (
            <>
              <strong className="font-semibold text-foreground">Snapshot ready.</strong>{' '}
              <span className="text-muted-foreground">
                Preview the document the way your client will see it, then build the PDF + ZIP and
                send.
              </span>
            </>
          ) : state === 'ready' ? (
            <>
              <strong className="font-semibold text-foreground">Ready to send.</strong>{' '}
              <span className="text-muted-foreground">
                All three formats built — the link works forever and the PDF + ZIP are tucked away
                in storage.
              </span>
            </>
          ) : (
            <>
              <strong className="font-semibold text-foreground">
                Sent to {emailedTo ?? 'your client'}
              </strong>{' '}
              <span className="text-muted-foreground">
                on {emailedAt ? formatDateTime(emailedAt, { timezone: tz }) : ''}
              </span>
            </>
          )}
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="size-4" />
            {state === 'snapshot' ? 'Preview' : 'Preview as client'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
            <RotateCw className="size-4" />
            Regenerate
          </Button>
          {state === 'snapshot' ? (
            <Button type="button" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="size-4" />
              Preview &amp; finish
            </Button>
          ) : state === 'ready' ? (
            <Button type="button" size="sm" onClick={() => setEmailOpen(true)}>
              <Mail className="size-4" />
              Email to client
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => setEmailOpen(true)}>
              <Send className="size-4" />
              Resend
            </Button>
          )}
        </span>
      </section>

      {/* Readiness line — Web link · PDF · ZIP */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-paper-soft px-3 py-2">
        <span className="mr-1 border-r pr-2 font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Readiness
        </span>
        <ReadinessChip name="Web link" state="built" detail="Live" />
        <ReadinessChip
          name="PDF"
          state={hasPdf ? (pdfStale ? 'stale' : 'built') : 'pending'}
          detail={hasPdf ? (pdfStale ? 'Stale — rebuild' : 'Built') : 'Not built'}
        />
        <ReadinessChip
          name="ZIP"
          state={hasZip ? (zipStale ? 'stale' : 'built') : 'pending'}
          detail={hasZip ? (zipStale ? 'Stale — rebuild' : 'Built') : 'Not built'}
        />
        {(hasPdf || hasZip) && state !== 'snapshot' ? (
          <span className="ml-auto flex items-center gap-1">
            {hasPdf ? (
              <Button asChild variant="ghost" size="sm">
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  <Download className="size-3.5" />
                  PDF
                </a>
              </Button>
            ) : null}
            {hasZip ? (
              <Button asChild variant="ghost" size="sm">
                <a href={zipUrl} target="_blank" rel="noreferrer">
                  <Archive className="size-3.5" />
                  ZIP
                </a>
              </Button>
            ) : null}
          </span>
        ) : null}
      </div>

      <PreviewDrawer
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        projectId={projectId}
        viewUrl={viewUrl}
        hasPdf={hasPdf}
        hasZip={hasZip}
        summary={summary}
        onEmail={() => {
          setPreviewOpen(false);
          setEmailOpen(true);
        }}
      />

      <EmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        projectId={projectId}
        defaultEmail={defaultEmail}
        hasPdf={hasPdf}
        hasZip={hasZip}
        pdfStale={pdfStale}
        zipStale={zipStale}
        emailedAt={emailedAt}
        emailedTo={emailedTo}
      />

      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh this Home Record with the latest data?</AlertDialogTitle>
            <AlertDialogDescription>
              Pulls in photos, selections, decisions, and change orders added since the last
              generate. The link stays the same — anything already shared keeps working. You&apos;ll
              rebuild the PDF and ZIP after (that takes 30–60 seconds). Your approved summary stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={genPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                generate();
              }}
              disabled={genPending}
            >
              {genPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCw className="size-4" />
              )}
              Refresh Home Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Preview drawer — artifact-as-client + format build + ✦ Henry summary ── */
function PreviewDrawer({
  open,
  onOpenChange,
  projectId,
  viewUrl,
  hasPdf,
  hasZip,
  summary,
  onEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  viewUrl: string;
  hasPdf: boolean;
  hasZip: boolean;
  summary: string | null;
  onEmail: () => void;
}) {
  const [pdfPending, startPdf] = useTransition();
  const [zipPending, startZip] = useTransition();
  const [draftPending, startDraft] = useTransition();
  const [keepPending, startKeep] = useTransition();
  const [text, setText] = useState(summary ?? '');

  function buildPdf() {
    startPdf(async () => {
      const res = await generateHomeRecordPdfAction(projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('PDF built.');
    });
  }
  function buildZip() {
    startZip(async () => {
      const res = await generateHomeRecordZipAction(projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('ZIP archive built.');
    });
  }
  function regenSummary() {
    startDraft(async () => {
      const res = await draftHomeRecordSummaryAction(projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setText(res.summary);
      toast.success('Henry drafted a new summary — review it, then Keep.');
    });
  }
  function keepSummary() {
    startKeep(async () => {
      const res = await keepHomeRecordSummaryAction(projectId, text);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Summary saved to the record.');
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Preview &amp; finish</DialogTitle>
          <DialogDescription>
            This is exactly what your client sees — client-safe by construction. Build the PDF + ZIP
            and approve Henry&apos;s summary before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* What the client sees */}
          <div className="flex items-center gap-2 rounded-lg border border-l-[3px] border-l-blue-600 bg-blue-50 px-3 py-2 text-xs dark:bg-blue-900/20">
            <Eye className="size-4 shrink-0 text-blue-700" aria-hidden />
            <span>
              <strong className="font-semibold text-foreground">The client&apos;s view.</strong> No
              margin, cost, supplier, or internal notes ever appear here.{' '}
              <a href={viewUrl} target="_blank" rel="noreferrer" className="font-medium underline">
                Open the live page <ExternalLink className="inline size-3" />
              </a>
            </span>
          </div>

          {/* Format build */}
          <section>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Formats
            </p>
            <p className="text-sm font-semibold">Build PDF + ZIP before sending</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The web link is already live and re-signs on every visit. Build the dated PDF and the
              durable ZIP so your client can tuck them away offline.
            </p>
            <div className="mt-3 space-y-2">
              <FormatRow
                icon={<FileText className="size-4" />}
                name="Branded PDF"
                sub="Photos embedded as bytes · dated snapshot"
                built={hasPdf}
                pending={pdfPending}
                onBuild={buildPdf}
              />
              <FormatRow
                icon={<Archive className="size-4" />}
                name="ZIP archive"
                sub="Photos + docs + README · durable, slowest to build"
                built={hasZip}
                pending={zipPending}
                onBuild={buildZip}
              />
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-l-[3px] border-l-brand bg-card px-3 py-2 text-xs">
              <Sparkles className="size-3.5 shrink-0 text-brand" aria-hidden />
              <span>
                <span className="font-mono font-bold uppercase tracking-wide text-brand">
                  Henry · auto-curated
                </span>{' '}
                — Henry picks the clearest photos so the record stays readable. Every photo is still
                in the ZIP archive — none are deleted.
              </span>
            </div>
          </section>

          {/* ✦ Henry closeout-summary editor */}
          <section>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Project summary
            </p>
            <p className="text-sm font-semibold">Edit the closeout paragraph</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              This sits at the top of the document and is the first thing the client reads. Henry
              drafts it from the snapshot — read it, change it, regenerate it, keep it. The client
              sees it as plain prose (no ✦).
            </p>
            <div className="mt-3 overflow-hidden rounded-lg border">
              <div className="flex items-center gap-1.5 border-b bg-[var(--rust-soft)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wide text-brand">
                <Sparkles className="size-3" aria-hidden />
                Henry draft
              </div>
              <Label htmlFor="hr-summary" className="sr-only">
                Closeout summary
              </Label>
              <Textarea
                id="hr-summary"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                placeholder="Henry will draft a warm one-paragraph summary — or write your own."
                className="rounded-none border-0 focus-visible:ring-0"
              />
              <div className="flex items-center gap-2 border-t bg-paper-soft px-3 py-2">
                <span className="mr-auto font-mono text-[11px] text-muted-foreground">
                  {text.trim().length} chars
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={regenSummary}
                  disabled={draftPending}
                >
                  {draftPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="size-3.5" />
                  )}
                  Regenerate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={keepSummary}
                  disabled={keepPending || !text.trim()}
                >
                  {keepPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Keep
                </Button>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="items-center gap-2 border-t px-5 py-3 sm:justify-between">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            <Check className="size-3.5" aria-hidden />
            Client-safe by construction
          </span>
          <Button type="button" onClick={onEmail}>
            <Mail className="size-4" />
            Email to client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormatRow({
  icon,
  name,
  sub,
  built,
  pending,
  onBuild,
}: {
  icon: React.ReactNode;
  name: string;
  sub: string;
  built: boolean;
  pending: boolean;
  onBuild: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <ReadinessChip
        name={built ? 'Built' : 'Not built'}
        state={built ? 'built' : 'pending'}
        detail=""
      />
      <Button
        type="button"
        variant={built ? 'outline' : 'default'}
        size="sm"
        onClick={onBuild}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {built ? 'Rebuild' : `Build ${name.includes('ZIP') ? 'ZIP' : 'PDF'}`}
      </Button>
    </div>
  );
}

/* ── Email-to-client dialog ── */
function EmailDialog({
  open,
  onOpenChange,
  projectId,
  defaultEmail,
  hasPdf,
  hasZip,
  pdfStale,
  zipStale,
  emailedAt,
  emailedTo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  defaultEmail: string | null;
  hasPdf: boolean;
  hasZip: boolean;
  pdfStale: boolean;
  zipStale: boolean;
  emailedAt: string | null;
  emailedTo: string | null;
}) {
  const tz = useTenantTimezone();
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [pending, startTransition] = useTransition();
  const alreadySent = Boolean(emailedAt);
  const anyStale = (hasPdf && pdfStale) || (hasZip && zipStale);

  function send() {
    startTransition(async () => {
      const res = await emailHomeRecordAction(projectId, {
        overrideEmail: email !== defaultEmail ? email : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Sent to ${res.emailedTo}`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email Home Record to client</DialogTitle>
          <DialogDescription>
            Sends a single email with the permanent web link
            {hasPdf ? ', the PDF download' : ''}
            {hasZip ? ', and the ZIP archive' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="hr-email">Send to</Label>
            <Input
              id="hr-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              required
            />
            {!defaultEmail ? (
              <p className="mt-1 text-xs text-amber-700">
                No email on file for this client — type one to send.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Sent from your business via HeyHenry · reply-to your contact email.
              </p>
            )}
          </div>

          {anyStale ? (
            <div className="flex items-start gap-2 rounded-md border border-l-[3px] border-l-amber-500 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-900/20">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <span>
                <strong className="font-semibold text-foreground">
                  Snapshot was refreshed after the last build.
                </strong>{' '}
                The PDF/ZIP are older than the live link — rebuild fresh formats first, or send the
                web link only.
              </span>
            </div>
          ) : null}

          <div className="rounded-md border bg-paper-soft px-3 py-2 text-xs">
            <p className="font-mono font-bold uppercase tracking-wide text-muted-foreground">
              Will include
            </p>
            <ul className="mt-1.5 space-y-1">
              <li className="flex items-center gap-2 text-foreground">
                <Check className="size-3.5 text-emerald-600" aria-hidden />
                Permanent web link <span className="ml-auto text-muted-foreground">Always</span>
              </li>
              <li
                className={cn(
                  'flex items-center gap-2',
                  hasPdf
                    ? pdfStale
                      ? 'text-amber-700'
                      : 'text-foreground'
                    : 'text-muted-foreground/60',
                )}
              >
                {hasPdf && pdfStale ? (
                  <AlertTriangle className="size-3.5" aria-hidden />
                ) : (
                  <Check
                    className={cn(
                      'size-3.5',
                      hasPdf ? 'text-emerald-600' : 'text-muted-foreground/40',
                    )}
                    aria-hidden
                  />
                )}
                Branded PDF
                <span className="ml-auto">
                  {hasPdf ? (pdfStale ? 'Stale' : 'Built') : 'Not built'}
                </span>
              </li>
              <li
                className={cn(
                  'flex items-center gap-2',
                  hasZip
                    ? zipStale
                      ? 'text-amber-700'
                      : 'text-foreground'
                    : 'text-muted-foreground/60',
                )}
              >
                {hasZip && zipStale ? (
                  <AlertTriangle className="size-3.5" aria-hidden />
                ) : (
                  <Check
                    className={cn(
                      'size-3.5',
                      hasZip ? 'text-emerald-600' : 'text-muted-foreground/40',
                    )}
                    aria-hidden
                  />
                )}
                ZIP archive
                <span className="ml-auto">
                  {hasZip ? (zipStale ? 'Stale' : 'Built') : 'Not built'}
                </span>
              </li>
            </ul>
          </div>

          {alreadySent && emailedTo ? (
            <p className="text-xs text-muted-foreground">
              Last sent to {emailedTo} on {formatDateTime(emailedAt, { timezone: tz })}.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={send} disabled={pending || !email.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {alreadySent ? 'Resend' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
