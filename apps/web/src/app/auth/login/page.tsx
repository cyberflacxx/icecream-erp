'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { API_BASE_URL } from '@/lib/api';

const workIdPattern = /^AQI-[0-9]{8}$/;

export default function LoginPage() {
  const router = useRouter();
  const [workId, setWorkId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [workIdError, setWorkIdError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateWorkId(value: string) {
    if (!value.trim() || !workIdPattern.test(value)) {
      return 'Please enter a valid Work ID';
    }

    return null;
  }

  function validatePassword(value: string) {
    if (!value.trim()) {
      return 'Please enter your password';
    }

    return null;
  }

  const canSubmit = Boolean(workIdPattern.test(workId) && password.length > 0 && !isSubmitting);

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

          <form
            className="mt-8 space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setFormError(null);

              const nextWorkIdError = validateWorkId(workId);
              const nextPasswordError = validatePassword(password);
              setWorkIdError(nextWorkIdError);
              setPasswordError(nextPasswordError);

              if (nextWorkIdError || nextPasswordError) {
                return;
              }

              try {
                setIsSubmitting(true);
                const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    work_id: workId,
                    password
                  })
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                  setFormError(String(payload?.error ?? 'Login failed.'));
                  return;
                }

                router.push('/dashboard');
              } catch (error) {
                setFormError(error instanceof Error ? error.message : 'Login failed.');
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
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
                className={`h-11 w-full rounded-xl border px-3 outline-none ${
                  workIdError ? 'border-red-500' : workIdPattern.test(workId) ? 'border-green-500' : 'border-border'
                }`}
              />
              {workIdError ? <p className="text-xs text-red-600">{workIdError}</p> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brown">Password</span>
              <div className={`flex h-11 items-center rounded-xl border px-3 ${passwordError ? 'border-red-500' : password ? 'border-green-500' : 'border-border'}`}>
                <input
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setPasswordError(null);
                  }}
                  onBlur={() => setPasswordError(validatePassword(password))}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="w-full bg-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="text-xs font-semibold text-orange"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {passwordError ? <p className="text-xs text-red-600">{passwordError}</p> : null}
            </label>

            {formError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="h-11 w-full rounded-xl bg-[#F97316] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>

            <Link
              href="/"
              className="flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-brown transition hover:bg-cream"
            >
              Back to Main Page
            </Link>
          </form>

          <p className="mt-5 text-sm text-muted">
            New staff member?{' '}
            <Link href="/auth/register" className="font-semibold text-orange">
              Register here
            </Link>
          </p>
          <p className="mt-2 text-sm text-muted">
            Forgot your Work ID? Contact your system administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
