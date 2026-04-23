<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Match existing patterns

Read `PATTERNS.md` at the start of any UI or flow change. It catalogs reusable patterns (upload zones, customer pick-or-create, confirm dialogs, inline edits, status badges, empty states, tabs, server-action result shape).

When you change one instance of a pattern (e.g. add drag-drop to the logo uploader), evaluate every sibling instance listed in `PATTERNS.md` for the same family and **surface them to the user with a "should I update these too?" prompt**. Do not silently update siblings, and do not silently skip them. Let the user decide per-sibling.

When you introduce a new flow worth standardizing — or extract a one-off into a reusable component — update `PATTERNS.md` in the same change.
