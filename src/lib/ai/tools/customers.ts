import { getCurrentTenant } from '@/lib/auth/helpers';
import { getCustomer, getCustomerRelated, listCustomers } from '@/lib/db/queries/customers';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '../format';
import { resolveCustomer } from '../helpers/resolve-customer';
import type { AiTool } from '../types';

export const customerTools: AiTool[] = [
  {
    definition: {
      name: 'list_customers',
      description:
        'List customers. Filter by search term, type (residential/commercial/agent), or limit results.',
      input_schema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search by name, email, phone, or city',
          },
          type: {
            type: 'string',
            enum: ['residential', 'commercial', 'agent'],
            description: 'Filter by customer type',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default 20, max 100)',
          },
        },
      },
    },
    handler: async (input) => {
      try {
        const rows = await listCustomers({
          search: input.search as string | undefined,
          type: input.type as 'residential' | 'commercial' | 'agent' | undefined,
          limit: Math.min((input.limit as number) || 20, 100),
        });

        if (rows.length === 0) {
          return 'No customers found matching your criteria.';
        }

        let output = `Found ${rows.length} customer(s):\n\n`;
        for (let i = 0; i < rows.length; i++) {
          const c = rows[i];
          const parts = [c.name];
          parts.push(`(${c.type})`);
          if (c.city) parts.push(`- ${c.city}`);
          if (c.phone) parts.push(`- ${c.phone}`);
          if (c.email) parts.push(`- ${c.email}`);
          output += `${i + 1}. ${parts.join(' ')}\n`;
          output += `   ID: ${c.id}\n`;
        }

        return output;
      } catch (e) {
        return `Failed to list customers: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'get_customer',
      description:
        'Get full details for a specific customer, including counts of related quotes, jobs, and invoices.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Customer UUID' },
        },
        required: ['id'],
      },
    },
    handler: async (input) => {
      try {
        const customer = await getCustomer(input.id as string);
        if (!customer) {
          return 'Customer not found.';
        }

        const related = await getCustomerRelated(customer.id);

        let output = `Customer: ${customer.name}\n${'='.repeat(40)}\n\n`;
        output += `Type: ${customer.type}\n`;
        if (customer.email) output += `Email: ${customer.email}\n`;
        if (customer.phone) output += `Phone: ${customer.phone}\n`;
        if (customer.address_line1) output += `Address: ${customer.address_line1}\n`;
        if (customer.city) {
          output += `City: ${customer.city}`;
          if (customer.province) output += `, ${customer.province}`;
          if (customer.postal_code) output += ` ${customer.postal_code}`;
          output += '\n';
        }
        if (customer.notes) output += `Notes: ${customer.notes}\n`;
        output += `\nCreated: ${formatDate(customer.created_at)}\n`;
        output += `\nRelated Records\n${'-'.repeat(20)}\n`;
        output += `Quotes: ${related.quotes.length}\n`;
        output += `Jobs: ${related.jobs.length}\n`;
        output += `Invoices: ${related.invoices.length}\n`;

        return output;
      } catch (e) {
        return `Failed to get customer: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'create_customer',
      description: 'Create a new customer. Requires name and type (residential/commercial/agent).',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer name' },
          type: {
            type: 'string',
            enum: ['residential', 'commercial', 'agent'],
            description: 'Customer type',
          },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone number' },
          city: { type: 'string', description: 'City' },
          notes: { type: 'string', description: 'Additional notes' },
        },
        required: ['name', 'type'],
      },
    },
    handler: async (input) => {
      try {
        const tenant = await getCurrentTenant();
        if (!tenant) return 'Not authenticated.';

        const supabase = await createClient();
        const { data, error } = await supabase
          .from('customers')
          .insert({
            tenant_id: tenant.id,
            name: input.name as string,
            type: input.type as string,
            email: (input.email as string) ?? null,
            phone: (input.phone as string) ?? null,
            city: (input.city as string) ?? null,
            notes: (input.notes as string) ?? null,
          })
          .select('id, name, type')
          .single();

        if (error) {
          return `Failed to create customer: ${error.message}`;
        }

        return `Customer created successfully.\n\nName: ${data.name}\nType: ${data.type}\nID: ${data.id}`;
      } catch (e) {
        return `Failed to create customer: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'update_customer',
      description:
        "Update a customer's information. Specify the customer by name or ID and the fields to change.",
      input_schema: {
        type: 'object',
        properties: {
          customer_name_or_id: {
            type: 'string',
            description: 'Customer name (fuzzy match) or UUID',
          },
          name: { type: 'string', description: 'New name' },
          email: { type: 'string', description: 'New email address' },
          phone: { type: 'string', description: 'New phone number' },
          address_line1: { type: 'string', description: 'New street address' },
          city: { type: 'string', description: 'New city' },
          province: { type: 'string', description: 'New province' },
          postal_code: { type: 'string', description: 'New postal code' },
          notes: { type: 'string', description: 'New notes' },
          type: {
            type: 'string',
            enum: ['residential', 'commercial', 'agent'],
            description: 'New customer type',
          },
        },
        required: ['customer_name_or_id'],
      },
    },
    handler: async (input) => {
      try {
        const tenant = await getCurrentTenant();
        if (!tenant) return 'Not authenticated.';

        const resolved = await resolveCustomer(input.customer_name_or_id as string);
        if (typeof resolved === 'string') return resolved;

        // Build update object from provided fields
        const updatableFields = [
          'name',
          'email',
          'phone',
          'address_line1',
          'city',
          'province',
          'postal_code',
          'notes',
          'type',
        ] as const;
        const updates: Record<string, unknown> = {};
        const changed: string[] = [];

        for (const field of updatableFields) {
          const value = input[field];
          if (value !== undefined && value !== null) {
            updates[field] = value;
            changed.push(`${field} = "${value}"`);
          }
        }

        if (changed.length === 0) {
          return 'No fields to update. Specify at least one field to change.';
        }

        updates.updated_at = new Date().toISOString();

        const supabase = await createClient();
        const { error } = await supabase.from('customers').update(updates).eq('id', resolved.id);

        if (error) {
          return `Failed to update customer: ${error.message}`;
        }

        return `Updated ${resolved.name}: ${changed.join(', ')}.`;
      } catch (e) {
        return `Failed to update customer: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
];
