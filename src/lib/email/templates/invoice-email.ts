export function invoiceEmailHtml({
  customerName,
  businessName,
  invoiceNumber,
  totalFormatted,
  payUrl,
  customerNote,
}: {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  totalFormatted: string;
  payUrl: string;
  customerNote?: string | null;
}): string {
  const noteBlock = customerNote
    ? `<div style="background: #f9fafb; border-left: 3px solid #d1d5db; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="color: #374151; font-size: 14px; margin: 0; white-space: pre-wrap;">${customerNote}</p>
  </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #0a0a0a;">Invoice from ${businessName}</h2>
  <p>Hi ${customerName.split(' ')[0]},</p>
  <p>${businessName} has sent you an invoice for <strong>${totalFormatted}</strong>.</p>
  ${noteBlock}
  <p>
    <a href="${payUrl}" style="display: inline-block; padding: 12px 24px; background: #0a0a0a; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
      Pay Now
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">Invoice #${invoiceNumber}. Payment is processed securely via Stripe.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">Sent via HeyHenry</p>
</body>
</html>`;
}
