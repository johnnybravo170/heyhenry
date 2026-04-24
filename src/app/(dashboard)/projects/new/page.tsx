import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { LeadIntakeForm } from '@/components/features/leads/lead-intake-form';
import { ProjectForm } from '@/components/features/projects/project-form';
import { listCustomers } from '@/lib/db/queries/customers';
import { createProjectAction } from '@/server/actions/projects';

export const metadata = {
  title: 'New project — HeyHenry',
};

export default async function NewProjectPage() {
  const customers = await listCustomers({ limit: 500 });

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
          Drop screenshots, photos, sketches, PDFs (sub-trade quotes, drawings) — or paste the
          message. Henry will extract scope, build a starting estimate, and draft a reply.
        </p>
      </div>

      <LeadIntakeForm />

      <details className="mt-8 rounded-lg border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Or enter manually (existing customer, no artifacts)
        </summary>
        <div className="mt-4">
          <ProjectForm
            mode="create"
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            action={createProjectAction}
          />
        </div>
      </details>
    </div>
  );
}
