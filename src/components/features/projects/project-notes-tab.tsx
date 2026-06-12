'use client';

/**
 * Unified Notes feed for a project. One chronological list mixing:
 *   - Operator notes (plain text)
 *   - Voice memos (audio + transcript)
 *   - System / intake events from worklog_entries
 *
 * "Leave a memo" still works (existing MemoUpload), tucked behind a
 * button so the primary surface is the feed and the inline note input.
 */

import { Lock, Mic, Play, Sparkles, StickyNote, Trash2, User as UserIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MemoUpload, type MemoUploadProps } from '@/components/features/memos/memo-upload';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { formatDateTime } from '@/lib/date/format';
import {
  addProjectNoteAction,
  askHenryAboutProjectAction,
  deleteProjectNoteAction,
} from '@/server/actions/project-notes';

export type NoteFeedItem =
  | {
      kind: 'note';
      id: string;
      created_at: string;
      body: string;
      author_name: string | null;
    }
  | {
      kind: 'reply_draft';
      id: string;
      created_at: string;
      body: string;
    }
  | {
      kind: 'henry_q';
      id: string;
      created_at: string;
      body: string;
    }
  | {
      kind: 'henry_a';
      id: string;
      created_at: string;
      body: string;
    }
  | {
      kind: 'artifact';
      id: string;
      created_at: string;
      body: string;
      artifact_kind: string; // 'sketch' | 'inspiration' | 'drawing'
      label: string;
      image_url: string | null;
    }
  | {
      kind: 'memo';
      id: string;
      created_at: string;
      transcript: string | null;
      status: string;
    }
  | {
      kind: 'event';
      id: string;
      created_at: string;
      title: string | null;
      body: string | null;
      entry_type: string;
    };

