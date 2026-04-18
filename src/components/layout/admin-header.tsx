import Link from 'next/link';

export function AdminHeader({ email }: { email?: string | null }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Platform Admin</span>
        {email ? (
          <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          Operator view
        </Link>
        <Link href="/logout" className="text-xs text-muted-foreground hover:text-foreground">
          Logout
        </Link>
      </div>
    </header>
  );
}
