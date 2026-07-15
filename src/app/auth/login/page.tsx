'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, IdCard, KeyRound } from 'lucide-react';
import Swal from 'sweetalert2';

import { AuthShell } from '@/components/auth/auth-shell';

const workIdPattern = /^AQI-[0-9]{8}$/;

function normalizeWorkId(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export default function LoginPage() {
  const router = useRouter();
  const [workId, setWorkId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [workIdError, setWorkIdError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateWorkId(value: string) {
    const normalized = normalizeWorkId(value);
    if (!normalized || !workIdPattern.test(normalized)) {
      return 'Please enter a valid Work ID (format: AQI-XXXXXXXX)';
    }
    return null;
  }

  function validatePassword(value: string) {
    if (!value.trim()) return 'Please enter your password';
    return null;
  }

  const canSubmit = Boolean(workIdPattern.test(normalizeWorkId(workId)) && password.length > 0 && !isSubmitting);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const wErr = validateWorkId(workId);
    const pErr = validatePassword(password);
    setWorkIdError(wErr);
    setPasswordError(pErr);
    if (wErr || pErr) return;

    setIsSubmitting(true);

    Swal.fire({
      title: 'Signing you in...',
      html: 'Verifying your credentials.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
      background: '#fff7e8',
      color: '#3B1F12',
    });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId: normalizeWorkId(workId), password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        const errorMessage = payload.error ?? 'Login failed.';
        const isInvalid =
          response.status === 401 ||
          errorMessage.toLowerCase().includes('invalid') ||
          errorMessage.toLowerCase().includes('credentials');

        await Swal.fire({
          icon: 'error',
          title: isInvalid ? 'Incorrect Credentials' : 'Login Failed',
          html: isInvalid
            ? '<p>Work ID or password is incorrect.</p><p style="margin-top:8px;font-size:0.85rem;color:#666">Check your Work ID format (AQI-XXXXXXXX) and try again.</p>'
            : `<p>${errorMessage}</p>`,
          confirmButtonColor: '#F97316',
          background: '#fff7e8',
          color: '#3B1F12',
        });
        return;
      }

      await Swal.fire({
        icon: 'success',
        title: 'Welcome back!',
        html: '<p>Signed in successfully.</p><p style="margin-top:8px;font-size:0.85rem;color:#666">Redirecting to your dashboard...</p>',
        timer: 1600,
        timerProgressBar: true,
        showConfirmButton: false,
        background: '#fff7e8',
        color: '#3B1F12',
        iconColor: '#22c55e',
      });

      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Unexpected Error',
        html: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
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
      eyebrow="Secure Staff Access"
      title="Staff Login Portal"
      description="Sign in with your Work ID and password to access your role-specific dashboard and operational tools."
    >
      <div className="auth-card">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--app-subtle)]">
            Staff authentication
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--app-text)]">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-[color:var(--app-muted)]">
            Sign in with your Work ID and password.
          </p>
        </div>
        <Link href="/" className="auth-link inline-flex text-sm">
          Return to main page
        </Link>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-label">Work ID</span>
            <div className={`auth-input-shell gap-3 ${workIdError ? 'auth-input-error' : workIdPattern.test(normalizeWorkId(workId)) ? 'auth-input-valid' : ''}`}>
              <IdCard className="h-4 w-4 shrink-0 text-[color:var(--app-subtle)]" />
              <input
                value={workId}
                onChange={(e) => {
                  setWorkId(normalizeWorkId(e.target.value));
                  setWorkIdError(null);
                }}
                onBlur={() => {
                  const normalized = normalizeWorkId(workId);
                  setWorkId(normalized);
                  setWorkIdError(validateWorkId(normalized));
                }}
                placeholder="e.g. AQI-20260034"
                autoComplete="username"
                className="w-full bg-transparent outline-none"
              />
            </div>
            {workIdError ? <p className="text-xs text-red-600">{workIdError}</p> : null}
          </label>

          <label className="auth-field">
            <span className="auth-label">Password</span>
            <div className={`auth-input-shell gap-3 ${passwordError ? 'auth-input-error' : password ? 'auth-input-valid' : ''}`}>
              <KeyRound className="h-4 w-4 shrink-0 text-[color:var(--app-subtle)]" />
              <input
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                onBlur={() => setPasswordError(validatePassword(password))}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full bg-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="text-xs font-semibold text-orange"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordError ? <p className="text-xs text-red-600">{passwordError}</p> : null}
          </label>

          <button type="submit" disabled={!canSubmit} className="auth-primary-button">
            <span className="inline-flex items-center gap-2">
              <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
              {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
            </span>
          </button>
        </form>

        <div className="mt-6 space-y-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">
            Powered by Nexatech
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/auth/register" className="auth-link">
              Create account
            </Link>
            <Link href="/auth/forgot-password" className="auth-link">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
