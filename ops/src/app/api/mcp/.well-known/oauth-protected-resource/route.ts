/**
 * Path-suffixed RFC 9728 location. Some MCP clients (per the spec) probe
 * `<resource_url>/.well-known/oauth-protected-resource` instead of the
 * host-level location. Re-export the same handlers.
 */
export { GET, OPTIONS } from '@/app/.well-known/oauth-protected-resource/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
