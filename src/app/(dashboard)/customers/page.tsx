import { permanentRedirect } from 'next/navigation';

type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * /customers → /contacts (Slice B of the contacts-unification rollout).
 * Preserves any search params (q, type) so bookmarked filters keep working.
 */
export default async function CustomersRedirect({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') qs.set(k, v);
    else if (Array.isArray(v)) for (const item of v) qs.append(k, item);
  }
  const query = qs.toString();
  permanentRedirect(query ? `/contacts?${query}` : '/contacts');
}
