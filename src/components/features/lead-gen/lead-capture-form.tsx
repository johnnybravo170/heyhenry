'use client';

/**
 * Step 2 of the public lead-gen flow: contact info capture.
 *
 * Collects name, email, phone, and optional notes from the homeowner.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type LeadCaptureFormProps = {
  onSubmit: (data: { name: string; email: string; phone: string; notes: string }) => void;
  pending: boolean;
  error: string | null;
};

export function LeadCaptureForm({ onSubmit, pending, error }: LeadCaptureFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!name.trim()) {
      setLocalError('Please enter your name.');
      return;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setLocalError('Please enter a valid phone number.');
      return;
    }

    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), notes: notes.trim() });
  }

  const displayError = error || localError;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="lead-name" className="mb-1 block text-sm font-medium">
          Name *
        </label>
        <Input
          id="lead-name"
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor="lead-email" className="mb-1 block text-sm font-medium">
          Email *
        </label>
        <Input
          id="lead-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="lead-phone" className="mb-1 block text-sm font-medium">
          Phone *
        </label>
        <Input
          id="lead-phone"
          type="tel"
          placeholder="(555) 123-4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoComplete="tel"
        />
      </div>

      <div>
        <label htmlFor="lead-notes" className="mb-1 block text-sm font-medium">
          Message <span className="text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="lead-notes"
          rows={3}
          placeholder="Anything we should know? Access instructions, special requests, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {displayError ? (
        <p className="text-sm text-destructive" role="alert">
          {displayError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? 'Submitting...' : 'Submit'}
      </Button>
    </form>
  );
}
