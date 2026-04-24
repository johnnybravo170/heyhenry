import { permanentRedirect } from 'next/navigation';

export default function NewCustomerRedirect() {
  permanentRedirect('/contacts/new');
}
