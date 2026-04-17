/**
 * Shared types for the AI chat tool system.
 *
 * Each tool is a pair: a definition (sent to the Claude API) and a handler
 * (runs server-side, calls existing DB queries).
 */

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type ToolHandler = (input: Record<string, unknown>) => Promise<string>;

export type AiTool = {
  definition: ToolDefinition;
  handler: ToolHandler;
};
