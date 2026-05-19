# HeyHenry UX Foundation

The canonical UX foundation for HeyHenry lives in the **Ops knowledge vault** — search via the Ops MCP `knowledge_search`, or fetch by the IDs below. **Read the relevant ones before doing UI/UX work — design or implementation.** This file is just a pointer so a fresh session discovers the foundation; don't duplicate doc content here.

## Foundation docs (Ops vault)

| Doc | Vault ID |
|---|---|
| Positioning → Interface Translation | `5bfa59be-7640-448d-ae94-71a8219bf627` |
| Object Model (entity dictionary, ERD, lifecycles) | `b4d880be-190d-4cf4-b868-3ea46a23e48a` |
| Workflow Library (9 workflows as state machines) | `e0263cc3-9111-4bff-b2ec-e2a0335e12ed` |
| Role × Object Matrix (permissions + home bases) | `03b1ccf4-3413-4e7b-a822-cadc794d821a` |
| Design System Map & Gap Analysis | `f9bf30bf-5515-4c04-9d4a-ba75574fbceb` |

## Locked decisions (Ops decisions)

- Approved quote **auto-creates** the Project (no staged confirmation)
- Approved change orders apply to the Project budget; they do **not** auto-bill
- Bookkeeper lives in a **separate portal** (deferred — out of scope for the main app)
- **No bilingual/French** in V1 (English-only)
- **Henry is the intelligence behind every feature, not a chat** — the sidebar chat is fine as-is; don't enlarge/inline it

## The UX skills

The four skills in [`.claude/skills/heyhenry-*`](../../.claude/skills/) operationalize these docs:

- **heyhenry-design-critique** — score a screen (1–5 rubric), run the reject-if pass, produce a punch list
- **heyhenry-screen-design** — generate a build-ready screen spec from existing primitives + PATTERNS.md
- **heyhenry-workflow-mapping** — map a contractor flow as a state machine
- **heyhenry-ooux** — object & information-architecture modeling for a feature

Convention: the vault is canonical. Run Claude from this repo so the skills activate; the Ops MCP (global) provides vault search.
