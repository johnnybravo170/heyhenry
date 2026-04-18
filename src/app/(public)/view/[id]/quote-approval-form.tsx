'use client';

import { useState } from 'react';
import { approveQuotePublicAction, declineQuotePublicAction } from '@/server/actions/quotes';

export function QuoteApprovalForm({
  quoteId,
  businessName,
}: {
  quoteId: string;
  businessName: string;
}) {
  const [mode, setMode] = useState<'pending' | 'accept' | 'decline' | 'done'>('pending');
  const [name, setName] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function handleAccept() {
    if (!name.trim()) {
      setError('Please type your name to accept.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await approveQuotePublicAction(quoteId, name.trim());
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setAccepted(true);
    setMode('done');
    setLoading(false);
  }

  async function handleDecline() {
    setLoading(true);
    setError(null);
    const result = await declineQuotePublicAction(quoteId, declineReason.trim() || undefined);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setAccepted(false);
    setMode('done');
    setLoading(false);
  }

  if (mode === 'done') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        {accepted ? (
          <>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-7 w-7 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                role="img"
                aria-label="Checkmark"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Thank you!</h2>
            <p className="mt-1 text-sm text-gray-600">
              {businessName} will be in touch to schedule your service.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900">Thank you for letting us know</h2>
            <p className="mt-1 text-sm text-gray-600">
              {businessName} may follow up with an updated estimate.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {error ? (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {mode === 'pending' ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode('accept')}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            Accept Estimate
          </button>
          <button
            type="button"
            onClick={() => setMode('decline')}
            className="block w-full text-center text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            Decline
          </button>
        </div>
      ) : null}

      {mode === 'accept' ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Type your name below to accept this estimate.</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Your full name"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={loading}
              className="flex-1 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Accepting...' : 'Confirm Acceptance'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('pending');
                setError(null);
              }}
              disabled={loading}
              className="rounded-md border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'decline' ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Optionally provide a reason for declining.</p>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400"
            placeholder="Reason (optional)"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDecline}
              disabled={loading}
              className="flex-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Declining...' : 'Confirm Decline'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('pending');
                setError(null);
              }}
              disabled={loading}
              className="rounded-md border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
