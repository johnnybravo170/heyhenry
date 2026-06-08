/** Shared types for the Henry tool-call eval harness. */

/**
 * Arg matcher. Shorthand primitives mean exact-equals; objects give looser
 * matchers for fuzzy args (free text, ids resolved from stubs, etc).
 */
export type ArgMatcher =
  | string
  | number
  | boolean
  | { equals: unknown }
  | { contains: string } // case-insensitive substring (strings only)
  | { oneOf: unknown[] }
  | { present: true }; // arg must just exist (non-null)

export type ExpectedCall = {
  tool: string;
  /** Per-arg matchers. Omitted args aren't checked. */
  args?: Record<string, ArgMatcher>;
};

export type Scenario = {
  id: string;
  description: string;
  tenant: { name: string; timezone: string; vertical: string };
  /** Injected into the system prompt as a [CURRENT SCREEN] note. */
  screenContext?: string;
  /** User utterances, in order. Multi-turn scenarios test confirm-gates. */
  turns: string[];
  /**
   * Canned tool outputs keyed by tool name, fed back so multi-step recipes
   * (list_projects → get_project_budget, etc) can chain. The stub for a
   * `list_*` tool should contain the id the next call is expected to use.
   */
  toolStubs?: Record<string, unknown>;
  /** Ordered expected tool calls (compared against the first N captured). */
  expect: ExpectedCall[];
  /** Tool names that must NOT be called (confirm-gates, out-of-scope asks). */
  forbid?: string[];
  notes?: string;
};

export type CapturedCall = {
  tool: string;
  args: Record<string, unknown>;
  callId: string;
};
