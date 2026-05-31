import nodemailer from 'nodemailer';

import { env } from '../config/env';

function getTransporter() {
  const rawPassword = env.EMAIL_APP_PASSWORD ?? env.EMAIL_PASSWORD;
  const emailPassword = rawPassword?.replace(/\s+/g, '');

  if (!env.EMAIL_HOST || !env.EMAIL_USER || !emailPassword) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    auth: {
      user: env.EMAIL_USER,
      pass: emailPassword
    }
  });
}

function buildWorkIdEmailHtml(firstName: string, workId: string, roleName: string) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f7efe5;padding:24px;">
      <div style="max-width:600px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid #ead7c4;background:#fff;">
        <div style="background:#3B1F12;color:#F8EBD8;padding:20px 24px;font-size:22px;font-weight:700;">
          Absolute Quality Icecream
        </div>
        <div style="padding:24px;color:#2f1b11;line-height:1.6;">
          <p>Welcome to Absolute Quality Icecream, ${firstName}.</p>
          <p>Your account has been created successfully.</p>
          <p style="margin:20px 0;">
            <span style="display:block;color:#7c4a2f;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Your Work ID</span>
            <span style="display:block;font-family:Consolas,monospace;font-size:30px;color:#F97316;font-weight:700;">${workId}</span>
          </p>
          <p><strong>Role:</strong> ${roleName}</p>
          <p>Please keep this Work ID safe. You will need it to log in to the system.</p>
          <p>Login at: ${env.NEXT_PUBLIC_APP_URL}/auth/login</p>
          <p>If you did not register for this account, please contact your administrator immediately.</p>
        </div>
        <div style="padding:16px 24px;background:#fff5ea;color:#7c4a2f;font-size:12px;">
          Absolute Ice Cream ERP
        </div>
      </div>
    </div>
  `;
}

export async function sendWorkIdEmail(to: string, firstName: string, workId: string, roleName: string) {
  const transporter = getTransporter();

  if (!transporter) {
    return {
      sent: false as const,
      reason: 'EMAIL_NOT_CONFIGURED'
    };
  }

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM ?? `${env.EMAIL_APP_NAME} <${env.EMAIL_USER}>`,
      to,
      subject: 'Your Absolute Ice Cream ERP Work ID',
      html: buildWorkIdEmailHtml(firstName, workId, roleName)
    });

    return {
      sent: true as const
    };
  } catch (error) {
    console.error('Failed to send Work ID email', error);

    return {
      sent: false as const,
      reason: 'EMAIL_SEND_FAILED'
    };
  }
}
