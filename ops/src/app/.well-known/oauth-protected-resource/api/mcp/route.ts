/**
 * RFC 9728 path-appended PRM location for the /api/mcp resource.
 * Same JSON as the host-level PRM — resource is still the origin.
 */
export { GET, OPTIONS } from '@/app/.well-known/oauth-protected-resource/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
