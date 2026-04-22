# Universal Project Intake — Spec

**Supersedes** `INBOUND_LEAD_V1_SPEC.md`.

**Goal:** One drop zone per project. Operator drops anything (screenshots, photos, sketches, PDF quotes, drawings, receipts). Henry classifies, integrates, and shows a single review screen.

**Ethos:** project page is the contractor's source of truth. The drop zone is their simple way to add anything to it.

---

## Surfaces

1. `/leads/new` — drops create a NEW project. Same page we built; now accepts more file types.
2. `/projects/[id]` — persistent dropzone augments an EXISTING project. New, and the bigger user value.

Same dispatcher behind both. Difference is `mode: 'create' | 'augment'` + the existing-project context passed in.

---

## Pipeline

```
files dropped
   └─> upload to staging (intake/<temp-uuid>/)
        └─> single multi-modal call (Gemini 2.0 flash; or GPT-4o for parity)
             ├─> in: all files + project context (if augment mode)
             └─> out: per-artifact role + suggested actions
        └─> review screen (per-suggestion accept/reject)
        └─> on accept: write DB + move staged files into project storage
```

No separate classifier dispatcher. Single prompt that handles all artifact types.

---

## Suggested-action types (V1)

The model returns a flat list of `Suggestion`s. Each one is independently accept/rejectable.

```ts
type Suggestion =
  | { kind: 'set_project_field'; field: 'name' | 'description'; value: string }
  | { kind: 'set_customer_field'; field: 'phone' | 'email' | 'address'; value: string }
  | { kind: 'add_bucket'; name: string; section: string | null }
  | { kind: 'add_line'; bucket_name: string; label: string; notes: string | null;
      qty: number; unit: string; unit_price_cents: number | null;
      attach_artifact_indexes: number[] }
  | { kind: 'attach_photo_to_line'; line_label_match: string; artifact_index: number }
  | { kind: 'set_signal'; signals: ParsedIntakeSignals }   // competitive, urgency, etc
  | { kind: 'draft_reply'; text: string }                  // text-thread reply
  | { kind: 'attach_doc'; artifact_index: number; label: string }  // PDF spec, drawing
```

For augment mode, the model is also told the existing buckets and tries to reuse names rather than create duplicates.

---

## Artifact roles

Per artifact (image or PDF), the model emits:

```ts
type ArtifactRole =
  | 'conversation_screenshot'
  | 'reference_photo'
  | 'sketch_with_measurements'
  | 'pdf_quote'
  | 'pdf_doc'
  | 'receipt'
  | 'inspiration'
  | 'other';
```

Audio is **out of V1** scope.

---

## Data model deltas

Already shipped in `0075_project_intake.sql`:
- `projects.intake_source`
- `projects.intake_signals`

New for universal intake:

```sql
-- Storage: artifacts persisted to a per-project intake folder.
-- No new table; the storage bucket prefix is `projects/<project_id>/intake/`.

-- Track each accepted artifact for audit + UI ("show me everything they dropped").
CREATE TABLE public.project_intake_artifacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,         -- inside the existing project-files bucket
  filename     TEXT NOT NULL,
  mime         TEXT NOT NULL,
  role         TEXT NOT NULL,         -- ArtifactRole
  tags         TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pia_project ON public.project_intake_artifacts(project_id);
ALTER TABLE public.project_intake_artifacts ENABLE ROW LEVEL SECURITY;
-- (RLS policies follow existing project-tenant pattern)
```

---

## UI

### Universal drop zone component

Reusable component `<UniversalDropZone projectId? />`. Renders:

- A friendly drop area: "Drop screenshots, photos, sketches, PDFs — anything for this project. Henry will sort it."
- Shows a queue of staged files with thumbnails as they're added.
- "Process" button kicks the parser.
- After processing, slides into a review modal (or in-page section).

### Review screen

Each suggestion is a small card:
- Icon based on kind
- One-line summary ("Add bucket: Fireplace", "Attach photo to: Floors line")
- [Accept] [Reject] [Edit] buttons
- "Accept all" / "Reject all" header buttons

After all decisions made: [Apply].

---

## Phasing

- **Phase 1a (current build)**: project-page drop zone, screenshots + reference photos only, augment mode. Reuses the existing `intake.ts` parser with project context added.
- **Phase 1b**: PDF support (existing `parse-quote-pdf.ts` collapsed into the unified call).
- **Phase 1c**: photo storage upload + actual attachment to existing cost lines.
- **Phase 2**: receipt routing (link to existing `extract-receipt.ts` for project-context expenses).
- **Phase 3**: audio memos (Whisper).
- **Phase 4**: inline reclassify override on each artifact.

---

## Open questions

- Storage bucket name for project files — does one already exist? If not, create `project-files` bucket in Supabase Storage with RLS.
- Vendor: Gemini vs OpenAI for the unified call. `parse-quote-pdf.ts` uses Gemini for PDFs; `intake.ts` uses GPT-4o-mini for images. For unified, pick one. Recommend **Gemini 2.0 flash** — handles images + PDFs natively in one call, faster, cheaper.
- Pricing line: per-tenant monthly intake call cap to bound cost.
