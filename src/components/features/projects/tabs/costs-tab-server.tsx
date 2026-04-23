import { CostsTab } from '@/components/features/projects/costs-tab';
import { listProjectBills } from '@/lib/db/queries/project-bills';
import { listBucketsForProject } from '@/lib/db/queries/project-buckets';
import { listProjectSubQuotes } from '@/lib/db/queries/project-sub-quotes';
import { listPurchaseOrders } from '@/lib/db/queries/purchase-orders';

export default async function CostsTabServer({ projectId }: { projectId: string }) {
  const [purchaseOrders, bills, subQuotes, projectBuckets] = await Promise.all([
    listPurchaseOrders(projectId),
    listProjectBills(projectId),
    listProjectSubQuotes(projectId),
    listBucketsForProject(projectId),
  ]);

  return (
    <CostsTab
      projectId={projectId}
      purchaseOrders={purchaseOrders}
      bills={bills}
      subQuotes={subQuotes}
      buckets={projectBuckets.map((b) => ({
        id: b.id,
        name: b.name,
        section: (b.section as 'interior' | 'exterior' | 'general') ?? 'general',
      }))}
    />
  );
}
