'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import Swal from 'sweetalert2';

import { AuthShell } from '@/components/auth/auth-shell';

const workIdPattern = /^AQI-[0-9]{8}$/;

function normalizeWorkId(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export default function ForgotPasswordPage() {
  const [workId, setWorkId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workIdError, setWorkIdError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  function validateWorkId(value: string) {
    const normalized = normalizeWorkId(value);
    if (!normalized || !workIdPattern.test(normalized)) {
      return 'Please enter a valid Work ID (format: AQI-XXXXXXXX)';
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const error = validateWorkId(workId);
    setWorkIdError(error);
    if (error) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId: normalizeWorkId(workId) }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        expiresAt?: string;
        success?: boolean;
      };

      if (!response.ok) {
        await Swal.fire({
          icon: 'error',
          title: 'Reset Request Failed',
          html: `<p>${payload.error ?? 'Unable to request password reset.'}</p>`,
          confirmButtonColor: '#F97316',
          background: '#fff7e8',
          color: '#3B1F12',
        });
        return;
      }

      setExpiresAt(payload.expiresAt ?? null);

      await Swal.fire({
        icon: 'success',
        title: 'Reset Email Sent',
        html: '<p>If the Work ID exists, a password reset link has been sent to the registered email address.</p>',
        confirmButtonColor: '#1d4ed8',
        background: '#eff6ff',
        color: '#17212b',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Credential Recovery"
      title="Forgot Password"
      description="Request a password reset link for a staff account using the assigned Work ID."
    >
      <div className="auth-card">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]">
          <MailCheck className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-[color:var(--app-text)]">Forgot Password</h1>
        <p className="mt-2 text-sm text-[color:var(--app-muted)]">
          Enter your Work ID and we will email a secure password reset link to the registered address.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-label">Work ID</span>
            <input
              value={workId}
              onChange={(event) => {
                setWorkId(normalizeWorkId(event.target.value));
                setWorkIdError(null);
              }}
              onBlur={() => {
                const normalized = normalizeWorkId(workId);
                setWorkId(normalized);
                setWorkIdError(validateWorkId(normalized));
              }}
              placeholder="e.g. AQI-20260034"
              autoComplete="username"
              className={`auth-input ${workIdError ? 'auth-input-error' : workIdPattern.test(normalizeWorkId(workId)) ? 'auth-input-valid' : ''}`}
            />
            {workIdError ? <p className="text-xs text-red-600">{workIdError}</p> : null}
          </label>

          <button type="submit" disabled={isSubmitting} className="auth-primary-button">
            {isSubmitting ? 'Sending Reset Link...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="auth-alert mt-6 border border-[color:var(--app-border)] bg-[color:var(--app-bg-default)] text-[color:var(--app-muted)]">
          <p className="text-sm font-semibold text-[color:var(--app-text)]">What happens next</p>
          <p className="mt-2 text-sm">
            The reset link expires {expiresAt ? `at ${new Date(expiresAt).toLocaleString()}` : 'within 1 hour'} and can only be used once.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link href="/auth/login" className="auth-link">
            Back to login
          </Link>
          <Link href="/" className="auth-link">
            Return to main page
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
