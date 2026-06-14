'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

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
    <main className="grid min-h-screen bg-cream lg:grid-cols-2">
      <section className="hidden bg-[#3B1F12] p-10 text-[#F8EBD8] lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[#F4C89B]">Absolute Ice Cream ERP</p>
          <h1 className="mt-6 text-5xl font-semibold leading-tight">Staff Login Portal</h1>
          <p className="mt-4 max-w-lg text-base text-[#f1dbc3]">Sign in with your Work ID and password.</p>
        </div>
        <div className="rounded-3xl border border-[#f4c89b33] bg-[#4b2817] p-6">
          <p className="text-sm text-[#f1dbc3]">Absolute Quality Icecream</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-soft">
          <h2 className="text-3xl font-semibold text-brown">Welcome Back</h2>
          <p className="mt-2 text-sm text-muted">Sign in with your Work ID and password.</p>
          <Link href="/" className="mt-3 inline-flex text-sm font-semibold text-orange transition hover:text-[#ea6a0a]">
            Return to main page
          </Link>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brown">Work ID</span>
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
                className={`h-11 w-full rounded-xl border px-3 outline-none transition ${
                  workIdError ? 'border-red-500 bg-red-50' : workIdPattern.test(normalizeWorkId(workId)) ? 'border-green-500' : 'border-border'
                }`}
              />
              {workIdError ? <p className="text-xs text-red-600">{workIdError}</p> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brown">Password</span>
              <div
                className={`flex h-11 items-center rounded-xl border px-3 transition ${
                  passwordError ? 'border-red-500 bg-red-50' : password ? 'border-green-500' : 'border-border'
                }`}
              >
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

            <button
              type="submit"
              disabled={!canSubmit}
              className="h-11 w-full rounded-xl bg-[#F97316] font-semibold text-white transition hover:bg-[#ea6a0a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link href="/auth/register" className="font-semibold text-orange transition hover:text-[#ea6a0a]">
              Create account
            </Link>
            <Link href="/auth/forgot-password" className="font-semibold text-orange transition hover:text-[#ea6a0a]">
              Forgot password?
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
