#!/usr/bin/env node
/**
 * @heyhenry/mcp-ops — MCP server (stdio) wrapping the HeyHenry Ops HTTP API.
 *
 * Background Claude Code Routines load this as a connector. Each routine ships
 * with its own scoped OPS_API_KEY so a research agent cannot, for example,
 * write to the roadmap.
 *
 * Required env:
 *   OPS_API_KEY        — `ops_<id>_<secret>` (or split via OPS_API_KEY_ID/SECRET)
 *   OPS_ACTOR_NAME     — short slug for the agent, e.g. "competitive-research"
 *
 * Optional env:
 *   OPS_BASE_URL       — defaults to https://ops.heyhenry.io
 */
export {};
