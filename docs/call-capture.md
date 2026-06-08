# Founding-member call capture — consent, redaction, retention

The route half of the capture pipeline (card `657092a5`). Recording +
transcription + diarization are done by an external tool; this repo only
ingests the resulting transcript and routes it. Code: `POST
/api/ops/calls/ingest` → `ops/src/server/ops-services/call-ingest.ts`.

## The seam (tool-agnostic input contract)

Whatever recorder you use needs a thin adapter that POSTs this shape:

```jsonc
{
  "source": "fathom",                  // your recorder
  "title": "Onboarding — Mike (Abbotsford GC)",
  "occurred_at": "2026-05-29T18:00:00Z",
  "consent": true,                     // MUST be true — see Consent
  "participants": [
    { "name": "Jonathan", "role": "operator" },
    { "name": "Mike",     "role": "contractor" },
    { "name": "Susan",    "role": "client" }      // homeowner/client names get redacted
  ],
  "segments": [
    { "speaker": "Jonathan", "role": "operator", "ts_seconds": 12, "text": "..." },
    { "speaker": "Mike",     "role": "contractor", "text": "no wait, that's not what I asked" }
  ]
}
```

Auth: `Authorization: Bearer $CRON_SECRET`.

## Consent (PIPEDA — non-negotiable)

- Explicit verbal consent **at the start of the call**: *"I'm recording this so
  we can make Henry better for you — that ok?"*
- The adapter sets `consent: true` only when that happened. The ingest
  **refuses** (`422`) any transcript with `consent !== true`. No exceptions.

## Redaction (before anything is stored)

Done in `redact()` before the transcript reaches any sink:

- **Removed:** phone numbers, emails, CA postal codes, street addresses, and
  the names of any participant whose role is `client`/`homeowner` (full name +
  each name token ≥3 chars → `[client]`).
- **Kept:** operator + contractor speaker names — they're the voices we learn
  from, and they've consented.
- Conservative by design: over-redaction beats leaking a homeowner's details
  into a corpus an agent reads. If a new PII class shows up, add a pattern to
  `call-ingest.ts` — don't loosen.

## Retention

- **Raw recordings:** live only in the recording tool. This pipeline never
  receives or stores audio. Set the tool's retention to ~30-day rolling.
- **Transcripts:** stored (redacted) as `customer-call` knowledge docs,
  retained indefinitely — they're the durable learning artifact.

## Where each call goes (sinks)

1. **Knowledge doc** (`ops.knowledge_docs`, tags `customer-call` +
   `henry-behavioral`, embedded for search) — Henry + agents read it.
2. **`eval-candidate` ideas** — every operator/contractor correction
   ("no wait", "that's not what I asked", …) becomes an idea tagged
   `eval-candidate` with redacted context, feeding the Henry eval suite
   (`evals/henry`). Review and convert real ones into scenarios.
3. **Worklog audit** — one entry per ingest naming the sinks written.

Dedup: one ingest per `(date, first participant)` via a `call:<date>:<slug>`
tag on the knowledge doc.

## Deferred (no live consumer yet)

A dedicated Henry behavioral corpus and the activation-watchdog queue
(card `8b47758f`, not built). Adding those sinks is a one-liner in
`call-ingest.ts` once a consumer exists — don't build sinks nothing reads.
