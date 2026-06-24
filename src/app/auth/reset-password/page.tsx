'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
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

  const passwordChecks = useMemo(
    () => ({
      digit: /[0-9]/.test(password),
      lowercase: /[a-z]/.test(password),
      minLength: password.length >= 8,
      special: /[^A-Za-z0-9]/.test(password),
      uppercase: /[A-Z]/.test(password),
    }),
    [password],
  );

  function validateForm() {
    const errors: Record<string, string> = {};
    if (!token.trim()) {
      errors.token = 'Reset token is required.';
    }
    if (!passwordChecks.minLength || !passwordChecks.uppercase || !passwordChecks.lowercase || !passwordChecks.digit || !passwordChecks.special) {
      errors.password = 'Password must include uppercase, lowercase, digit, special character, and 8 characters minimum.';
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
          confirmButtonColor: '#F97316',
          background: '#fff7e8',
          color: '#3B1F12',
        });
        return;
      }

      await Swal.fire({
        icon: 'success',
        title: 'Password Updated',
        html: '<p>Your password has been reset successfully.</p>',
        confirmButtonColor: '#F97316',
        background: '#fff7e8',
        color: '#3B1F12',
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
      description="Apply a valid reset token and create a new password that meets the current security policy."
    >
      <div className="auth-card">
        <h1 className="text-3xl font-semibold text-brown dark:text-darkText">Reset Password</h1>
        <p className="mt-2 text-sm text-muted dark:text-darkMuted">Use your reset token and create a new password.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-label">Reset Token</span>
            <textarea
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                setFieldErrors((current) => ({ ...current, token: '' }));
              }}
              rows={3}
              className={`w-full rounded-xl border px-3 py-3 outline-none transition dark:bg-darkCard dark:text-darkText ${
                fieldErrors.token ? 'auth-input-error' : token.trim() ? 'auth-input-valid' : 'border-border dark:border-darkBorder'
              }`}
            />
            {fieldErrors.token ? <p className="text-xs text-red-600">{fieldErrors.token}</p> : null}
          </label>

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
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-xs font-semibold text-orange">
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
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="text-xs font-semibold text-orange">
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
