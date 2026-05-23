import {
  type OverAllowanceItem,
  OverAllowanceNudge,
} from '@/components/features/portal/over-allowance-nudge';
import { SelectionFormDialog } from '@/components/features/portal/selection-form-dialog';
import { SelectionList } from '@/components/features/portal/selection-list';
import type { GalleryPickerPhoto } from '@/components/features/portal/selection-photo-picker';
import { CustomerIdeasSection } from '@/components/features/projects/customer-ideas-section';
import { listPhotosByProject } from '@/lib/db/queries/photos';
import {
  groupSelectionsByRoom,
  listSelectionsForProject,
} from '@/lib/db/queries/project-selections';
import { signIdeaBoardImageUrls } from '@/lib/storage/idea-board';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { SelectionCategory } from '@/lib/validators/project-selection';
import { selectionCategoryLabels } from '@/lib/validators/project-selection';
import type { IdeaBoardItem } from '@/server/actions/project-idea-board';

export default async function SelectionsTabServer({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  const [selections, photos, ideaRowsRes] = await Promise.all([
    listSelectionsForProject(projectId),
    listPhotosByProject(projectId),
    supabase
      .from('project_idea_board_items')
      .select(
        'id, project_id, customer_id, kind, image_storage_path, source_url, thumbnail_url, title, notes, room, read_by_operator_at, promoted_to_selection_id, promoted_at, created_at',
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  ]);
  const groups = groupSelectionsByRoom(selections);

  // Operator-side mark-read: opening the Selections tab counts as
  // "saw the new customer ideas." Fired here on render rather than a
  // client-side useEffect so it's robust to JS-disabled views and there's
  // no flicker between badge-on and badge-off. Mirrors the operator
  // Messages tab pattern.
  await supabase
    .from('project_idea_board_items')
    .update({ read_by_operator_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .is('read_by_operator_at', null);

  const ideaItemsRaw = (ideaRowsRes.data ?? []) as IdeaBoardItem[];
  const ideaImagePaths = ideaItemsRaw
    .map((r) => r.image_storage_path)
    .filter((p): p is string => Boolean(p));
  // Use the admin client for signing — same convention as the customer-side
  // renderer, and avoids any RLS surprises on storage.objects.
  const admin = createAdminClient();
  const ideaSignedUrls = await signIdeaBoardImageUrls(admin, ideaImagePaths);
  const ideaItems: IdeaBoardItem[] = ideaItemsRaw.map((r) => ({
    ...r,
    image_url: r.image_storage_path ? (ideaSignedUrls.get(r.image_storage_path) ?? null) : null,
  }));

  // Selections promoted from a client idea. Promotion is tracked one-way on
  // the idea row (`promoted_to_selection_id`) — the tables stay distinct
  // (Object Model b4d880be). We derive the set of promoted selection IDs so
  // the list can render the "Promoted from idea" tag without merging objects.
  const promotedSelectionIds = new Set(
    ideaItemsRaw.map((r) => r.promoted_to_selection_id).filter((id): id is string => Boolean(id)),
  );

  // Deterministic over-allowance set → drives Henry's nudge. Pure allowance
  // vs actual; no model call. The CO is human-authored from here.
  const overAllowanceItems: OverAllowanceItem[] = selections
    .filter(
      (s) =>
        s.allowance_cents != null &&
        s.actual_cost_cents != null &&
        s.actual_cost_cents > s.allowance_cents,
    )
    .map((s) => ({
      room: s.room,
      label:
        [s.brand, s.name].filter(Boolean).join(' ') ||
        (selectionCategoryLabels[s.category as SelectionCategory] ?? s.category),
      allowanceCents: s.allowance_cents as number,
      overByCents: (s.actual_cost_cents as number) - (s.allowance_cents as number),
    }));

  // Pre-resolved signed URLs from listPhotosByProject — pass to the
  // photo-refs picker dialog. Filter to photos that have a signed URL
  // and belong to this project (project_id matches; deleted_at filters
  // already applied upstream).
  const galleryPhotos: GalleryPickerPhoto[] = photos
    .filter((p) => Boolean(p.url))
    .map((p) => ({
      id: p.id,
      storage_path: p.storage_path,
      url: p.url as string,
      caption: p.caption ?? null,
    }));

  return (
    <div className="space-y-6">
      <CustomerIdeasSection projectId={projectId} items={ideaItems} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Selections</h2>
          <p className="text-sm text-muted-foreground">
            Per-room paint codes, tile, fixtures, hardware — each with an allowance and what it
            actually cost. The client sees these on their portal and they roll into the final Home
            Record.
          </p>
        </div>
        <SelectionFormDialog projectId={projectId} />
      </div>
      <OverAllowanceNudge projectId={projectId} items={overAllowanceItems} />
      <SelectionList
        groups={groups}
        projectId={projectId}
        galleryPhotos={galleryPhotos}
        promotedSelectionIds={promotedSelectionIds}
      />
    </div>
  );
}
