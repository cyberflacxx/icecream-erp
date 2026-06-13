interface EmailMessage {
  html: string;
  subject: string;
  text?: string;
  to: string | string[];
}

function getEmailFromAddress() {
  return process.env.EMAIL_FROM || 'Absolute Ice Cream ERP <no-reply@absoluteicecream.local>';
}

export async function sendTransactionalEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email delivery failed: ${errorText || response.statusText}`);
  }

  return response.json().catch(() => null);
}
