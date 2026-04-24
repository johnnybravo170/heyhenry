import { changeOrderStatusTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import type { ChangeOrderStatus } from '@/lib/validators/change-order';
import { changeOrderStatusLabels } from '@/lib/validators/change-order';

export function ChangeOrderStatusBadge({ status }: { status: ChangeOrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        statusToneClass[changeOrderStatusTone[status] ?? 'neutral'],
      )}
    >
      {changeOrderStatusLabels[status] ?? status}
    </span>
  );
}
