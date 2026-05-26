'use client';

/**
 * Client wrapper for /projects/new. Two ways to start a project on one
 * page:
 *   - Drop a quote / photo / voice memo / pasted blurb into the
 *     IntakeAccelerator → Henry parses it into a draft, and we hand off
 *     to the guided scope-review surface (?intake=full&draft=<id>) which
 *     reviews + APPLIES the extracted categories. (Previously the parse
 *     pre-filled only name/description and silently dropped the scope.)
 *   - Type it manually in the ProjectForm below (no document) →
 *     plain createProjectAction, build the budget on the next screen.
 */

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IntakeAccelerator } from '@/components/features/projects/intake-accelerator';
import {
  ProjectForm,
  type ProjectFormCustomerOption,
  type ProjectFormDefaults,
} from '@/components/features/projects/project-form';
import type { ParsedIntake } from '@/lib/ai/intake-prompt';
import type { ProjectInput } from '@/lib/validators/project';
import type { ProjectActionResult } from '@/server/actions/projects';

export function NewProjectFormSurface({
  customers,
  action,
  defaults,
}: {
  customers: ProjectFormCustomerOption[];
  action: (input: ProjectInput & { id?: string }) => Promise<ProjectActionResult>;
  defaults?: ProjectFormDefaults;
}) {
  const router = useRouter();

  function handleParsed(_parsed: ParsedIntake, draftId: string) {
    // Hand off to the guided review, hydrated from the persisted draft.
    // That surface lets the operator confirm the customer, trim/edit the
    // extracted categories + lines, and apply them to a new project in
    // one step — instead of dropping the scope on the floor here.
    toast.success('Henry read it — opening scope review…');
    router.push(`/projects/new?intake=full&draft=${draftId}`);
  }

  return (
    <div className="space-y-6">
      <IntakeAccelerator onParsed={handleParsed} />
      <ProjectForm mode="create" customers={customers} defaults={defaults} action={action} />
    </div>
  );
}
