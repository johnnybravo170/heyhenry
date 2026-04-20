// Goes TO the operator when a customer accepts or declines an estimate, so
// no tenant logo at the top — we'd just be showing the operator their own
// logo. Linked footer still applies.

import { brandingFooterHtml } from '@/lib/email/branding';

export function quoteResponseEmailHtml({
  type,
  customerName,
  quoteNumber,
  totalFormatted,
  reason,
  viewUrl,
}: {
  type: 'accepted' | 'declined';
  customerName: string;
  quoteNumber: string;
  totalFormatted: string;
  reason?: string;
  viewUrl: string;
}): string {
  if (type === 'accepted') {
    return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="color: #0a0a0a;">${customerName} accepted your estimate!</h2>
  <p>${customerName} just accepted estimate #${quoteNumber} for <strong>${totalFormatted}</strong>. Ready to schedule the job?</p>
  <p>
    <a href="${viewUrl}" style="display: inline-block; padding: 12px 24px; background: #0a0a0a; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
      View in HeyHenry
    </a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  ${brandingFooterHtml('quote_response')}
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="color: #0a0a0a;">Estimate declined — ${customerName}</h2>
  <p>${customerName} declined estimate #${quoteNumber}. ${reason ? `Reason: ${reason}` : 'No reason given.'}</p>
  <p>
    <a href="${viewUrl}" style="display: inline-block; padding: 12px 24px; background: #0a0a0a; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
      View in HeyHenry
    </a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  ${brandingFooterHtml('quote_response')}
</body>
</html>`;
}
