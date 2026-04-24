import { permanentRedirect } from 'next/navigation';

/**
 * /leads/new → /contacts/new?kind=customer (Slice E of the contacts-
 * unification rollout). The LeadIntakeForm that used to live here is now
 * rendered inside the unified ContactIntakeForm at /contacts/new when
 * kind=customer is selected.
 */
export default function NewLeadRedirect() {
  permanentRedirect('/contacts/new?kind=customer');
}
