import { CostBucketsTable } from '@/components/features/projects/cost-buckets-table';
import { listCostLines } from '@/lib/db/queries/cost-lines';
import { listMaterialsCatalog } from '@/lib/db/queries/materials-catalog';
import { getBudgetVsActual } from '@/lib/db/queries/project-buckets';

export default async function BucketsTabServer({ projectId }: { projectId: string }) {
  const [budget, costLines, catalog] = await Promise.all([
    getBudgetVsActual(projectId),
    listCostLines(projectId),
    listMaterialsCatalog(),
  ]);

  return (
    <CostBucketsTable
      lines={budget.lines}
      projectId={projectId}
      costLines={costLines}
      catalog={catalog}
    />
  );
}
