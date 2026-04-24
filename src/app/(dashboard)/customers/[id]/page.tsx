import { permanentRedirect } from 'next/navigation';

export default async function CustomerDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/contacts/${id}`);
}
