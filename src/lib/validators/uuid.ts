/**
 * Tiny UUID-shape predicate for route-param guards.
 *
 * Use at the entry of `/<thing>/[id]` server components (and adjacent server
 * helpers) so that a malformed id — a typo, a stale bookmark, or a vision-
 * driven QA agent constructing `/projects/Maple Heights Full Home Reno` from
 * a link's label instead of clicking the `<Link>` — turns into a clean 404
 * via `notFound()`, not a 500 (`invalid input syntax for type uuid: "..."`
 * from Postgres bubbling out of a parallel fetch).
 *
 * Accepts any RFC-4122 version (`[1-8]`) including v4 (`gen_random_uuid()`)
 * and v7 (createdAt-sortable, used in some HeyHenry tables). Case-insensitive.
 * Does NOT accept the nil UUID or wildcard FFFF... forms — those aren't valid
 * row ids in this app.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
