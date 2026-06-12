'use client';

/**
 * Project Details card — the editable project-settings home.
 *
 * Opened by the `▾` chevron next to the project name in the header. Holds
 * the project-level attributes that used to be scattered across the inline
 * header name editor and the Overview "facts grid": name, customer,
 * description, dates, billing mode, management fee, status. The Crew roster
 * lives here too, injected via `crewSlot`.
 *
 * `▾` = details/attributes (this card). `⋯` = actions (ProjectActionsMenu).
 */

import { Check, ChevronDown, Pencil, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BillingModeEditor } from '@/components/features/projects/billing-mode-editor';
import { ManagementFeeEditor } from '@/components/features/projects/management-fee-editor';
import { MgmtFeeLabourEditor } from '@/components/features/projects/mgmt-fee-labour-editor';
import { ProjectStatusBadge } from '@/components/features/projects/project-status-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import type { LifecycleStage } from '@/lib/validators/project';
import {
  renameProjectAction,
  updateProjectDescriptionAction,
  updateProjectStartDateAction,
  updateProjectTargetEndDateAction,
} from '@/server/actions/projects';

type Props = {
  projectId: string;
  name: string;
  customer: { id: string; name: string } | null;
  description: string | null;
  startDate: string | null;
  targetEndDate: string | null;
  isCostPlus: boolean;
  managementFeeRate: number;
  /** Per-project override — null = inherit tenant default. */
  applyMgmtFeeToLabour: boolean | null;
  /** Tenant default, shown as the resolved value when applyMgmtFeeToLabour is null. */
  tenantApplyMgmtFeeToLabour: boolean;
  lifecycleStage: LifecycleStage;
  /** Crew roster section — injected by the server so the roster checklist
   * (card "Project Hub — Crew split") can hydrate against real workers. */
  crewSlot?: React.ReactNode;
};

export function ProjectDetailsCard({
  projectId,
  name,
  customer,
  description,
  startDate,
  targetEndDate,
  isCostPlus,
  managementFeeRate,
  applyMgmtFeeToLabour,
  tenantApplyMgmtFeeToLabour,
  lifecycleStage,
  crewSlot,
}: Props) {
  const tz = useTenantTimezone();
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Project details"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Project details</DialogTitle>
        </DialogHeader>

        <dl className="divide-y text-sm">
          <Row label="Name">
            <InlineText
              value={name}
              placeholder="Project name"
              onSave={async (next) => {
                const trimmed = next.trim();
                if (!trimmed) return { ok: false, error: 'Name is required.' };
                const res = await renameProjectAction({ id: projectId, name: trimmed });
                return res.ok ? { ok: true } : { ok: false, error: res.error };
              }}
              successMessage="Project renamed"
            />
          </Row>

          <Row label="Customer">
            {customer ? (
              <Link href={`/contacts/${customer.id}`} className="font-medium hover:underline">
                {customer.name} ↗
              </Link>
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </Row>

          <Row label="Description">
            <InlineText
              value={description ?? ''}
              placeholder="Add a description"
              multiline
              onSave={async (next) => {
                const res = await updateProjectDescriptionAction({
                  id: projectId,
                  description: next,
                });
                return res.ok ? { ok: true } : { ok: false, error: res.error };
              }}
              successMessage="Description updated"
            />
          </Row>

          <Row label="Dates">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <DateField
                label="Start"
                value={startDate}
                format={fmtDate}
                onSave={async (next) => {
                  const res = await updateProjectStartDateAction({
                    id: projectId,
                    start_date: next,
                  });
                  return res.ok ? { ok: true } : { ok: false, error: res.error };
                }}
              />
              <span className="text-muted-foreground">→</span>
              <DateField
                label="Target end"
                value={targetEndDate}
                format={fmtDate}
                onSave={async (next) => {
                  const res = await updateProjectTargetEndDateAction({
                    id: projectId,
                    target_end_date: next,
                  });
                  return res.ok ? { ok: true } : { ok: false, error: res.error };
                }}
              />
            </div>
          </Row>

          <Row label="Billing">
            <div className="flex flex-wrap items-center gap-2">
              <BillingModeEditor projectId={projectId} isCostPlus={isCostPlus} />
              {isCostPlus ? (
                <>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <span>·</span> Mgmt fee
                    <ManagementFeeEditor projectId={projectId} rate={managementFeeRate} />
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <MgmtFeeLabourEditor
                    projectId={projectId}
                    applyMgmtFeeToLabour={applyMgmtFeeToLabour}
                    tenantDefault={tenantApplyMgmtFeeToLabour}
                  />
                </>
              ) : null}
            </div>
          </Row>

          <Row label="Status">
            <ProjectStatusBadge stage={lifecycleStage} />
          </Row>
        </dl>

        {crewSlot ? (
          <div className="border-t pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Crew
            </p>
            {crewSlot}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-right">{children}</dd>
    </div>
  );
}

type SaveResult = { ok: true } | { ok: false; error: string };

function InlineText({
  value,
  placeholder,
  multiline,
  onSave,
  successMessage,
}: {
  value: string;
  placeholder: string;
  multiline?: boolean;
  onSave: (next: string) => Promise<SaveResult>;
  successMessage: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isPending, startTransition] = useTransition();

  function cancel() {
    setEditing(false);
    setDraft(value);
  }

  function save() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await onSave(draft);
      if (res.ok) {
        toast.success(successMessage);
        setEditing(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (editing) {
    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) save();
      if (e.key === 'Escape') cancel();
    };
    return (
      <span className="inline-flex w-full items-start justify-end gap-1">
        {multiline ? (
          <Textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={save}
            autoFocus
            disabled={isPending}
            className="text-left text-sm"
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={save}
            autoFocus
            disabled={isPending}
            className="text-left text-sm"
          />
        )}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={save}
          aria-label="Save"
          disabled={isPending}
          className="mt-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
          aria-label="Cancel"
          disabled={isPending}
          className="mt-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="group inline-flex max-w-full items-start gap-1 text-right hover:text-foreground"
    >
      <span className={value ? 'whitespace-pre-wrap break-words' : 'text-muted-foreground'}>
        {value || placeholder}
      </span>
      <Pencil className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function DateField({
  label,
  value,
  format,
  onSave,
}: {
  label: string;
  value: string | null;
  format: (iso: string) => string;
  onSave: (next: string | null) => Promise<SaveResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [isPending, startTransition] = useTransition();

  function save() {
    const next = draft || null;
    if (next === value) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await onSave(next);
      if (res.ok) {
        toast.success(`${label} updated`);
        setEditing(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (editing) {
    return (
      <Input
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') {
            setEditing(false);
            setDraft(value ?? '');
          }
        }}
        onBlur={save}
        autoFocus
        disabled={isPending}
        className="h-7 w-[8.5rem] text-sm"
        aria-label={label}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? '');
        setEditing(true);
      }}
      className="rounded px-1 font-medium hover:bg-muted"
    >
      {value ? (
        format(value)
      ) : (
        <span className="text-muted-foreground">Set {label.toLowerCase()}</span>
      )}
    </button>
  );
}
