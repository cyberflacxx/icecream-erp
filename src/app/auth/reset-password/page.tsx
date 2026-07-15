'use client';

import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Swal from 'sweetalert2';

import { AuthShell } from '@/components/auth/auth-shell';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromQuery = searchParams.get('token') ?? '';
  const [token, setToken] = useState(tokenFromQuery);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tokenFromLink = tokenFromQuery.trim().length > 0;

  function validateForm() {
    const errors: Record<string, string> = {};
    if (!token.trim()) {
      errors.token = 'Reset token is required.';
    }
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }
    if (!confirmPassword || confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword: password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        await Swal.fire({
          icon: 'error',
          title: 'Reset Failed',
          html: `<p>${payload.error ?? 'Unable to reset password.'}</p>`,
          confirmButtonColor: '#1d4ed8',
          background: '#eff6ff',
          color: '#17212b',
        });
        return;
      }

      await Swal.fire({
        icon: 'success',
        title: 'Password Updated',
        html: '<p>Your password has been reset successfully.</p>',
        confirmButtonColor: '#1d4ed8',
        background: '#eff6ff',
        color: '#17212b',
      });

      router.push('/auth/login');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Credential Recovery"
      title="Reset Password"
      description="Open the emailed recovery link and create a new password that meets the current security policy."
    >
      <div className="auth-card">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-[color:var(--app-text)]">Reset Password</h1>
        <p className="mt-2 text-sm text-[color:var(--app-muted)]">
          {tokenFromLink
            ? 'Your reset link is loaded. Create a new password below.'
            : 'Paste your reset token if you opened the page without the email link.'}
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {tokenFromLink ? (
            <div className="auth-alert border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <p className="text-sm font-semibold">Recovery link detected</p>
              <p className="mt-1 text-sm">The secure reset token from your email is already attached to this request.</p>
            </div>
          ) : (
            <label className="auth-field">
              <span className="auth-label">Reset Token</span>
              <textarea
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  setFieldErrors((current) => ({ ...current, token: '' }));
                }}
                rows={3}
                className={`surface-textarea-soft ${fieldErrors.token ? 'auth-input-error' : token.trim() ? 'auth-input-valid' : ''}`}
              />
              {fieldErrors.token ? <p className="text-xs text-red-600">{fieldErrors.token}</p> : null}
            </label>
          )}

          <label className="auth-field">
            <span className="auth-label">New Password</span>
            <div className={`auth-input-shell ${fieldErrors.password ? 'auth-input-error' : password ? 'auth-input-valid' : ''}`}>
              <input
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, password: '' }));
                }}
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="text-xs font-semibold text-[color:var(--app-accent-strong)]"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password ? <p className="text-xs text-red-600">{fieldErrors.password}</p> : null}
          </label>

          <label className="auth-field">
            <span className="auth-label">Confirm Password</span>
            <div className={`auth-input-shell ${fieldErrors.confirmPassword ? 'auth-input-error' : confirmPassword ? 'auth-input-valid' : ''}`}>
              <input
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, confirmPassword: '' }));
                }}
                type={showConfirmPassword ? 'text' : 'password'}
                className="w-full bg-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="text-xs font-semibold text-[color:var(--app-accent-strong)]"
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.confirmPassword ? <p className="text-xs text-red-600">{fieldErrors.confirmPassword}</p> : null}
          </label>

          <button type="submit" disabled={isSubmitting} className="auth-primary-button">
            {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link href="/auth/forgot-password" className="auth-link">
            Back to forgot password
          </Link>
          <Link href="/auth/login" className="auth-link">
            Back to login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream px-6 py-10 text-sm text-brown dark:bg-darkBg dark:text-darkText">Loading reset form...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