export function ProjectNotesTab({
  projectId,
  feed,
  memoUploadProps,
}: {
  projectId: string;
  feed: NoteFeedItem[];
  /** Props passed straight to MemoUpload (memos list, photos, etc). */
  memoUploadProps: MemoUploadProps;
}) {
  const [draft, setDraft] = useState('');
  const [henryQ, setHenryQ] = useState('');
  const [isAdding, startAdding] = useTransition();
  const [isAsking, startAsking] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [memoOpen, setMemoOpen] = useState(false);

  function handleAdd() {
    const body = draft.trim();
    if (!body) return;
    startAdding(async () => {
      const res = await addProjectNoteAction({ projectId, body });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDraft('');
      toast.success('Note added');
    });
  }

  function handleAskHenry() {
    const q = henryQ.trim();
    if (!q) return;
    startAsking(async () => {
      const res = await askHenryAboutProjectAction({ projectId, question: q });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHenryQ('');
      // The Q + A land in the feed below as a henry_q / henry_a pair — this is
      // an action, not a chat thread. Confirm so the operator looks down.
      toast.success('Henry answered — added to the feed below.');
    });
  }

  function handleDelete(noteId: string) {
    startDeleting(async () => {
      const res = await deleteProjectNoteAction({ noteId, projectId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Internal-only banner — the Notes feed is never visible to the client. */}
      <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Lock className="size-3 shrink-0" aria-hidden />
        Internal only · never visible to the client
      </div>

      {/* Inline note composer */}
      <div className="rounded-xl border bg-card p-3">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note about this project…"
          className="border-0 px-0 py-1 text-sm focus-visible:ring-0"
        />
        <div className="mt-2 flex items-center justify-between">
          <Dialog open={memoOpen} onOpenChange={setMemoOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1.5">
                <Mic className="size-3.5" />
                Voice memo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Record a voice memo</DialogTitle>
              </DialogHeader>
              <MemoUpload {...memoUploadProps} />
            </DialogContent>
          </Dialog>
          <Button size="sm" onClick={handleAdd} disabled={isAdding || !draft.trim()}>
            {isAdding ? 'Saving…' : 'Add note'}
          </Button>
        </div>
      </div>

      {/* Ask Henry — a labeled action, NOT a chat thread. The answer drops into
          the feed below as a henry_q / henry_a pair. Don't grow this into a
          conversation panel (Henry is intelligence, not chat). */}
      <div className="rounded-xl border border-brand/25 bg-card p-3.5">
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-brand">
            <Sparkles className="size-3" aria-hidden />
            Ask Henry about this project
          </span>
          <span className="text-[11px] text-muted-foreground">
            Answer drops into the feed below
          </span>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            rows={1}
            value={henryQ}
            onChange={(e) => setHenryQ(e.target.value)}
            placeholder="e.g. What's the biggest variance risk on this job?"
            className="border-0 px-0 py-1 text-sm focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAskHenry();
              }
            }}
          />
          <Button size="sm" onClick={handleAskHenry} disabled={isAsking || !henryQ.trim()}>
            {isAsking ? 'Asking…' : 'Ask Henry'}
          </Button>
        </div>
      </div>

      {/* Feed */}
      {feed.length === 0 ? (
        <p className="rounded-md border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No notes yet. Add a note above, record a memo, or drop artifacts via "Add to project".
        </p>
      ) : (
        <ol className="space-y-3">
          {feed.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              {item.kind === 'note' ? (
                <NoteCard
                  body={item.body}
                  author={item.author_name}
                  createdAt={item.created_at}
                  onDelete={() => handleDelete(item.id)}
                  isDeleting={isDeleting}
                />
              ) : item.kind === 'reply_draft' ? (
                <ReplyDraftCard
                  body={item.body}
                  createdAt={item.created_at}
                  onDelete={() => handleDelete(item.id)}
                  isDeleting={isDeleting}
                />
              ) : item.kind === 'henry_q' ? (
                <HenryTurnCard
                  speaker="user"
                  body={item.body}
                  createdAt={item.created_at}
                  onDelete={() => handleDelete(item.id)}
                  isDeleting={isDeleting}
                />
              ) : item.kind === 'henry_a' ? (
                <HenryTurnCard
                  speaker="henry"
                  body={item.body}
                  createdAt={item.created_at}
                  onDelete={() => handleDelete(item.id)}
                  isDeleting={isDeleting}
                />
              ) : item.kind === 'artifact' ? (
                <ArtifactCard
                  body={item.body}
                  label={item.label}
                  artifactKind={item.artifact_kind}
                  imageUrl={item.image_url}
                  createdAt={item.created_at}
                  onDelete={() => handleDelete(item.id)}
                  isDeleting={isDeleting}
                />
              ) : item.kind === 'memo' ? (
                <MemoCard
                  transcript={item.transcript}
                  status={item.status}
                  createdAt={item.created_at}
                />
              ) : (
                <EventCard
                  title={item.title}
                  body={item.body}
                  entryType={item.entry_type}
                  createdAt={item.created_at}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Shared AlertDialog-guarded delete for every deletable feed item. */
function FeedDeleteButton({
  onDelete,
  isDeleting,
  label,
}: {
  onDelete: () => void;
  isDeleting: boolean;
  label: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={isDeleting}
          aria-label={label}
          className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>This can&rsquo;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            disabled={isDeleting}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A single Henry feed item: the operator's question (neutral) or Henry's
 * answer (rust accent). Plain feed cards — never chat bubbles. */
function FeedWhen({ iso }: { iso: string }) {
  const tz = useTenantTimezone();
  return (
    <span className="font-mono text-[11px] text-muted-foreground">
      {formatDateTime(iso, { timezone: tz })}
    </span>
  );
}

function NoteCard({
  body,
  author,
  createdAt,
  onDelete,
  isDeleting,
}: {
  body: string;
  author: string | null;
  createdAt: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-2">
        <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap text-sm">{body}</p>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <span className="text-xs font-medium text-foreground/70">{author ?? 'Note'}</span>
            <span className="text-[11px]">·</span>
            <FeedWhen iso={createdAt} />
          </div>
        </div>
        <FeedDeleteButton onDelete={onDelete} isDeleting={isDeleting} label="Delete note" />
      </div>
    </div>
  );
}

function ReplyDraftCard({
  body,
  createdAt,
  onDelete,
  isDeleting,
}: {
  body: string;
  createdAt: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  function copy() {
    navigator.clipboard.writeText(body).then(() => toast.success('Reply copied'));
  }
  return (
    <div className="rounded-xl border border-brand/25 bg-card p-3">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-brand">
            Henry drafted a reply
          </p>
          <p className="whitespace-pre-wrap rounded-lg border border-brand/15 bg-brand/5 p-2.5 text-sm">
            {body}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="xs" variant="outline" onClick={copy} className="bg-card">
              Copy reply
            </Button>
            <FeedWhen iso={createdAt} />
          </div>
        </div>
        <FeedDeleteButton onDelete={onDelete} isDeleting={isDeleting} label="Delete reply draft" />
      </div>
    </div>
  );
}

function HenryTurnCard({
  speaker,
  body,
  createdAt,
  onDelete,
  isDeleting,
}: {
  speaker: 'user' | 'henry';
  body: string;
  createdAt: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const isUser = speaker === 'user';
  return (
    <div className={`rounded-xl border p-3 ${isUser ? 'bg-card' : 'border-brand/25 bg-card'}`}>
      <div className="flex items-start gap-2">
        {isUser ? (
          <UserIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
        )}
        <div className="min-w-0 flex-1">
          {!isUser ? (
            <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wider text-brand">
              Henry
            </p>
          ) : null}
          <p className="whitespace-pre-wrap text-sm">{body}</p>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <span className="text-xs font-medium text-foreground/70">
              {isUser ? 'You asked' : 'Answer'}
            </span>
            <span className="text-[11px]">·</span>
            <FeedWhen iso={createdAt} />
          </div>
        </div>
        <FeedDeleteButton onDelete={onDelete} isDeleting={isDeleting} label="Delete" />
      </div>
    </div>
  );
}

function ArtifactCard({
  body,
  label,
  artifactKind,
  imageUrl,
  createdAt,
  onDelete,
  isDeleting,
}: {
  body: string;
  label: string;
  artifactKind: string;
  imageUrl: string | null;
  createdAt: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        {imageUrl ? (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg border"
          >
            {/* biome-ignore lint/performance/noImgElement: signed URL bypasses next/image */}
            <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
          </a>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted/30 text-xs text-muted-foreground">
            no preview
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            {artifactKind}
          </p>
          <p className="text-sm font-medium">{label}</p>
          {body && body !== label ? (
            <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{body}</p>
          ) : null}
          <p className="mt-1">
            <FeedWhen iso={createdAt} />
          </p>
        </div>
        <FeedDeleteButton onDelete={onDelete} isDeleting={isDeleting} label="Delete artifact" />
      </div>
    </div>
  );
}

function MemoCard({
  transcript,
  status,
  createdAt,
}: {
  transcript: string | null;
  status: string;
  createdAt: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Mic className="size-3" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Voice memo
          </p>
          {transcript ? (
            <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-2.5 text-sm italic">
              {transcript}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              {status === 'transcribing' ? 'Transcribing…' : 'Audio memo'}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px]">
              <Play className="size-2.5 fill-current" />
              Play
            </span>
            <FeedWhen iso={createdAt} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({
  title,
  body,
  entryType,
  createdAt,
}: {
  title: string | null;
  body: string | null;
  entryType: string;
  createdAt: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Sparkles className="size-3" />
        </span>
        <div className="min-w-0 flex-1">
          {title ? <p className="text-sm font-medium">{title}</p> : null}
          {body ? <p className="text-xs text-muted-foreground">{body}</p> : null}
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <span className="font-mono text-[11px] uppercase tracking-wider">{entryType}</span>
            <span className="text-[11px]">·</span>
            <FeedWhen iso={createdAt} />
          </div>
        </div>
      </div>
    </div>
  );
}
