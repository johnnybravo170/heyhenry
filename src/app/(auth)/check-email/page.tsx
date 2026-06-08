import { Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Confirmation that a magic-link email was dispatched. Reads the
 * `?email=` query param via Next.js 16's async `searchParams` prop on
 * server components.
 */

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Card>
      <CardHeader>
        {/* Rust-soft icon circle — 44px, rounded-xl per OD spec */}
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand/10">
          <Mail className="size-5 text-brand" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl">Check your inbox</CardTitle>
        <CardDescription>
          {email ? (
            <>
              We sent a sign-in link to <strong>{email}</strong>.
            </>
          ) : (
            <>We sent you a sign-in link.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Click the link in the email to land back here, signed in. You can close this tab once you
          do.
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
