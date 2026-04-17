import { getCurrentTenant, getCurrentUser } from '@/lib/auth/helpers';
import { listTodos } from '@/lib/db/queries/todos';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '../format';
import type { AiTool } from '../types';

export const todoTools: AiTool[] = [
  {
    definition: {
      name: 'list_todos',
      description: 'List todos. Filter by completion status.',
      input_schema: {
        type: 'object',
        properties: {
          done: {
            type: 'boolean',
            description: 'Filter: true = completed, false = open, omit = all',
          },
          limit: {
            type: 'number',
            description: 'Max results (default 20, max 100)',
          },
        },
      },
    },
    handler: async (input) => {
      try {
        const rows = await listTodos({
          done: input.done as boolean | undefined,
          limit: Math.min((input.limit as number) || 20, 100),
        });

        if (rows.length === 0) {
          return 'No todos found.';
        }

        let output = `Found ${rows.length} todo(s):\n\n`;
        for (let i = 0; i < rows.length; i++) {
          const t = rows[i];
          const check = t.done ? '[x]' : '[ ]';
          output += `${i + 1}. ${check} ${t.title}`;
          if (t.due_date) output += ` (due: ${formatDate(t.due_date)})`;
          if (t.related_type) output += ` [${t.related_type}]`;
          output += `\n   ID: ${t.id}\n`;
        }

        return output;
      } catch (e) {
        return `Failed to list todos: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'create_todo',
      description: 'Create a new todo item.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Todo title/description' },
          due_date: {
            type: 'string',
            description: 'Due date (YYYY-MM-DD format)',
          },
        },
        required: ['title'],
      },
    },
    handler: async (input) => {
      try {
        const tenant = await getCurrentTenant();
        if (!tenant) return 'Not authenticated.';

        const user = await getCurrentUser();
        if (!user) return 'Not authenticated.';

        const supabase = await createClient();
        const { data, error } = await supabase
          .from('todos')
          .insert({
            tenant_id: tenant.id,
            user_id: user.id,
            title: input.title as string,
            due_date: (input.due_date as string) ?? null,
          })
          .select('id, title, due_date')
          .single();

        if (error) {
          return `Failed to create todo: ${error.message}`;
        }

        let output = `Todo created.\n\nTitle: ${data.title}`;
        if (data.due_date) output += `\nDue: ${formatDate(data.due_date as string)}`;
        output += `\nID: ${data.id}`;

        return output;
      } catch (e) {
        return `Failed to create todo: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  {
    definition: {
      name: 'complete_todo',
      description: 'Mark a todo as done.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Todo UUID' },
        },
        required: ['id'],
      },
    },
    handler: async (input) => {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from('todos')
          .update({ done: true, updated_at: new Date().toISOString() })
          .eq('id', input.id as string)
          .select('id, title')
          .single();

        if (error) {
          return 'Todo not found.';
        }

        return `Todo completed: "${data.title}"`;
      } catch (e) {
        return `Failed to complete todo: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
];
