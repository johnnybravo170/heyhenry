# @heyhenry/mcp-ops

MCP server (stdio) that wraps the HeyHenry Ops HTTP API as tools so background agents (Claude Code Routines, Claude Desktop, anything MCP-compatible) can call them without re-implementing HMAC signing.

## Install

```bash
cd mcp-ops
pnpm install
pnpm build
```

## Env vars

| Var | Required | Description |
|---|---|---|
| `OPS_API_KEY` | yes\* | Full key in `ops_<id>_<secret>` form |
| `OPS_API_KEY_ID` | yes\* | Alternative split form: keyId |
| `OPS_API_KEY_SECRET` | yes\* | Alternative split form: secret |
| `OPS_ACTOR_NAME` | recommended | Slug auto-stamped on every write, e.g. `competitive-research` |
| `OPS_BASE_URL` | no | Default `https://ops.heyhenry.io` |

\* Provide either `OPS_API_KEY` or both `OPS_API_KEY_ID` + `OPS_API_KEY_SECRET`.

The key's scopes (granted by the admin at creation) decide which tools actually succeed — `competitive-research` keys won't be allowed to write to roadmap, etc.

## Tools

| Module | Tools |
|---|---|
| competitors | `competitors_list`, `competitors_get`, `competitors_upsert` |
| incidents | `incidents_open`, `incidents_list_open`, `incidents_get`, `incidents_update_status`, `incidents_escalate_sms` |
| social_drafts | `social_drafts_list`, `social_drafts_create_draft`, `social_drafts_update_status` |
| docs | `docs_list`, `docs_get`, `docs_upsert`, `docs_search_by_module` |
| worklog | `worklog_add_note`, `worklog_search` |
| knowledge | `knowledge_search`, `knowledge_upsert` |
| roadmap | `roadmap_list`, `roadmap_get`, `roadmap_create`, `roadmap_update_status` |
| ideas | `ideas_list`, `ideas_create` |
| decisions | `decisions_list`, `decisions_create`, `decisions_record_outcome` |
| review_queue | `review_queue_fetch` |

`actor_name` is injected automatically from `OPS_ACTOR_NAME`; tool callers never need to pass it.

## Connector config (Claude Code Routine)

```json
{
  "mcpServers": {
    "heyhenry-ops": {
      "command": "node",
      "args": ["/absolute/path/to/heyhenry/mcp-ops/dist/index.js"],
      "env": {
        "OPS_BASE_URL": "https://ops.heyhenry.io",
        "OPS_API_KEY": "ops_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx_<secret>",
        "OPS_ACTOR_NAME": "competitive-research"
      }
    }
  }
}
```

For local dev you can swap `node dist/index.js` for `npx tsx src/index.ts`.

## How signing works

Every request is signed against the ops API exactly the way `ops/src/lib/api-auth.ts` expects:

```
Authorization: Bearer ops_<id>_<secret>
X-Ops-Timestamp: <unix seconds>
X-Ops-Signature: hex(HMAC-SHA256(secret, `${timestamp}|${METHOD}|${path}|${sha256(body)}`))
```

`path` includes the querystring; `body` is `''` for GET. ±5-minute timestamp window. See `src/client.ts`.
