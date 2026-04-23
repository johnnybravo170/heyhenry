import { VarianceTab } from '@/components/features/projects/variance-tab';
import { getVarianceReport } from '@/lib/db/queries/cost-lines';

export default async function VarianceTabServer({ projectId }: { projectId: string }) {
  const variance = await getVarianceReport(projectId);
  return <VarianceTab variance={variance} />;
}
