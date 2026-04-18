export function quoteEmailHtml({
  customerName,
  businessName,
  quoteNumber,
  totalFormatted,
  viewUrl,
  validityDays = 30,
}: {
  customerName: string;
  businessName: string;
  quoteNumber: string;
  totalFormatted: string;
  viewUrl: string;
  validityDays?: number;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #0a0a0a;">Estimate from ${businessName}</h2>
  <p>Hi ${customerName.split(' ')[0]},</p>
  <p>${businessName} has prepared an estimate for <strong>${totalFormatted}</strong>.</p>
  <p>
    <a href="${viewUrl}" style="display: inline-block; padding: 12px 24px; background: #0a0a0a; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
      View Estimate
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">Estimate #${quoteNumber} is valid for ${validityDays} days. Final pricing may vary based on site conditions.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">Sent via HeyHenry</p>
</body>
</html>`;
}
