interface EmailMessage {
  html: string;
  subject: string;
  text?: string;
  to: string | string[];
}

function getEmailFromAddress() {
  return process.env.EMAIL_FROM || 'Absolute Ice Cream ERP <no-reply@absoluteicecream.local>';
}

function canUseSmtp() {
  return Boolean(
    process.env.EMAIL_HOST
      && process.env.EMAIL_PORT
      && process.env.EMAIL_USER
      && process.env.EMAIL_APP_PASSWORD,
  );
}

async function sendViaSmtp(message: EmailMessage) {
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    auth: {
      pass: process.env.EMAIL_APP_PASSWORD,
      user: process.env.EMAIL_USER,
    },
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: String(process.env.EMAIL_SECURE).toLowerCase() === 'true',
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
