import { renderEmailShell } from '@/lib/email/layout';

export function inboundAttachmentTooLargeHtml({ appUrl }: { appUrl: string }): string {
  const body = `<p style="margin: 0 0 16px;">Got your email, but the photo didn't come through — it was too large to process.</p>
<p style="margin: 0 0 16px;">The easiest fix is to add it straight from the app, where there's no size limit.</p>`;

  return renderEmailShell({
    heading: "Photo didn't come through",
    body,
    cta: { label: 'Open the app', href: appUrl },
    signoff: '— Henry',
    footerKey: 'inbound_bounce',
  });
}
