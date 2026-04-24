import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ContactIntakeForm } from '@/components/features/contacts/contact-intake-form';
import { CustomerForm } from '@/components/features/customers/customer-form';
import { type ContactKind, contactKinds } from '@/lib/validators/customer';
import { createCustomerAction } from '@/server/actions/customers';

export const metadata = {
  title: 'New contact — HeyHenry',
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function parseKind(value: string | string[] | undefined): ContactKind | undefined {
  if (typeof value !== 'string') return undefined;
  return (contactKinds as readonly string[]).includes(value) ? (value as ContactKind) : undefined;
}

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const kind = parseKind(params.kind);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to contacts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add a contact</h1>
        <p className="text-sm text-muted-foreground">
          Drop a business card, screenshot, PDF, or paste contact info. Henry extracts what it can —
          or fill it in by hand below.
        </p>
      </header>

      <ContactIntakeForm initialKind={kind} />

      <details className="mt-4 rounded-lg border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Or enter manually (no artifacts)
        </summary>
        <div className="mt-4">
          <CustomerForm mode="create" action={createCustomerAction} cancelHref="/contacts" />
        </div>
      </details>
    </div>
  );
}
