/**
 * POST /api/henry/session
 *
 * Returns the Gemini Live session config (API key, model, system prompt, tool
 * declarations) the authenticated client needs to open a Live WebSocket.
 *
 * SECURITY — PRIVATE BETA ONLY:
 * We return the raw GEMINI_API_KEY to authenticated clients. Ephemeral tokens
 * (authTokens.create) mint successfully on AI Studio keys but force the Live
 * WebSocket to API version "v1main" where no Live model is registered, so the
 * socket closes with 1008 immediately. Until Google fixes that or we move to
 * Vertex AI, the pragmatic path is to expose the key.
 *
 * Mitigations: only authenticated tenants can hit this route; the key only
 * grants Gemini API access (not billing, not Google Cloud-wide).
 *
 * Before public launch we'll swap to a server-side WebSocket proxy so the key
 * never leaves the server. Tracked in HEY_HENRY_APP_PLAN.md.
 */

import { getSystemPrompt } from '@/lib/ai/system-prompt';
import { allTools } from '@/lib/ai/tools';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { toGeminiFunctionDeclarations } from '@/lib/henry/adapter';
import { clientFunctionDeclarations } from '@/lib/henry/client-tools';

// Gemini 3.1 Flash Live preview. Replaced 2.5-flash-native-audio-preview-09-2025
// (deprecated 2026-03-19) on 2026-04-21. 3.1 reports ~90% function-calling
// adherence (vs 84% on 2.5) — material for the 17-tool loop. Paired with
// `thinkingLevel: MINIMAL` on the client for lower TTFT.
const LIVE_MODEL = 'gemini-3.1-flash-live-preview';

export async function POST() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'Server missing GEMINI_API_KEY' }, { status: 500 });
    }

    const systemPrompt = getSystemPrompt(tenant.name, tenant.timezone, tenant.vertical);
    const tools = [...toGeminiFunctionDeclarations(allTools), ...clientFunctionDeclarations];

    return Response.json({
      token: apiKey,
      model: LIVE_MODEL,
      systemPrompt,
      tools,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Henry session] unexpected failure:', msg, e);
    return Response.json({ error: `Session route crashed: ${msg}` }, { status: 500 });
  }
}
