/**
 * End-to-end guard for the MCP write-tool argument path.
 *
 * Why this exists: on 2026-06-05 every ops MCP *write* tool appeared to reject
 * its arguments with a Zod-v4 `expected string, received undefined` error while
 * reads worked. The suspected cause was a regression in how the MCP SDK forwards
 * a `tools/call` request's `params.arguments` into each tool's Zod schema —
 * specifically the SDK's classic-zod -> `zod/v4-mini` `objectFromShape` /
 * `safeParse` bridge breaking under an SDK/Zod version bump. (The real 06-05
 * incident turned out to be a *client* sending `arguments: {}`, not a server
 * bug — but the feared regression is real and silent: it would brick every
 * write tool at once and leave no audit row, since validation runs before
 * `withAudit`.)
 *
 * This test pins the behaviour the SDK/Zod stack must keep: a representative
 * write tool, registered exactly as production registers it, driven through the
 * real `WebStandardStreamableHTTPServerTransport`, must
 *   1. advertise an inputSchema with its real `properties` + `required`,
 *   2. forward supplied arguments all the way to the handler, and
 *   3. still reject a genuinely-empty `arguments: {}` (so the fix is never to
 *      loosen validation).
 * A future SDK or Zod bump that breaks arg-forwarding fails this test instead of
 * silently breaking the live agents.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture rows the tool handler tries to insert, without touching a real DB.
const captured = vi.hoisted(() => ({ inserts: [] as Array<{ table: string; row: unknown }> }));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => {
    const builder = (table: string) => {
      const b = {
        insert(row: unknown) {
          captured.inserts.push({ table, row });
          return b;
        },
        select() {
          return b;
        },
        single() {
          return Promise.resolve({
            data: { id: 'test-id', created_at: '2026-01-01T00:00:00Z' },
            error: null,
          });
        },
        // `withAudit` does `.insert(...).then(...)` — make the builder thenable.
        // biome-ignore lint/suspicious/noThenProperty: deliberately mocking PostgREST's thenable query builder.
        then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
          return Promise.resolve({ data: null, error: null }).then(onF, onR);
        },
      };
      return b;
    };
    return { schema: () => ({ from: builder }) };
  },
}));

// Imported AFTER the mock is declared so the registrar picks up the stub.
const { registerWorklogTools } = await import('@/server/mcp-tools/worklog');

const CTX = {
  keyId: 'test-key-id',
  actorName: 'test-actor',
  scopes: ['read:worklog', 'write:worklog'],
};

/** Drive one JSON-RPC message through a fresh per-request server+transport, exactly like the real /api/mcp route. */
async function rpc(message: Record<string, unknown>) {
  const server = new McpServer({ name: 'test', version: '0' }, { capabilities: { tools: {} } });
  registerWorklogTools(server, CTX);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  const req = new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
    },
    body: JSON.stringify(message),
  });
  const res = await transport.handleRequest(req);
  const text = await res.text();
  // Streamable-HTTP replies as an SSE frame: `event: message\ndata: {json}\n\n`.
  const line = text.split('\n').find((l) => l.startsWith('data: '));
  if (!line) throw new Error(`No SSE data frame in response: ${text}`);
  return JSON.parse(line.slice('data: '.length));
}

describe('MCP write-tool argument forwarding (worklog_add)', () => {
  beforeEach(() => {
    captured.inserts.length = 0;
  });

  it('advertises an inputSchema with real properties and required fields', async () => {
    const out = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    const tool = out.result.tools.find((t: { name: string }) => t.name === 'worklog_add');
    expect(tool).toBeDefined();
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties.title).toMatchObject({ type: 'string' });
    expect(tool.inputSchema.required).toContain('title');
  });

  it('forwards supplied arguments through validation into the handler', async () => {
    const out = await rpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'worklog_add', arguments: { title: 'Hello world', category: 'test' } },
    });
    // Handler ran and returned ok (not a validation error).
    expect(out.result.isError).toBeFalsy();
    expect(out.result.content[0].text).toContain('"ok": true');
    // The args actually reached the handler's insert payload.
    const row = captured.inserts.find((i) => i.table === 'worklog_entries')?.row as {
      title?: string;
      category?: string;
    };
    expect(row?.title).toBe('Hello world');
    expect(row?.category).toBe('test');
  });

  it('still rejects an empty arguments object (do not loosen validation)', async () => {
    const out = await rpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'worklog_add', arguments: {} },
    });
    expect(out.result.isError).toBe(true);
    expect(out.result.content[0].text).toMatch(/Invalid arguments for tool worklog_add/);
    expect(out.result.content[0].text).toMatch(/title/);
    // And nothing was written.
    expect(captured.inserts.find((i) => i.table === 'worklog_entries')).toBeUndefined();
  });
});
