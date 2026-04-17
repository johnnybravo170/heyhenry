/**
 * Referral code generator.
 *
 * Generates a deterministic, URL-safe referral code from a tenant's
 * business name. Falls back to a random 8-char string when the name
 * is empty or entirely non-alphanumeric.
 */

/**
 * Generate a referral code from a tenant/business name.
 *
 * Rules:
 *   1. Lowercase the name
 *   2. Replace spaces and non-alphanumeric chars with hyphens
 *   3. Collapse consecutive hyphens
 *   4. Trim leading/trailing hyphens
 *   5. Truncate to 20 chars (at a hyphen boundary when possible)
 *   6. If the result is empty, use a random 8-char alphanumeric string
 */
export function generateReferralCode(tenantName: string): string {
  const slug = tenantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    return randomCode(8);
  }

  if (slug.length <= 20) {
    return slug;
  }

  // Truncate at a hyphen boundary so we don't cut mid-word.
  const truncated = slug.slice(0, 20);
  const lastHyphen = truncated.lastIndexOf('-');
  if (lastHyphen > 4) {
    return truncated.slice(0, lastHyphen);
  }
  return truncated;
}

function randomCode(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
