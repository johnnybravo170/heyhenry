import { FROM_EMAIL, getResend } from './client';

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: from || FROM_EMAIL,
      to,
      subject,
      html,
      replyTo,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.contentType,
      })),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown email error' };
  }
}
