import nodemailer from 'nodemailer';
import { env } from '../lib/env';

/**
 * Transactional email service (SMTP). Configure with any provider:
 *
 *   Gmail (App Password), Brevo, Resend, Mailgun, Zoho...
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM
 *
 * In development without credentials, emails are logged to the console
 * instead of sent — flows stay testable end-to-end.
 */

let cachedTransport: nodemailer.Transporter | null = null;

export function mailConfigured(): boolean {
  return !!(env.smtp.host && env.smtp.user && env.smtp.pass);
}

function getTransport(): nodemailer.Transporter | null {
  if (!mailConfigured()) return null;
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user as string, pass: env.smtp.pass as string },
    // Fail fast instead of hanging the request when the SMTP provider is
    // unreachable or credentials are rejected.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return cachedTransport;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(message: MailMessage): Promise<{ sent: boolean; preview?: string }> {
  const transport = getTransport();
  if (!transport) {
    // Dev mode: log instead of send (tokens in dev are also returned by the API).
    const preview = `[dev mail] to=${message.to} subject="${message.subject}"\n${message.text}`;
    console.log(preview);
    return { sent: false, preview };
  }
  try {
    await transport.sendMail({
      from: env.smtp.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { sent: true };
  } catch (err) {
    // Never hang or crash the request on mail failure — log it for debugging.
    console.error('[mailer] send failed:', err instanceof Error ? err.message : err);
    return { sent: false };
  }
}

/** Branded password-reset email. */
export function passwordResetEmail(resetUrl: string, displayName: string): Omit<MailMessage, 'to'> {
  const subject = 'Reset your SkillSwap password';
  const text = `Hi ${displayName},\n\nWe received a request to reset your SkillSwap password.\n\nOpen this link to choose a new one (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email — your password stays unchanged.\n\n— The SkillSwap team`;
  const html = `
  <div style="font-family:Outfit,Segoe UI,Arial,sans-serif;background:#faf4ea;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;border:1px solid rgba(18,28,41,0.08)">
      <div style="font-size:24px;font-weight:700;color:#121c29">Skill<span style="color:#f94b28">Swap</span></div>
      <p style="color:#121c29;font-size:15px;margin:20px 0 6px">Hi ${displayName},</p>
      <p style="color:#5b6774;font-size:14px;line-height:1.6;margin:0 0 24px">
        We received a request to reset your password. Click the button below to
        choose a new one. This link is valid for 1 hour.
      </p>
      <a href="${resetUrl}"
        style="display:inline-block;background:#f94b28;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:999px;font-size:14px">
        Reset my password
      </a>
      <p style="color:#8a93a0;font-size:12px;margin:24px 0 0">
        If you didn't request this, ignore this email — your password stays unchanged.
      </p>
    </div>
  </div>`;
  return { subject, text, html };
}
