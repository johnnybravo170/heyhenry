import { SelectionFormDialog } from '@/components/features/portal/selection-form-dialog';
import { SelectionList } from '@/components/features/portal/selection-list';
import {
  groupSelectionsByRoom,
  listSelectionsForProject,
} from '@/lib/db/queries/project-selections';

export default async function SelectionsTabServer({ projectId }: { projectId: string }) {
  const selections = await listSelectionsForProject(projectId);
  const groups = groupSelectionsByRoom(selections);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Selections</h2>
          <p className="text-sm text-muted-foreground">
            Per-room paint codes, tile, fixtures, hardware. The homeowner sees these on their portal
            and they get rolled into the final Home Record.
          </p>
        </div>
        <SelectionFormDialog projectId={projectId} />
      </div>
      <SelectionList groups={groups} projectId={projectId} />
    </div>
  );
}
