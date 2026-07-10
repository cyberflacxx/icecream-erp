interface EmailMessage {
  html: string;
  subject: string;
  text?: string;
  to: string | string[];
}

function firstConfiguredEnv(keys: string[]) {
  for (const key of keys) {
    const value = String(process.env[key] ?? '').trim();
    if (value) return value;
  }

  return '';
}

function getSmtpConfig() {
  return {
    from: firstConfiguredEnv(['SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM']),
    host: firstConfiguredEnv(['SMTP_HOST', 'EMAIL_HOST']),
    pass: firstConfiguredEnv(['SMTP_PASS', 'EMAIL_APP_PASSWORD']),
    port: firstConfiguredEnv(['SMTP_PORT', 'EMAIL_PORT']),
    secure: firstConfiguredEnv(['SMTP_SECURE', 'EMAIL_SECURE']),
    user: firstConfiguredEnv(['SMTP_USER', 'EMAIL_USER']),
  };
}

function getEmailFromAddress() {
  return getSmtpConfig().from || 'Absolute Ice Cream ERP <no-reply@absoluteicecream.local>';
}

function canUseSmtp() {
  const smtp = getSmtpConfig();
  return Boolean(
    smtp.host
      && smtp.port
      && smtp.user
      && smtp.pass,
  );
}

async function sendViaSmtp(message: EmailMessage) {
  const smtp = getSmtpConfig();
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    auth: {
      pass: smtp.pass,
      user: smtp.user,
    },
    host: smtp.host,
    port: Number(smtp.port),
    secure: String(smtp.secure).toLowerCase() === 'true',
  });

  return transporter.sendMail({
    from: getEmailFromAddress(),
    html: message.html,
    subject: message.subject,
    text: message.text,
    to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
  });
}

export async function sendTransactionalEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const to = Array.isArray(message.to) ? message.to : [message.to];
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getEmailFromAddress(),
        to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (response.ok) {
      return response.json().catch(() => null);
    }

    const errorText = await response.text();
    if (!canUseSmtp()) {
      throw new Error(`Email delivery failed: ${errorText || response.statusText}`);
    }
  }

  if (!canUseSmtp()) {
    throw new Error('Email delivery is not configured.');
  }

  return sendViaSmtp(message);
}
