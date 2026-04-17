'use client';

import { Check, Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function ReferralLinkCard({ url, code }: { url: string; code: string }) {
  const [copied, setCopied] = useState(false);

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
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Try HeyHenry',
          text: 'I use HeyHenry to run my contracting business. Check it out!',
          url,
        });
      } catch {
        // User cancelled share — not an error.
      }
    } else {
      await copyLink();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your referral link</CardTitle>
        <CardDescription>Share this link with other contractors.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input value={url} readOnly className="font-mono text-sm" />
          <Button variant="outline" size="icon" onClick={copyLink} title="Copy link">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={shareLink} title="Share link">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Code: {code}</p>
      </CardContent>
    </Card>
  );
}
