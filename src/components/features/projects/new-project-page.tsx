'use client';

/**
 * Client wrapper for /projects/new. One canonical intake, two entry modes:
 *
 *   - GUIDED (default, "drop the mess"): the LeadIntakeForm — drop a quote /
 *     photo / voice memo / paste a blurb, Henry parses the scope, and the
 *     operator reviews + applies the extracted categories to a new project.
 *     This is the universal intake surface; it self-contains parse → review →
 *     apply (incl. customer dedup) via acceptInboundLeadAction.
 *   - MANUAL: the plain ProjectForm for a typed create with no document.
 *
 * Replaces the old split where a slim "accelerator" pre-filled the manual form
 * (and dropped the parsed scope) and the real review lived behind a separate
 * /projects/new?intake=full route. There's no bifurcation now — guided is the
 * default surface; manual is a toggle.
 */

import { useState } from 'react';
import { LeadIntakeForm } from '@/components/features/leads/lead-intake-form';
import {
  ProjectForm,
  type ProjectFormContactOption,
  type ProjectFormDefaults,
} from '@/components/features/projects/project-form';
import type { IntakeDraftRow } from '@/lib/db/queries/intake-drafts';
import type { ProjectInput } from '@/lib/validators/project';
import type { ParseModelChoice } from '@/server/actions/intake';
import type { ProjectActionResult } from '@/server/actions/projects';

export function NewProjectFormSurface({
  contacts,
  action,
  defaults,
  parseModel = 'claude-sonnet',
  initialDraft = null,
}: {
  contacts: ProjectFormContactOption[];
  action: (input: ProjectInput & { id?: string }) => Promise<ProjectActionResult>;
  defaults?: ProjectFormDefaults;
  parseModel?: ParseModelChoice;
  /** When the page is opened with ?draft=<id>, the persisted draft is
   *  hydrated into the guided review so the operator resumes mid-flow. */
  initialDraft?: IntakeDraftRow | null;
}) {
  const [mode, setMode] = useState<'guided' | 'manual'>('guided');

  if (mode === 'manual') {
    return (
      <div className="space-y-4">
        <ProjectForm mode="create" contacts={contacts} defaults={defaults} action={action} />
        <p className="text-center text-xs text-muted-foreground">
          Got a quote, photos, or a voice memo?{' '}
          <button
            type="button"
            onClick={() => setMode('guided')}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Drop it in instead →
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LeadIntakeForm parseModel={parseModel} initialDraft={initialDraft} />
      <p className="text-center text-xs text-muted-foreground">
        No document?{' '}
        <button
          type="button"
          onClick={() => setMode('manual')}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Enter the project manually →
        </button>
      </p>
    </div>
  );
}
