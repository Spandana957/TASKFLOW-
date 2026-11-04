import { Resend } from 'resend';
import { config, emailConfigured } from '../config.js';

let client: Resend | null = null;
function resend() {
  if (!client) client = new Resend(config.resendApiKey);
  return client;
}

export type EmailResult =
  | { status: 'sent'; id: string }
  | { status: 'failed'; error: string }
  | { status: 'not_configured' };

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Sends a reminder email through Resend. Only reports `sent` when Resend
 * returns a message id — never fakes delivery.
 */
export async function sendReminderEmail(opts: {
  to: string;
  name: string;
  title: string;
  message: string;
  when: Date;
  idempotencyKey: string;
}): Promise<EmailResult> {
  if (!emailConfigured()) return { status: 'not_configured' };
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
    <h2 style="margin:0 0 4px;color:#4f46e5">⏰ TaskFlow reminder</h2>
    <p style="color:#6b7280;margin:0 0 16px">Hi ${escape(opts.name)}, this is your scheduled reminder.</p>
    <h3 style="margin:0 0 8px">${escape(opts.title)}</h3>
    ${opts.message ? `<p>${escape(opts.message)}</p>` : ''}
    <p style="color:#6b7280;font-size:13px">Scheduled for ${opts.when.toUTCString()}</p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Plan Your Day. Focus on What Matters. Achieve More.</p>
  </div>`;
  try {
    const { data, error } = await resend().emails.send(
      {
        from: config.emailFrom,
        to: opts.to,
        subject: `Reminder: ${opts.title}`,
        html,
        text: `${opts.title}\n\n${opts.message}\n\nScheduled for ${opts.when.toUTCString()}`,
      },
      { idempotencyKey: opts.idempotencyKey },
    );
    if (error || !data?.id) return { status: 'failed', error: error?.message ?? 'No message id returned' };
    return { status: 'sent', id: data.id };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}
