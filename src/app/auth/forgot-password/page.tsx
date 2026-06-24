'use client';

import Link from 'next/link';
import { useState } from 'react';
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
  const [resetToken, setResetToken] = useState<string | null>(null);
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
        resetToken?: string;
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

      setResetToken(payload.resetToken ?? null);
      setExpiresAt(payload.expiresAt ?? null);

      await Swal.fire({
        icon: 'success',
        title: 'Reset Token Generated',
        html: '<p>Your reset token is ready below. Use it immediately to set a new password.</p>',
        confirmButtonColor: '#F97316',
        background: '#fff7e8',
        color: '#3B1F12',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Credential Recovery"
      title="Forgot Password"
      description="Generate a reset token for a staff account using the assigned Work ID."
    >
      <div className="auth-card">
        <h1 className="text-3xl font-semibold text-brown dark:text-darkText">Forgot Password</h1>
        <p className="mt-2 text-sm text-muted dark:text-darkMuted">Enter your Work ID to generate a password reset token.</p>

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
            {isSubmitting ? 'Generating Token...' : 'Generate Reset Token'}
          </button>
        </form>

        {resetToken ? (
          <div className="auth-alert mt-6 border-orange/20 bg-[#fff7e8] text-brown dark:bg-orange/10 dark:text-darkText">
            <p className="text-sm font-semibold">Reset token</p>
            <p className="mt-2 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs dark:bg-darkCard">{resetToken}</p>
            <p className="mt-2 text-xs text-muted dark:text-darkMuted">Expires: {expiresAt ? new Date(expiresAt).toLocaleString() : 'Within 1 hour'}</p>
            <Link
              href={`/auth/reset-password?token=${encodeURIComponent(resetToken)}`}
              className="mt-4 inline-flex rounded-xl bg-brown px-4 py-2 text-sm font-semibold text-white transition hover:bg-brown/90"
            >
              Continue to reset password
            </Link>
          </div>
        ) : null}

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
