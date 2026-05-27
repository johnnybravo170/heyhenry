import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { NewProjectFormSurface } from '@/components/features/projects/new-project-page';
import { ProjectForm } from '@/components/features/projects/project-form';
import { listContacts } from '@/lib/db/queries/contacts';
import { loadIntakeDraft } from '@/lib/db/queries/intake-drafts';
import { getDefaultManagementFeeRate } from '@/server/actions/project-defaults';
import { createProjectAction } from '@/server/actions/projects';

export const metadata = {
  title: 'New project — HeyHenry',
};

// Voice-memo intake runs both Whisper transcription AND an Opus parse on
// the resulting transcript inside the same server action. On a typical
// 2-3 min walkthrough we measure ~30s Whisper + ~30s Opus, so 60s left no
// headroom and was timing out mid-parse (losing the transcript). Bumped
// to 120s while we move toward a persisted-transcript two-stage flow.
export const maxDuration = 120;

type RawSearchParams = Record<string, string | string[] | undefined>;

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const customerParam = typeof params.customer === 'string' ? params.customer : null;
  const draftIdParam = typeof params.draft === 'string' ? params.draft : null;
  // Sonnet is the default parse model — on the Tony memo A/B it
  // captured 4 buckets vs gpt-4.1's 3, picked up the leftover-packs
  // detail and the plywood underlayment upsell that gpt-4.1 dropped,
  // and got the address casing right. ?ai=gpt flips back to gpt-4.1
  // for spot-checks.
  const aiChoice = typeof params.ai === 'string' && params.ai === 'gpt' ? 'openai' : 'claude';
  const [customers, initialDraft, defaultMgmtFeeRate] = await Promise.all([
    listContacts({ limit: 500 }),
    draftIdParam ? loadIntakeDraft(draftIdParam) : Promise.resolve(null),
    getDefaultManagementFeeRate(),
  ]);

  // Valid ?customer=<id> means the operator already picked someone (usually
  // by clicking "Start project" from a lead's detail page). Skip the intake
  // drop zone and open the manual form pre-filled — no point re-identifying
  // a contact we already have.
  const preselectedCustomer =
    customerParam && customers.some((c) => c.id === customerParam) ? customerParam : null;

  if (preselectedCustomer) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <Link
            href={`/contacts/${preselectedCustomer}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to contact
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Start project</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The contact&rsquo;s already selected. Fill in the project details and save — creating
            this project will promote them to a customer automatically.
          </p>
        </div>

        <ProjectForm
          mode="create"
          contacts={customers.map((c) => ({ id: c.id, name: c.name }))}
          defaults={{
            contact_id: preselectedCustomer,
            management_fee_rate: defaultMgmtFeeRate,
          }}
          action={createProjectAction}
        />
      </div>
    );
  }

  // Canonical New Project surface: guided intake (drop a quote / photo / voice
  // memo / paste → Henry parses → review + apply scope) is the default, with a
  // toggle to manual typed entry. The old /projects/new?intake=full split is
  // gone — that param now just lands here too. ?draft=<id> hydrates a persisted
  // draft straight into the guided review. ?ai=gpt flips the parse model.
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to projects
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop a quote, photos, sketches, a voice memo — or paste the message. Henry pulls the scope
          and builds a starting estimate for you to review. No document? Enter it manually.
        </p>
        {aiChoice === 'openai' ? (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            Parse model: GPT-4.1 (A/B mode)
          </p>
        ) : null}
      </div>

      <NewProjectFormSurface
        contacts={customers.map((c) => ({ id: c.id, name: c.name }))}
        action={createProjectAction}
        defaults={{ management_fee_rate: defaultMgmtFeeRate }}
        parseModel={aiChoice === 'claude' ? 'claude-sonnet' : 'gpt-4.1'}
        initialDraft={initialDraft}
      />
    </div>
  );
}
