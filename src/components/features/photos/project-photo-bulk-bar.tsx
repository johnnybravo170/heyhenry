'use client';

/**
 * Selection-mode wrapper for the project photo gallery. Owns selectedIds
 * state and renders the bulk-action toolbar above the grid. When
 * selectMode is off, behaves identically to the plain grid (no toolbar
 * shown, cards behave normally).
 *
 * Bulk actions:
 *   - Set portal tags (replaces tags on all selected)
 *   - Pin to phase (or clear)
 *   - Show / hide from homeowner
 *
 * Slice 2 polish per the cut-list audit.
 */

import { Check, CheckSquare, ChevronDown, EyeOff, Loader2, Square, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PhotoWithUrl } from '@/lib/db/queries/photos';
import { cn } from '@/lib/utils';
import {
  PORTAL_PHOTO_TAGS,
  type PortalPhotoTag,
  portalPhotoTagLabels,
} from '@/lib/validators/portal-photo';
import {
  setPhotosClientVisibleBulkAction,
  setPhotosPhaseBulkAction,
  setPhotosPortalTagsBulkAction,
} from '@/server/actions/portal-photos';
import { PhotoCard } from './photo-card';

type Props = {
  photos: PhotoWithUrl[];
  tenantJobTypes: string[];
  phases: Array<{ id: string; name: string }>;
  projectId: string;
};

export function ProjectPhotoBulkBar({ photos, tenantJobTypes, phases, projectId }: Props) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState<Set<PortalPhotoTag>>(new Set());
  const [pending, startTransition] = useTransition();

  const selectedCount = selectedIds.size;

  function toggleSelectMode() {
    setSelectMode((on) => {
      if (on) setSelectedIds(new Set());
      return !on;
    });
  }

  function toggleSelect(photoId: string) {
    const next = new Set(selectedIds);
    if (next.has(photoId)) next.delete(photoId);
    else next.add(photoId);
    setSelectedIds(next);
  }

  function selectAll() {
    setSelectedIds(new Set(photos.map((p) => p.id)));
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  function applyTags() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await setPhotosPortalTagsBulkAction(ids, Array.from(tagDraft), projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Tagged ${ids.length} photo${ids.length === 1 ? '' : 's'}`);
      setTagsPopoverOpen(false);
      setTagDraft(new Set());
    });
  }

  function applyPhase(phaseId: string | null) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await setPhotosPhaseBulkAction(ids, phaseId, projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        phaseId
          ? `Pinned ${ids.length} photo${ids.length === 1 ? '' : 's'}`
          : `Unpinned ${ids.length} photo${ids.length === 1 ? '' : 's'}`,
      );
    });
  }

  function applyVisibility(visible: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await setPhotosClientVisibleBulkAction(ids, visible, projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        visible ? `${ids.length} now visible to homeowner` : `${ids.length} hidden from homeowner`,
      );
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant={selectMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleSelectMode}
        >
          {selectMode ? (
            <>
              <X className="size-4" />
              Cancel selection
            </>
          ) : (
            <>
              <CheckSquare className="size-4" />
              Select multiple
            </>
          )}
        </Button>

        {selectMode ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
            <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
              <Square className="size-3.5" />
              All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={selectedCount === 0}
            >
              None
            </Button>
          </div>
        ) : null}
      </div>

      {selectMode && selectedCount > 0 ? (
        <div
          className={cn(
            'sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm',
            pending && 'opacity-70',
          )}
        >
          <span className="mr-1 text-xs font-medium">{selectedCount} selected</span>

          {/* Tags popover */}
          <Popover open={tagsPopoverOpen} onOpenChange={setTagsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={pending}>
                Set portal tags
                <ChevronDown className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <p className="mb-2 text-xs text-muted-foreground">
                Replaces existing tags on all selected photos.
              </p>
              <div className="space-y-2">
                {PORTAL_PHOTO_TAGS.map((tag) => (
                  <label
                    key={tag}
                    htmlFor={`bulk-tag-${tag}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      id={`bulk-tag-${tag}`}
                      checked={tagDraft.has(tag)}
                      onCheckedChange={() => {
                        const next = new Set(tagDraft);
                        if (next.has(tag)) next.delete(tag);
                        else next.add(tag);
                        setTagDraft(next);
                      }}
                    />
                    <span>{portalPhotoTagLabels[tag]}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTagsPopoverOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={applyTags} disabled={pending}>
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Phase select */}
          {phases.length > 0 ? (
            <select
              defaultValue=""
              onChange={(e) => applyPhase(e.target.value || null)}
              disabled={pending}
              aria-label="Pin selected photos to phase"
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="" disabled>
                Pin to phase…
              </option>
              <option value="">— clear pin —</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}

          {/* Visibility */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyVisibility(true)}
            disabled={pending}
          >
            <Check className="size-3.5" />
            Show
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyVisibility(false)}
            disabled={pending}
          >
            <EyeOff className="size-3.5" />
            Hide
          </Button>
        </div>
      ) : null}

      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
        data-slot="project-photo-gallery"
        data-count={photos.length}
      >
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            tenantJobTypes={tenantJobTypes}
            phases={phases}
            selectMode={selectMode}
            selected={selectedIds.has(photo.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>
    </div>
  );
}
