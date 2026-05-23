'use client';

import { BellOff } from 'lucide-react';
import Link from 'next/link';
import { Money } from '@/components/ui/money';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ContactRow, ContactSignal } from '@/lib/db/queries/customers';
import { formatPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { type ContactKind, contactKindLabels } from '@/lib/validators/customer';
import { CustomerTypeBadge } from './customer-type-badge';

/** Leads newer than this read as "New"; older lean to the muted stale cue. */
const LEAD_FRESH_DAYS = 7;

/** Mobile section order — most actionable kinds first. */
const KIND_ORDER: ContactKind[] = [
  'lead',
  'customer',
  'vendor',
  'sub',
  'inspector',
  'referral',
  'other',
  'agent',
];

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function daysSince(iso: string, nowMs: number): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((nowMs - then) / 86_400_000));
}

/** Phone-first reach: phone is primary (tap-to-call), email muted secondary. */
function Reach({ customer }: { customer: ContactRow }) {
  if (!customer.phone && !customer.email) {
    return <span className="italic text-muted-foreground/70">No contact on file</span>;
  }
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {customer.phone ? (
        <a
          href={telHref(customer.phone)}
          className="relative z-10 w-fit font-semibold tabular-nums text-foreground hover:underline"
        >
          {formatPhone(customer.phone)}
        </a>
      ) : null}
      {customer.email ? (
        <a
          href={`mailto:${customer.email}`}
          className="relative z-10 w-fit truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {customer.email}
        </a>
      ) : null}
    </div>
  );
}

/** The one signal: "does this contact matter right now?" — varies by kind. */
function Signal({
  signal,
  kind,
  createdAt,
  nowMs,
}: {
  signal: ContactSignal;
  kind: ContactKind;
  createdAt: string;
  nowMs: number;
}) {
  if (kind === 'lead') {
    const age = daysSince(createdAt, nowMs);
    if (age <= LEAD_FRESH_DAYS) {
      return (
        <span className="text-sm">
          <span className="font-medium text-amber-700 dark:text-amber-400">New</span>
          <span className="mx-1.5 text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">{age}d ago</span>
        </span>
      );
    }
    return (
      <span className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">No project yet</span>
        <span className="mx-1.5 text-muted-foreground/60">·</span>
        {age}d
      </span>
    );
  }

  if (kind === 'customer') {
    const parts: { key: string; node: React.ReactNode }[] = [];
    if (signal.activeProjects > 0) {
      parts.push({
        key: 'active',
        node: (
          <>
            <span className="font-medium tabular-nums">{signal.activeProjects}</span> active
          </>
        ),
      });
    }
    if (signal.arDueCents !== null && signal.arDueCents > 0) {
      parts.push({
        key: 'ar',
        node: (
          <>
            <Money cents={signal.arDueCents} emphasis className="font-semibold" /> due
          </>
        ),
      });
    }
    if (parts.length === 0) {
      return <span className="text-muted-foreground/70">—</span>;
    }
    return (
      <span className="text-sm">
        {parts.map((p, i) => (
          <span key={p.key}>
            {i > 0 ? <span className="mx-1.5 text-muted-foreground/60">·</span> : null}
            {p.node}
          </span>
        ))}
      </span>
    );
  }

  return <span className="text-muted-foreground/70">—</span>;
}

function MessagingOff() {
  return (
    <span
      className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      title="CASL: auto-messaging off for this contact"
    >
      <BellOff className="size-3" aria-hidden />
      Messaging off
    </span>
  );
}

/**
 * Contacts directory. Desktop = a four-column table (Kind · Name · Reach ·
 * Signal); mobile = cards grouped by kind. The whole row navigates to the
 * detail page via a stretched overlay link (PATTERNS: row-as-link) — the
 * phone/email links sit above it (`z-10`) so tap-to-call still works.
 */
export function CustomerTable({
  customers,
  nowMs,
  footer,
}: {
  customers: ContactRow[];
  /** Server-stable timestamp for relative-time rendering (avoids hydration drift). */
  nowMs: number;
  /** Pagination footer rendered inside the table card (desktop) / below cards (mobile). */
  footer?: React.ReactNode;
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Kind</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[240px]">Reach</TableHead>
              <TableHead>Signal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow
                key={customer.id}
                className="relative transition-colors hover:bg-muted/50 focus-within:bg-muted/50"
              >
                <TableCell className="align-top">
                  <CustomerTypeBadge type={customer.type} kind={customer.kind} withSubtype />
                </TableCell>
                <TableCell className="align-top">
                  <Link
                    href={`/contacts/${customer.id}`}
                    className="text-base font-bold text-foreground after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:underline"
                  >
                    {customer.name}
                  </Link>
                  {customer.do_not_auto_message ? (
                    <div>
                      <MessagingOff />
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="align-top">
                  <Reach customer={customer} />
                </TableCell>
                <TableCell className="align-top">
                  <Signal
                    signal={customer.signal}
                    kind={customer.kind}
                    createdAt={customer.created_at}
                    nowMs={nowMs}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {footer}
      </div>

      {/* Mobile cards, grouped by kind */}
      <div className="flex flex-col gap-5 md:hidden">
        {KIND_ORDER.map((kind) => {
          const rows = customers.filter((c) => c.kind === kind);
          if (rows.length === 0) return null;
          return (
            <section key={kind} className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {contactKindLabels[kind]} <span className="tabular-nums">{rows.length}</span>
              </h2>
              {rows.map((customer) => (
                // Card is a div, not a link: the name uses a stretched overlay
                // link (after:absolute) so the whole card is tappable WITHOUT
                // nesting the tel:/mailto: anchors inside an outer <a> (invalid
                // HTML → hydration mismatch). Reach links sit above via z-10.
                <div
                  key={customer.id}
                  className={cn(
                    'relative flex flex-col gap-2 rounded-xl border bg-card p-4',
                    'focus-within:ring-2 focus-within:ring-ring',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/contacts/${customer.id}`}
                      className="font-semibold after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none"
                    >
                      {customer.name}
                    </Link>
                    <CustomerTypeBadge type={customer.type} kind={customer.kind} />
                  </div>
                  <div className="relative z-10 w-fit">
                    <Reach customer={customer} />
                  </div>
                  <div className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Signal
                      signal={customer.signal}
                      kind={customer.kind}
                      createdAt={customer.created_at}
                      nowMs={nowMs}
                    />
                    {customer.do_not_auto_message ? <MessagingOff /> : null}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
        {footer ? <div className="overflow-hidden rounded-xl border bg-card">{footer}</div> : null}
      </div>
    </>
  );
}
