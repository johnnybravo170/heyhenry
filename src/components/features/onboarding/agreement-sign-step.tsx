'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import type { AgreementType } from '@/lib/agreements/registry';
import { recordAgreementAcceptanceAction } from '@/server/actions/agreements';

/**
 * In-app e-signature step for a signable agreement. Renders the agreement
 * body in a scrollable region, then a typed-name signature + agree checkbox.
 * Mirrors the change-order / estimate approval e-sign pattern (typed name =
 * signature, encrypted + timestamped + logged). On success, routes to
 * `nextHref` (the checkout/plan page).
 */
export function AgreementSignStep({
  type,
  title,
  intro,
  bodyMarkdown,
  nextHref,
}: {
  type: AgreementType;
  title: string;
  intro: string;
  bodyMarkdown: string;
  nextHref: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSign() {
    if (!name.trim()) {
      setError('Please type your full name to sign.');
      return;
    }
    if (!agreed) {
      setError('Please check the box to confirm you have read and agree.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await recordAgreementAcceptanceAction({ type, signatureName: name.trim() });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      toast.error(res.error);
      return;
    }
    toast.success('Agreement signed. Thank you.');
    router.push(nextHref);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[45vh] overflow-y-auto rounded-md border bg-muted/30 p-4">
          <RichTextDisplay markdown={bodyMarkdown} />
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex items-start gap-2">
          <Checkbox
            id="agree"
            checked={agreed}
            onCheckedChange={(v) => {
              setAgreed(v === true);
              setError(null);
            }}
            disabled={loading}
            className="mt-0.5"
          />
          <Label htmlFor="agree" className="text-sm font-normal leading-snug">
            I have read and agree to the {title} on behalf of my business.
          </Label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="esig-name">Your full name</Label>
          <Input
            id="esig-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Type your full name to sign"
            disabled={loading}
          />
        </div>

        <Button onClick={handleSign} disabled={loading} className="w-full">
          {loading ? 'Signing…' : 'Sign and continue'}
        </Button>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
          Your typed name is your e-signature. Encrypted, timestamped, and logged with the date and
          version you signed.
        </p>
      </CardContent>
    </Card>
  );
}
