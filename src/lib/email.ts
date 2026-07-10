interface EmailMessage {
  html: string;
  subject: string;
  text?: string;
  to: string | string[];
}

type EmailDeliveryReadiness = {
  ok: boolean;
  reason: string | null;
};

function firstConfiguredEnv(keys: string[], normalizer?: (value: string) => string) {
  for (const key of keys) {
    const rawValue = String(process.env[key] ?? '').trim();
    const value = normalizer ? normalizer(rawValue) : rawValue;
    if (value) return value;
  }

  return '';
}

function normalizeSecretValue(value: string) {
  return value.replace(/\s+/g, '');
}

export function getSmtpConfig() {
  return {
    from: firstConfiguredEnv(['SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM']),
    host: firstConfiguredEnv(['SMTP_HOST', 'EMAIL_HOST']),
    pass: firstConfiguredEnv(['SMTP_PASS', 'EMAIL_PASS', 'EMAIL_APP_PASSWORD'], normalizeSecretValue),
    port: firstConfiguredEnv(['SMTP_PORT', 'EMAIL_PORT']),
    secure: firstConfiguredEnv(['SMTP_SECURE', 'EMAIL_SECURE']),
    user: firstConfiguredEnv(['SMTP_USER', 'EMAIL_USER']),
  };
}

function getEmailFromAddress() {
  return getSmtpConfig().from || 'Absolute Ice Cream ERP <no-reply@absoluteicecream.local>';
}

export function getSmtpReadiness() {
  const smtp = getSmtpConfig();
  if (!smtp.host) {
    return { ok: false, reason: 'SMTP host is not configured.' } satisfies EmailDeliveryReadiness;
  }
  if (!smtp.user) {
    return { ok: false, reason: 'SMTP user is not configured.' } satisfies EmailDeliveryReadiness;
  }
  if (!smtp.pass) {
    return { ok: false, reason: 'SMTP password is not configured.' } satisfies EmailDeliveryReadiness;
  }
  if (!smtp.port) {
    return { ok: false, reason: 'SMTP port is not configured.' } satisfies EmailDeliveryReadiness;
  }

  return { ok: true, reason: null } satisfies EmailDeliveryReadiness;
}

function canUseSmtp() {
  return getSmtpReadiness().ok;
}

function logEmailFailure(details: { code?: string | null; message?: string | null; reason?: string | null }) {
  console.error('OTP email send failed', {
    code: details.code ?? null,
    message: details.message ?? null,
    reason: details.reason ?? null,
  });
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
      logEmailFailure({ message: errorText || response.statusText, reason: 'Resend delivery failed and SMTP is not ready.' });
      throw new Error('OTP could not be sent. Please check email configuration or contact the administrator.');
    }
  }

  const readiness = getSmtpReadiness();
  if (!readiness.ok) {
    logEmailFailure({ reason: readiness.reason });
    throw new Error('OTP could not be sent. Please check email configuration or contact the administrator.');
  }

  try {
    return await sendViaSmtp(message);
  } catch (error) {
    logEmailFailure({
      code: typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? '') : null,
      message: error instanceof Error ? error.message : 'Unknown SMTP error',
    });
    throw new Error('OTP could not be sent. Please check email configuration or contact the administrator.');
  }
}
