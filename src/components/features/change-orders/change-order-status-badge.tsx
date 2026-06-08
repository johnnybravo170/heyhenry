import { StatusBadge } from '@/components/ui/status-badge';
import { changeOrderStatusTone, statusToneIcon } from '@/lib/ui/status-tokens';
import type { ChangeOrderStatus } from '@/lib/validators/change-order';
import { changeOrderStatusLabels } from '@/lib/validators/change-order';

export function ChangeOrderStatusBadge({ status }: { status: ChangeOrderStatus }) {
  const tone = changeOrderStatusTone[status] ?? 'neutral';
  return (
    <StatusBadge
      tone={tone}
      label={changeOrderStatusLabels[status] ?? status}
      icon={statusToneIcon[tone]}
    />
  );
}
