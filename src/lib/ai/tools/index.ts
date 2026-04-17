import type { AiTool, ToolDefinition } from '../types';
import { catalogTools } from './catalog';
import { customerTools } from './customers';
import { dashboardTools, setDashboardTimezone } from './dashboard';
import { invoiceTools, setInvoiceTimezone } from './invoices';
import { jobTools } from './jobs';
import { quoteTools } from './quotes';
import { todoTools } from './todos';
import { worklogTools } from './worklog';

/** All 17 tools registered for the AI chat. */
export const allTools: AiTool[] = [
  ...dashboardTools,
  ...customerTools,
  ...quoteTools,
  ...jobTools,
  ...invoiceTools,
  ...todoTools,
  ...worklogTools,
  ...catalogTools,
];

/** Build a handler lookup map for fast dispatch. */
const handlerMap = new Map<string, AiTool['handler']>();
for (const tool of allTools) {
  handlerMap.set(tool.definition.name, tool.handler);
}

/** Returns ToolDefinition[] for the Claude API `tools` parameter. */
export function getToolDefinitions(): ToolDefinition[] {
  return allTools.map((t) => t.definition);
}

/**
 * Set the timezone used by dashboard and invoice tools.
 * Call this before executing tool calls in the API route.
 */
export function setToolTimezone(timezone: string) {
  setDashboardTimezone(timezone);
  setInvoiceTimezone(timezone);
}

/**
 * Dispatch a tool call by name. Returns the result string.
 * If the tool is not found, returns an error string (never throws).
 */
export async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const handler = handlerMap.get(name);
  if (!handler) {
    return `Unknown tool: "${name}". Available tools: ${allTools.map((t) => t.definition.name).join(', ')}`;
  }
  try {
    return await handler(input);
  } catch (e) {
    return `Tool "${name}" failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}
