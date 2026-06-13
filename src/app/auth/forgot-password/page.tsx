'use client';

import Link from 'next/link';
import { useState } from 'react';
import Swal from 'sweetalert2';

const workIdPattern = /^AQI-[0-9]{8}$/;

export default function ForgotPasswordPage() {
  const [workId, setWorkId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workIdError, setWorkIdError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  function validateWorkId(value: string) {
    if (!value.trim() || !workIdPattern.test(value)) {
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
        body: JSON.stringify({ workId: workId.trim().toUpperCase() }),
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
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-10">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-soft">
        <p className="text-sm uppercase tracking-[0.22em] text-orange">Absolute Ice Cream ERP</p>
        <h1 className="mt-3 text-3xl font-semibold text-brown">Forgot Password</h1>
        <p className="mt-2 text-sm text-muted">Enter your Work ID to generate a password reset token.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-brown">Work ID</span>
            <input
              value={workId}
              onChange={(event) => {
                setWorkId(event.target.value.toUpperCase());
                setWorkIdError(null);
              }}
              onBlur={() => setWorkIdError(validateWorkId(workId))}
              placeholder="e.g. AQI-20260034"
              autoComplete="username"
              className={`h-11 w-full rounded-xl border px-3 outline-none transition ${
                workIdError ? 'border-red-500 bg-red-50' : workIdPattern.test(workId) ? 'border-green-500' : 'border-border'
              }`}
            />
            {workIdError ? <p className="text-xs text-red-600">{workIdError}</p> : null}
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-[#F97316] font-semibold text-white transition hover:bg-[#ea6a0a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Generating Token...' : 'Generate Reset Token'}
          </button>
        </form>

        {resetToken ? (
          <div className="mt-6 rounded-2xl border border-orange/20 bg-[#fff7e8] p-4">
            <p className="text-sm font-semibold text-brown">Reset token</p>
            <p className="mt-2 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-brown">{resetToken}</p>
            <p className="mt-2 text-xs text-muted">Expires: {expiresAt ? new Date(expiresAt).toLocaleString() : 'Within 1 hour'}</p>
            <Link
              href={`/auth/reset-password?token=${encodeURIComponent(resetToken)}`}
              className="mt-4 inline-flex rounded-xl bg-[#3B1F12] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4b2817]"
            >
              Continue to reset password
            </Link>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link href="/auth/login" className="font-semibold text-orange transition hover:text-[#ea6a0a]">
            Back to login
          </Link>
          <Link href="/" className="font-semibold text-orange transition hover:text-[#ea6a0a]">
            Return to main page
          </Link>
        </div>
      </div>
    </main>
  );
}
