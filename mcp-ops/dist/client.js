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
import { createHash, createHmac } from 'node:crypto';
export class OpsRequestError extends Error {
    status;
    body;
    constructor(status, body, message) {
        super(message);
        this.name = 'OpsRequestError';
        this.status = status;
        this.body = body;
    }
}
function readKey() {
    const full = process.env.OPS_API_KEY?.trim();
    if (full) {
        if (!full.startsWith('ops_')) {
            throw new Error('OPS_API_KEY must start with "ops_"');
        }
        const rest = full.slice(4);
        const u = rest.indexOf('_');
        if (u < 0)
            throw new Error('OPS_API_KEY malformed (missing secret separator)');
        return { keyId: rest.slice(0, u), secret: rest.slice(u + 1), raw: full };
    }
    const keyId = process.env.OPS_API_KEY_ID?.trim();
    const secret = process.env.OPS_API_KEY_SECRET?.trim();
    if (!keyId || !secret) {
        throw new Error('Set OPS_API_KEY (or OPS_API_KEY_ID + OPS_API_KEY_SECRET).');
    }
    return { keyId, secret, raw: `ops_${keyId}_${secret}` };
}
function baseUrl() {
    return (process.env.OPS_BASE_URL ?? 'https://ops.heyhenry.io').replace(/\/$/, '');
}
export function actorName() {
    return process.env.OPS_ACTOR_NAME?.trim() || 'mcp-ops';
}
function sha256Hex(input) {
    return createHash('sha256').update(input).digest('hex');
}
function sign(secret, message) {
    return createHmac('sha256', secret).update(message).digest('hex');
}
/**
 * Issue a signed request. `path` must start with `/api/ops/...` and may
 * include a querystring. Returns the parsed JSON body on 2xx; throws
 * OpsRequestError otherwise.
 */
export async function opsRequest(method, path, body, opts = {}) {
    const { keyId, secret, raw } = readKey();
    const url = new URL(baseUrl() + path);
    // Signed `path` is pathname + search exactly as the server reconstructs it.
    const signedPath = url.pathname + url.search;
    const bodyText = body === undefined || method === 'GET' ? '' : JSON.stringify(body);
    const bodySha = sha256Hex(bodyText);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(secret, `${timestamp}|${method}|${signedPath}|${bodySha}`);
    const headers = {
        authorization: `Bearer ${raw}`,
        'x-ops-timestamp': timestamp,
        'x-ops-signature': signature,
    };
    if (bodyText)
        headers['content-type'] = 'application/json';
    if (opts.reason)
        headers['x-ops-reason'] = opts.reason;
    const res = await fetch(url, {
        method,
        headers,
        body: bodyText || undefined,
    });
    const text = await res.text();
    let parsed = undefined;
    if (text) {
        try {
            parsed = JSON.parse(text);
        }
        catch {
            parsed = text;
        }
    }
    if (!res.ok) {
        const msg = (parsed && typeof parsed === 'object' && 'error' in parsed
            ? String(parsed.error)
            : null) ?? `HTTP ${res.status}`;
        throw new OpsRequestError(res.status, parsed, `${method} ${signedPath} failed: ${msg}`);
    }
    // Make the keyId available to callers if needed for debugging.
    void keyId;
    return parsed;
}
/** Render an OpsRequestError (or any thrown value) as a one-line message. */
export function describeError(e) {
    if (e instanceof OpsRequestError) {
        return `[${e.status}] ${e.message}`;
    }
    return e instanceof Error ? e.message : String(e);
}
//# sourceMappingURL=client.js.map