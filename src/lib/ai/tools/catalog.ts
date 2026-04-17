import { listCatalogEntries } from '@/lib/db/queries/service-catalog';
import { formatCad } from '../format';
import type { AiTool } from '../types';

export const catalogTools: AiTool[] = [
  {
    definition: {
      name: 'list_catalog',
      description:
        'List the service catalog (surface types and pricing). Answers "What do I charge for driveways?" etc.',
      input_schema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      try {
        const rows = await listCatalogEntries(false);

        if (rows.length === 0) {
          return 'No service catalog entries found. Add pricing in the web app first.';
        }

        let output = `Service Catalog\n${'='.repeat(40)}\n\n`;
        for (const item of rows) {
          const status = item.is_active ? '' : ' [INACTIVE]';
          output += `${item.label} (${item.surface_type})${status}\n`;
          if (item.price_per_sqft_cents) {
            output += `  Price per sq ft: ${formatCad(item.price_per_sqft_cents)}\n`;
          }
          output += `  Minimum charge: ${formatCad(item.min_charge_cents)}\n\n`;
        }

        return output;
      } catch (e) {
        return `Failed to list catalog: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
];
