import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold tracking-tight">HeyHenry</h1>
      <p className="mt-2 text-muted-foreground">build in progress</p>
      <Link
        href="/login"
        className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Log in
      </Link>
    </main>
  );
}
