import { permanentRedirect } from 'next/navigation';

export default async function EditCustomerRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/contacts/${id}/edit`);
}
