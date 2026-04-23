'use client';

/**
 * MFA (two-factor authentication) settings card.
 *
 * Phase 1 of MFA_PLAN.md — voluntary enrollment. The card has three modes:
 *
 *   1. Not enrolled: pitch + "Set up" button → opens enrollment dialog.
 *   2. Enrolled: shows status, recovery codes remaining, regenerate + disable.
 *   3. (Transient) Recovery codes dialog: shown once after enroll or
 *      regenerate. Gated by an "I saved these" checkbox before it can close.
 */

import {
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  regenerateRecoveryCodesAction,
  startMfaEnrollmentAction,
  unenrollMfaAction,
  verifyMfaEnrollmentAction,
} from '@/server/actions/mfa';

type Props = {
  enrolled: boolean;
  recoveryCodesRemaining: number;
};

export function MfaCard({ enrolled, recoveryCodesRemaining }: Props) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [codesDialog, setCodesDialog] = useState<string[] | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {enrolled ? (
              <ShieldCheck className="size-5 text-green-600" />
            ) : (
              <ShieldAlert className="size-5 text-muted-foreground" />
            )}
            <div>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>
                {enrolled
                  ? 'Your account is protected with an authenticator app.'
                  : 'Protect your account with an authenticator app (Authy, 1Password, Google Authenticator).'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {enrolled ? (
            <>
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Recovery codes remaining</span>
                <span
                  className={
                    recoveryCodesRemaining <= 2 ? 'font-medium text-destructive' : 'font-medium'
                  }
                >
                  {recoveryCodesRemaining} / 10
                </span>
              </div>
              {recoveryCodesRemaining <= 2 ? (
                <p className="text-sm text-destructive">
                  You&apos;re low on recovery codes. Regenerate a new set before you run out.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setRegenerateOpen(true)}>
                  <KeyRound className="mr-2 size-4" />
                  Regenerate recovery codes
                </Button>
                <Button variant="ghost" onClick={() => setDisableOpen(true)}>
                  Disable 2FA
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={() => setEnrollOpen(true)} className="w-fit">
              Set up two-factor authentication
            </Button>
          )}
        </CardContent>
      </Card>

      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onCodesIssued={(codes) => {
          setEnrollOpen(false);
          setCodesDialog(codes);
        }}
      />

      <RegenerateDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        onCodesIssued={(codes) => {
          setRegenerateOpen(false);
          setCodesDialog(codes);
        }}
      />

      <DisableDialog open={disableOpen} onOpenChange={setDisableOpen} />

      <RecoveryCodesDialog codes={codesDialog} onClose={() => setCodesDialog(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Enrollment dialog — start → show QR → verify → issue codes
// ---------------------------------------------------------------------------

function EnrollDialog({
  open,
  onOpenChange,
  onCodesIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCodesIssued: (codes: string[]) => void;
}) {
  const router = useRouter();
  const [starting, startStartTransition] = useTransition();
  const [verifying, startVerifyTransition] = useTransition();
  const [factor, setFactor] = useState<{
    factorId: string;
    qrCodeSvg: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFactor(null);
    setCode('');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleStart() {
    setError(null);
    startStartTransition(async () => {
      const result = await startMfaEnrollmentAction();
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setFactor({
        factorId: result.factorId,
        qrCodeSvg: result.qrCodeSvg,
        secret: result.secret,
      });
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factor) return;
    setError(null);
    startVerifyTransition(async () => {
      const result = await verifyMfaEnrollmentAction({ factorId: factor.factorId, code });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success('Two-factor authentication enabled.');
      reset();
      router.refresh();
      onCodesIssued(result.recoveryCodes);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up two-factor authentication</DialogTitle>
          <DialogDescription>
            {factor
              ? 'Scan the QR code, then enter the 6-digit code from your authenticator app.'
              : 'You&apos;ll need an authenticator app like Authy, 1Password, or Google Authenticator.'}
          </DialogDescription>
        </DialogHeader>

        {!factor ? (
          <DialogFooter>
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={starting}>
              {starting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Continue
            </Button>
          </DialogFooter>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex justify-center rounded-md border bg-white p-4">
              {/* Supabase returns an <svg> string — safe to inline. */}
              <div
                className="size-48"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: QR SVG from Supabase is trusted content generated server-side for this session.
                dangerouslySetInnerHTML={{ __html: factor.qrCodeSvg }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Can&apos;t scan? Enter this code manually:
              </Label>
              <code className="block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">
                {factor.secret}
              </code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfa-code">6-digit code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={verifying}
                placeholder="123456"
              />
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={verifying}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={verifying || code.length !== 6}>
                {verifying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Verify &amp; enable
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Regenerate recovery codes
// ---------------------------------------------------------------------------

function RegenerateDialog({
  open,
  onOpenChange,
  onCodesIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCodesIssued: (codes: string[]) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCode('');
      setError(null);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await regenerateRecoveryCodesAction({ code });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success('New recovery codes generated. Old codes are no longer valid.');
      setCode('');
      router.refresh();
      onCodesIssued(result.recoveryCodes);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Regenerate recovery codes</DialogTitle>
          <DialogDescription>
            Enter your current 6-digit code to generate a fresh set of 10 recovery codes. Your
            previous codes will be invalidated.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="regen-code">6-digit code</Label>
            <Input
              id="regen-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={pending}
              placeholder="123456"
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || code.length !== 6}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Regenerate codes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Disable 2FA
// ---------------------------------------------------------------------------

function DisableDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCode('');
      setError(null);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await unenrollMfaAction({ code });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success('Two-factor authentication disabled.');
      setCode('');
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
          <DialogDescription>
            Your account will be less secure. Enter your current 6-digit code to confirm.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disable-code">6-digit code</Label>
            <Input
              id="disable-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={pending}
              placeholder="123456"
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || code.length !== 6}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Disable 2FA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Recovery codes display — shown once after enroll or regenerate.
// ---------------------------------------------------------------------------

function RecoveryCodesDialog({ codes, onClose }: { codes: string[] | null; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const open = codes !== null;

  function handleOpenChange(next: boolean) {
    if (!next && confirmed) {
      setConfirmed(false);
      onClose();
    }
    // Otherwise swallow the close — we want the user to check the box.
  }

  function handleCopyAll() {
    if (!codes) return;
    navigator.clipboard.writeText(codes.join('\n')).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Could not copy'),
    );
  }

  function handleDownload() {
    if (!codes) return;
    const blob = new Blob(
      [
        `HeyHenry recovery codes\n`,
        `Generated: ${new Date().toISOString()}\n\n`,
        `Each code works once. Keep them somewhere safe.\n\n`,
        codes.join('\n'),
        '\n',
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heyhenry-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleDone() {
    setConfirmed(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-green-600" />
            Save your recovery codes
          </DialogTitle>
          <DialogDescription>
            Each code works exactly once. Store them in a password manager or print them.{' '}
            <strong>This is the only time you&apos;ll see them.</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
          {codes?.map((c) => (
            <div key={c} className="tabular-nums">
              {c}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyAll}>
            <Copy className="mr-2 size-4" />
            Copy all
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-2 size-4" />
            Download .txt
          </Button>
        </div>
        <div className="flex items-start gap-2 pt-2">
          <Checkbox
            id="confirm-saved"
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(v === true)}
          />
          <Label htmlFor="confirm-saved" className="text-sm font-normal leading-snug">
            I&apos;ve saved my recovery codes somewhere safe.
          </Label>
        </div>
        <DialogFooter>
          <Button disabled={!confirmed} onClick={handleDone}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
