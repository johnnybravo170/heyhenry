'use client';

/**
 * "Show on portal" affordance for a single photo. Lives in the photo card
 * overlay (operator surfaces only). Opens a popover with multi-select
 * portal tag chips and a client-visible toggle.
 *
 * Slice 2 of the Customer Portal & Home Record build. Bulk-tag UI is
 * out of scope for V1 — operator tags one photo at a time. The "On
 * portal" indicator dot on the trigger button shows at a glance which
 * photos are published.
 */

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  PORTAL_PHOTO_TAGS,
  type PortalPhotoTag,
  portalPhotoTagLabels,
} from '@/lib/validators/portal-photo';
import {
  setPhotoPhaseAction,
  setPhotoPortalTagsAction,
  togglePhotoClientVisibleAction,
} from '@/server/actions/portal-photos';

export type PhaseOption = { id: string; name: string };

type Props = {
  photoId: string;
  projectId: string;
  initialTags: string[];
  initialClientVisible: boolean;
  initialPhaseId: string | null;
  /** Phases available for assignment. Empty array hides the picker. */
  phases?: PhaseOption[];
};

export function PhotoPortalButton({
  photoId,
  projectId,
  initialTags,
  initialClientVisible,
  initialPhaseId,
  phases = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<Set<PortalPhotoTag>>(
    () =>
      new Set(
        initialTags.filter((t): t is PortalPhotoTag =>
          (PORTAL_PHOTO_TAGS as readonly string[]).includes(t),
        ),
      ),
  );
  const [clientVisible, setClientVisible] = useState(initialClientVisible);
  const [phaseId, setPhaseId] = useState<string | null>(initialPhaseId);
  const [pending, startTransition] = useTransition();

  const isPublished = tags.size > 0 && clientVisible;

  function toggleTag(tag: PortalPhotoTag) {
    const next = new Set(tags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setTags(next);
    startTransition(async () => {
      const res = await setPhotoPortalTagsAction(photoId, Array.from(next), projectId);
      if (!res.ok) {
        toast.error(res.error);
        // Revert on error.
        setTags(tags);
      }
    });
  }

  function toggleVisible() {
    const next = !clientVisible;
    setClientVisible(next);
    startTransition(async () => {
      const res = await togglePhotoClientVisibleAction(photoId, next, projectId);
      if (!res.ok) {
        toast.error(res.error);
        setClientVisible(!next);
      }
    });
  }

  function changePhase(next: string | null) {
    const previous = phaseId;
    setPhaseId(next);
    startTransition(async () => {
      const res = await setPhotoPhaseAction(photoId, next, projectId);
      if (!res.ok) {
        toast.error(res.error);
        setPhaseId(previous);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={isPublished ? 'On portal — edit' : 'Show on portal'}
          title={isPublished ? 'On portal — edit' : 'Show on portal'}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-md border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-background',
            isPublished && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15',
          )}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isPublished ? (
            <Eye className="size-3.5" aria-hidden />
          ) : (
            <EyeOff className="size-3.5" aria-hidden />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Show on customer portal</p>
            <p className="text-xs text-muted-foreground">
              Tag this photo so it appears on the homeowner&rsquo;s portal grouped by category.
            </p>
          </div>

          <div className="space-y-2">
            {PORTAL_PHOTO_TAGS.map((tag) => (
              <label
                key={tag}
                className="flex cursor-pointer items-center gap-2 text-sm"
                htmlFor={`portal-tag-${photoId}-${tag}`}
              >
                <Checkbox
                  id={`portal-tag-${photoId}-${tag}`}
                  checked={tags.has(tag)}
                  onCheckedChange={() => toggleTag(tag)}
                  disabled={pending}
                />
                <span>{portalPhotoTagLabels[tag]}</span>
                {tag === 'behind_wall' ? (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Held back into its own section
                  </span>
                ) : null}
              </label>
            ))}
          </div>

          {phases.length > 0 ? (
            <div>
              <Label htmlFor={`portal-phase-${photoId}`} className="text-xs">
                Pin to phase (optional)
              </Label>
              <select
                id={`portal-phase-${photoId}`}
                value={phaseId ?? ''}
                onChange={(e) => changePhase(e.target.value || null)}
                disabled={pending}
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">— none —</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Pinned photos appear inline on the homeowner&rsquo;s timeline.
              </p>
            </div>
          ) : null}

          {tags.size > 0 ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {clientVisible ? 'Visible to homeowner' : 'Hidden from homeowner'}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={toggleVisible}
                disabled={pending}
              >
                {clientVisible ? 'Hide' : 'Unhide'}
              </Button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
