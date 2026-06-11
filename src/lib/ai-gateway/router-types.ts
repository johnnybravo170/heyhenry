/**
 * Router-internal types. Kept separate from `types.ts` so the public
 * `AiProvider` surface doesn't leak routing concerns.
 */

import type { AiErrorKind, ProviderName } from './errors';

export type RoutePick = {
  provider: ProviderName;
  /** Model id override for this lane. Adapter default if omitted. */
  model?: string;
};

export type RouteConfig = {
  /** First-choice provider when no override is given. */
  primary: RoutePick;
  /** Optional weighted secondary, e.g. for tier-climbing. `weight` is the
   *  probability of picking secondary instead of primary, in [0, 1]. */
  secondary?: RoutePick & { weight: number };
  /** Ordered providers tried after a retryable error on the chosen lane.
   *  Already-tried providers are skipped. */
  fallback_chain: ProviderName[];
};

/**
 * Fired once per attempt — successful or failed. `createTelemetryHook`
 * wires this to the `ai_calls` insert so we can audit cost / failure
 * rate per task.
 */
export type RouterAttemptEvent = {
  task: string;
  /** 0 = primary lane, 1+ = each subsequent fallback. */
  attempt_index: number;
  provider: ProviderName;
  model: string;
  api_key_label?: string;
  tenant_id?: string | null;
  outcome: 'success' | 'error';
  error_kind?: AiErrorKind;
  /** First 500 chars of the provider error message. Persisted to ai_calls
   *  so failures are diagnosable from the dashboard without reading logs. */
  error_message?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_micros?: bigint;
  latency_ms: number;
};

/**
 * Fired once when the entire call fails — all providers in the fallback
 * chain exhausted, or all circuit-broken. NOT fired when a fallback
 * provider succeeds after a mid-chain error.
 */
export type RouterCallFailedEvent = {
  task: string;
  tenant_id?: string | null;
  /** Error kind from the last provider attempted. */
  error_kind: AiErrorKind;
  error_message?: string;
  /** Last provider attempted, or 'noop' when all were circuit-broken. */
  provider: ProviderName;
  /** Count of providers actually attempted (excludes breaker-skipped). */
  attempts_made: number;
};

export type RouterHooks = {
  /** Fired per attempt. Errors thrown here are swallowed — never fail
   *  the user's call because telemetry hiccupped. */
  onAttempt?: (event: RouterAttemptEvent) => void | Promise<void>;
  /** Fired once when the entire call fails — all providers exhausted or
   *  all circuit-broken. NOT fired when a fallback succeeds. Errors
   *  thrown here are swallowed. */
  onCallFailed?: (event: RouterCallFailedEvent) => void | Promise<void>;
};
