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

export const OTP_EMAIL_FAILURE_MESSAGE = 'OTP could not be sent. Please contact the system administrator.';

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

function safeEmailErrorMessage(value: unknown) {
  if (!(value instanceof Error) || !value.message) {
    return 'Unknown email delivery error';
  }

  return value.message.slice(0, 300);
}

function safeEmailErrorCode(value: unknown) {
  if (typeof value === 'object' && value !== null && 'code' in value) {
    const code = String((value as { code?: unknown }).code ?? '').trim();
    return code || 'UNKNOWN';
  }

  return 'UNKNOWN';
}

function logMissingSmtpRequirement(reason: string | null) {
  if (reason === 'SMTP host is not configured.') {
    console.error('OTP email config missing SMTP host.');
    return;
  }
  if (reason === 'SMTP user is not configured.') {
    console.error('OTP email config missing SMTP user.');
    return;
  }
  if (reason === 'SMTP password is not configured.') {
    console.error('OTP email config missing SMTP password.');
    return;
  }

  if (reason) {
    console.error('OTP email send failed with safe error code/message.', {
      code: 'SMTP_CONFIG_MISSING',
      message: reason,
    });
  }
}

function logSafeEmailSendFailure(error: unknown) {
  console.error('OTP email send failed with safe error code/message.', {
    code: safeEmailErrorCode(error),
    message: safeEmailErrorMessage(error),
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
  const readiness = getSmtpReadiness();
  if (!readiness.ok) {
    logMissingSmtpRequirement(readiness.reason);
  } else {
    try {
      return await sendViaSmtp(message);
    } catch (error) {
      logSafeEmailSendFailure(error);
    }
  }

  const apiKey = String(process.env.RESEND_API_KEY ?? '').trim();
  if (apiKey) {
    const to = Array.isArray(message.to) ? message.to : [message.to];

    try {
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
      logSafeEmailSendFailure({
        code: `RESEND_${response.status}`,
        message: errorText || response.statusText || 'Resend delivery failed',
      });
    } catch (error) {
      logSafeEmailSendFailure(error);
    }
  }

  throw new Error(OTP_EMAIL_FAILURE_MESSAGE);
}
