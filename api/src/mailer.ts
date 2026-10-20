import { config } from './config';
import { HttpError } from './http';

export type Email = { to: string; subject: string; text: string; html: string };

/**
 * Sends email through Resend (resend.com). Without RESEND_API_KEY, development prints the
 * email to the server log instead, and production refuses so nobody waits for a code that
 * will never arrive. Tests swap `mailer.send` out.
 */
export const mailer = {
  configured() {
    return !!config.resendApiKey || !config.isProduction;
  },
  async send(email: Email) {
    if (!config.resendApiKey) {
      if (config.isProduction) throw new HttpError(503, 'email_not_configured');
      console.log(`[email to ${email.to}] ${email.subject}\n${email.text}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    });
    if (!res.ok) {
      console.error('email send failed', res.status, await res.text().catch(() => ''));
      throw new HttpError(502, 'email_failed');
    }
  },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function resetCodeEmail(to: string, name: string, code: string, language: 'en' | 'vi'): Email {
  const vi = language === 'vi';
  const subject = vi ? `Mã đặt lại mật khẩu Tastr: ${code}` : `Your Tastr password reset code: ${code}`;
  const lines = vi
    ? [`Chào ${name},`, `Mã đặt lại mật khẩu của bạn là: ${code}`, 'Mã có hiệu lực trong 15 phút.', 'Nếu bạn không yêu cầu, cứ bỏ qua email này. Mật khẩu của bạn vẫn giữ nguyên.']
    : [`Hi ${name},`, `Your password reset code is: ${code}`, 'It works for 15 minutes.', "If you didn't ask for this, ignore this email. Your password stays as it is."];
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#2B1D14">
<p>${esc(lines[0])}</p><p>${esc(lines[1].replace(code, '')).trim()}</p>
<p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p>
<p>${esc(lines[2])}</p><p style="color:#7A6556">${esc(lines[3])}</p></div>`;
  return { to, subject, text: lines.join('\n\n'), html };
}
