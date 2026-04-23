/**
 * RFC 9728 path-appended PRM location for clients that compress "/api/mcp" to "/mcp".
 */
export { GET, OPTIONS } from '@/app/.well-known/oauth-protected-resource/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
