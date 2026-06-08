#!/usr/bin/env node
// od-driver.mjs — thin transport for the local Open Design (OD) daemon.
// Discovers the running daemon, submits a design run, waits for it to finish.
// Zero deps, Node 18+ (global fetch). The judgment (prompt, critique, decide)
// lives in the od-redesign-loop SKILL.md and the heyhenry-* skills it calls;
// this file only moves a prompt in and a run-result out.
//
// Run contract (verified against apps/daemon/src/runs.ts):
//   POST /api/runs { projectId, conversationId, message, agentId, skillId } -> { runId }
//   GET  /api/runs/:id -> { status, ... }   status terminal at succeeded|failed|canceled
// The render itself is a file the OD agent edits in place under
// od-project-hub/screens/*.html — read it with your normal file tools.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const pexec = promisify(execFile);
const TERMINAL = new Set(['succeeded', 'failed', 'canceled']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(baseUrl, ms = 1500) {
  try {
    const res = await fetch(`${baseUrl}/api/projects`, { signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body?.projects) ? baseUrl : null;
  } catch {
    return null;
  }
}

// Dev-mode OD picks a dynamic port, so we can't hardcode one. Set OD_BASE_URL
// to skip discovery; otherwise scan local LISTEN sockets and probe each.
async function discover() {
  if (process.env.OD_BASE_URL) {
    const ok = await probe(process.env.OD_BASE_URL, 4000);
    if (ok) return ok;
    throw new Error(`OD_BASE_URL=${process.env.OD_BASE_URL} set but no OD daemon answered there`);
  }
  let ports = [];
  try {
    const { stdout } = await pexec('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { maxBuffer: 8 << 20 });
    const seen = new Set();
    for (const line of stdout.split('\n')) {
      const m = line.match(/(?:127\.0\.0\.1|\*|\[::1\]):(\d+)\b/);
      if (m) seen.add(Number(m[1]));
    }
    ports = [...seen];
  } catch {
    /* lsof unavailable — fall through to the empty-list error below */
  }
  const hits = await Promise.all(ports.map((p) => probe(`http://127.0.0.1:${p}`)));
  const found = hits.find(Boolean);
  if (!found) throw new Error('No running OD daemon found. Start Open Design (pnpm tools-dev) or set OD_BASE_URL.');
  return found;
}

async function api(baseUrl, path, init) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${init?.method || 'GET'} ${path} -> ${res.status}: ${String(text).slice(0, 300)}`);
  return body;
}

async function resolveConversation(baseUrl, projectId, given) {
  if (given) return given;
  const { conversations = [] } = await api(baseUrl, `/api/projects/${projectId}/conversations`);
  if (!conversations.length) return null;
  conversations.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));
  return conversations[0].id;
}

async function runDesign(baseUrl, opts) {
  const conversationId = await resolveConversation(baseUrl, opts.project, opts.conversation);
  const payload = {
    projectId: opts.project,
    conversationId,
    message: opts.message,
    agentId: opts.agent || 'claude',
    skillId: opts.skill || 'agent-browser',
    ...(opts.model ? { model: opts.model } : {}),
  };
  const { runId } = await api(baseUrl, '/api/runs', { method: 'POST', body: JSON.stringify(payload) });
  const timeoutSec = opts.timeout ?? 1800;
  const deadline = Date.now() + timeoutSec * 1000;
  let status = 'queued';
  while (Date.now() < deadline) {
    await sleep(2000);
    const body = await api(baseUrl, `/api/runs/${runId}`);
    status = body.status;
    process.stderr.write(`\r[od-driver] run ${runId.slice(0, 8)} status=${status}        `);
    if (TERMINAL.has(status)) {
      process.stderr.write('\n');
      return { runId, conversationId, status, exitCode: body.exitCode ?? null };
    }
  }
  throw new Error(`run ${runId} did not finish within ${timeoutSec}s (last status=${status}); resume with: status --run ${runId}`);
}

function parseFlags(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    o[k] = next === undefined || next.startsWith('--') ? true : argv[++i];
  }
  return o;
}

const USAGE = `od-driver — drive the local Open Design daemon

  node od-driver.mjs discover
  node od-driver.mjs projects
  node od-driver.mjs conversations --project <id>
  node od-driver.mjs run --project <id> (--message <text> | --message-file <path>) \\
       [--conversation <id>] [--skill agent-browser] [--agent claude] [--model <id>] [--timeout 1800]
  node od-driver.mjs status --run <id>

Env: OD_BASE_URL=http://127.0.0.1:PORT  (skip port discovery)`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (cmd === 'discover') {
    console.log(await discover());
    return;
  }

  const baseUrl = await discover();

  if (cmd === 'projects') {
    const { projects = [] } = await api(baseUrl, '/api/projects');
    for (const p of projects) console.log(`${p.id}\t${p.skillId ?? '-'}\t${p.status?.value ?? '-'}\t${p.name}`);
    return;
  }
  if (cmd === 'conversations') {
    if (!flags.project) throw new Error('conversations requires --project');
    const { conversations = [] } = await api(baseUrl, `/api/projects/${flags.project}/conversations`);
    for (const c of conversations) {
      console.log(`${c.id}\t${new Date(c.updatedAt ?? c.createdAt ?? 0).toISOString()}\t${c.title ?? '(untitled)'}`);
    }
    return;
  }
  if (cmd === 'status') {
    if (!flags.run) throw new Error('status requires --run');
    console.log(JSON.stringify(await api(baseUrl, `/api/runs/${flags.run}`), null, 2));
    return;
  }
  if (cmd === 'run') {
    if (!flags.project) throw new Error('run requires --project');
    let message = flags.message;
    if (flags['message-file']) message = await readFile(flags['message-file'], 'utf8');
    if (!message || message === true) throw new Error('run requires --message <text> or --message-file <path>');
    const out = await runDesign(baseUrl, {
      project: flags.project,
      message,
      conversation: flags.conversation,
      skill: flags.skill,
      agent: flags.agent,
      model: flags.model,
      timeout: flags.timeout ? Number(flags.timeout) : undefined,
    });
    console.log(JSON.stringify(out));
    if (out.status !== 'succeeded') process.exitCode = 1;
    return;
  }

  console.error(USAGE);
  process.exitCode = 2;
}

main().catch((e) => {
  process.stderr.write(`[od-driver] error: ${e.message}\n`);
  process.exitCode = 1;
});
