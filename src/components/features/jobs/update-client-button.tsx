'use client';

import { Send } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { approvePulseAction, draftPulseAction, editPulseDraftAction } from '@/server/actions/pulse';

/**
 * "Update Client" — Project Pulse trigger on the job detail page.
 *
 * Click → drafts (or reuses an unsent draft) → opens an inline editor →
 * Approve & Send fires the SMS+email.
 */
export function UpdateClientButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    const res = await draftPulseAction(jobId);
    if (!res.ok) {
      toast.error(res.error);
      setOpen(false);
      setLoading(false);
      return;
    }
    setUpdateId(res.id);

    // Pull the body so we can show it.
    const data = await fetch(`/api/pulse/${res.id}`).catch(() => null);
    const json = data ? await data.json().catch(() => null) : null;
    setBody(json?.body_md ?? '');
    setLoading(false);
  }

  function handleApprove() {
    if (!updateId) return;
    startTransition(async () => {
      const saved = await editPulseDraftAction({ updateId, body_md: body });
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      const sent = await approvePulseAction(updateId);
      if (!sent.ok) {
        toast.error(sent.error);
        return;
      }
      toast.success('Update sent to client.');
      setOpen(false);
      setUpdateId(null);
      setBody('');
    });
  }

  return (
    <>
      <Button type="button" variant="default" size="sm" onClick={handleOpen}>
        <Send className="size-3.5" />
        Update Client
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send a project update</DialogTitle>
            <DialogDescription>
              Henry drafted this from the latest task activity. Edit anything before sending — the
              client will get an SMS and email with a link to view it.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Drafting update from your latest tasks…
            </p>
          ) : (
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="font-mono text-sm"
            />
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={pending || loading || !body.trim()}>
              {pending ? 'Sending…' : 'Approve & Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
