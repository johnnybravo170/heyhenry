'use client';

/**
 * Multi-select photo picker dialog for a project selection. Shows the
 * project's gallery as a thumbnail grid; the operator taps photos to
 * include them, then saves. Stores the chosen photos as
 * project_selections.photo_refs (an array of {photo_id, storage_path,
 * caption}).
 */

import { Check, ImageIcon, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { setSelectionPhotoRefsAction } from '@/server/actions/project-selections';

export type GalleryPickerPhoto = {
  id: string;
  storage_path: string;
  url: string;
  caption: string | null;
};

type Props = {
  selectionId: string;
  projectId: string;
  photos: GalleryPickerPhoto[];
  initialIds: string[];
  count: number;
};

export function SelectionPhotoPicker({ selectionId, projectId, photos, initialIds, count }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function save() {
    const refs = photos
      .filter((p) => selected.has(p.id))
      .map((p) => ({ photo_id: p.id, storage_path: p.storage_path, caption: p.caption }));
    startTransition(async () => {
      const res = await setSelectionPhotoRefsAction(selectionId, projectId, refs);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Photos updated');
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ImageIcon className="size-3.5" aria-hidden />
          {count > 0 ? `${count} photo${count === 1 ? '' : 's'}` : 'Add photos'}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Photos for this selection</DialogTitle>
          <DialogDescription>
            Pick from the project gallery. Photos appear under this selection on the
            homeowner&rsquo;s portal and in the Home Record.
          </DialogDescription>
        </DialogHeader>

        {photos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Upload photos in the Gallery tab first — they&rsquo;ll show up here.
          </p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
            {photos.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-md border bg-muted/30',
                    isSelected && 'ring-2 ring-primary',
                  )}
                  aria-pressed={isSelected}
                >
                  {/* biome-ignore lint/performance/noImgElement: signed URLs */}
                  <img
                    src={p.url}
                    alt={p.caption ?? ''}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  {isSelected ? (
                    <span className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
