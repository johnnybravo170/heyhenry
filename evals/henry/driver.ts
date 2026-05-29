/**
 * Realtime-API driver: runs ONE scenario against the actual realtime model
 * (the thing a model swap changes), headless + text-only.
 *
 * Why the real Realtime WS and not a Chat-Completions stand-in: the swap
 * target (gpt-realtime-2) is a realtime-only model. Evaluating tool-calling on
 * a different API surface wouldn't answer "did the realtime swap regress." We
 * drive the real model server-side with OPENAI_API_KEY, set output to text
 * (we only care about the tool-call decision, not audio), feed the scenario's
 * user turns, feed canned tool outputs so multi-step recipes chain, and
 * capture every function_call.
 *
 * KNOWN DIVERGENCE FROM PROD (state it, don't hide it): this skips live
 * speech-to-text and audio turn-taking. Scenarios that care about STT mangling
 * carry deliberately-mangled names in their text. True audio-path eval is a V2
 * only if this text proxy proves insufficient.
 *
 * Everything is driven off the `response.done` event (the most stable event in
 * the realtime protocol) rather than streaming deltas.
 */

import WebSocket from 'ws';
import type { CapturedCall, Scenario } from './types';

export type DriverConfig = {
  apiKey: string;
  model: string;
  /** Per-scenario system prompt (getSystemPrompt + optional screen note). */
  instructions: string;
  /** toOpenAIRealtimeTools(allTools) + clientRealtimeTools. */
  tools: unknown[];
  maxCalls?: number;
  maxResponses?: number;
  timeoutMs?: number;
  verbose?: boolean;
};

type RealtimeOutputItem = {
  type?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
};

export async function captureToolCalls(
  scenario: Scenario,
  cfg: DriverConfig,
): Promise<{ calls: CapturedCall[]; error?: string }> {
  const maxCalls = cfg.maxCalls ?? 6;
  const maxResponses = cfg.maxResponses ?? 8;
  const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(cfg.model)}`;

  return new Promise((resolve) => {
    const calls: CapturedCall[] = [];
    const seen = new Set<string>();
    let turnIdx = 0;
    let responseCount = 0;
    let settled = false;

    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'OpenAI-Beta': 'realtime=v1' },
    });
    const timeout = setTimeout(() => finish('timeout'), cfg.timeoutMs ?? 45000);

    function finish(error?: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve({ calls, error });
    }

    function send(obj: Record<string, unknown>) {
      ws.send(JSON.stringify(obj));
      if (cfg.verbose) console.error('  →', obj.type);
    }

    function sendUserTurn() {
      const text = scenario.turns[turnIdx];
      turnIdx += 1;
      send({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
      });
      send({ type: 'response.create' });
    }

    function recordAndStub(item: RealtimeOutputItem) {
      const callId = item.call_id ?? `${item.name}:${calls.length}`;
      if (seen.has(callId)) return;
      seen.add(callId);
      let args: Record<string, unknown> = {};
      try {
        args = item.arguments ? (JSON.parse(item.arguments) as Record<string, unknown>) : {};
      } catch {
        args = { _unparseable: item.arguments };
      }
      calls.push({ tool: item.name ?? '(unnamed)', args, callId });
      if (cfg.verbose) console.error('  ⚙', item.name, JSON.stringify(args));
      // Feed a canned output so a chain can proceed. Scenario stub for this
      // tool if given, else a generic ok.
      if (item.call_id) {
        const stub = scenario.toolStubs?.[item.name ?? ''] ?? { ok: true };
        send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: item.call_id,
            output: JSON.stringify(stub),
          },
        });
      }
    }

    ws.on('open', () => {
      send({
        type: 'session.update',
        session: {
          instructions: cfg.instructions,
          tools: cfg.tools,
          tool_choice: 'auto',
          output_modalities: ['text'],
        },
      });
      sendUserTurn();
    });

    ws.on('message', (buf: WebSocket.RawData) => {
      let ev: { type?: string; response?: { output?: RealtimeOutputItem[] }; error?: unknown };
      try {
        ev = JSON.parse(buf.toString());
      } catch {
        return;
      }
      if (cfg.verbose && ev.type) console.error('  ←', ev.type);

      if (ev.type === 'error') {
        finish(`api error: ${JSON.stringify(ev.error ?? ev)}`);
        return;
      }

      if (ev.type === 'response.done') {
        responseCount += 1;
        const output = ev.response?.output ?? [];
        const fns = output.filter((o) => o.type === 'function_call');
        for (const fn of fns) recordAndStub(fn);

        if (calls.length >= maxCalls || responseCount >= maxResponses) {
          finish();
          return;
        }
        if (fns.length > 0) {
          // A tool fired this turn → let the model continue the chain.
          send({ type: 'response.create' });
        } else if (turnIdx < scenario.turns.length) {
          // Text-only response → advance to the next user turn.
          sendUserTurn();
        } else {
          // No tool call, no more turns → done.
          finish();
        }
      }
    });

    ws.on('error', (e: Error) => finish(`ws error: ${e.message}`));
    ws.on('close', () => finish());
  });
}
