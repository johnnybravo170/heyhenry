/**
 * HMAC-signing HTTP client for the ops API.
 *
 * Mirrors `ops/src/lib/api-auth.ts` + `ops/src/lib/keys.ts` byte-for-byte:
 *
 *   Authorization: Bearer ops_<keyId>_<secret>
 *   X-Ops-Timestamp: <unix seconds>
 *   X-Ops-Signature: hex(HMAC-SHA256(secret, `${timestamp}|${METHOD}|${path}|${bodySha256}`))
 *   X-Ops-Reason: <human reason>   (only when calling a destructive op; not used in Phase 1)
 *
 * `path` is `pathname + search` — querystring included.
 * `bodySha256` is the SHA-256 of the raw body string ('' for GET/HEAD).
 *
 * Env:
 *   OPS_BASE_URL       (default: https://ops.heyhenry.io)
 *   OPS_API_KEY        full key in `ops_<id>_<secret>` format (preferred)
 *   OPS_API_KEY_ID     ) alternative split form, kept for parity with the
 *   OPS_API_KEY_SECRET ) spec — joined into the same wire format internally.
 *   OPS_ACTOR_NAME     name auto-injected as `actor_name` on every write.
 */
export declare class OpsRequestError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown, message: string);
}
export declare function actorName(): string;
export type OpsMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
/**
 * Issue a signed request. `path` must start with `/api/ops/...` and may
 * include a querystring. Returns the parsed JSON body on 2xx; throws
 * OpsRequestError otherwise.
 */
export declare function opsRequest<T = unknown>(method: OpsMethod, path: string, body?: unknown, opts?: {
    reason?: string;
}): Promise<T>;
/** Render an OpsRequestError (or any thrown value) as a one-line message. */
export declare function describeError(e: unknown): string;
