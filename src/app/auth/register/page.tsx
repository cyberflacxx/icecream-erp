'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

interface RoleOption {
  description?: string | null;
  id: string;
  name: string;
}

const idNumberPattern = /^[0-9]{6,9}[A-Z][0-9]{2}$/;

function sanitizeIdNumber(value: string) {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export default function RegisterPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [isRolesLoading, setIsRolesLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequestId, setOtpRequestId] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpExpiry, setOtpExpiry] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/roles/public');
        const payload = (await response.json()) as { data?: RoleOption[] } | RoleOption[];
        if (!mounted) return;
        const roleArray = Array.isArray(payload) ? payload : payload.data ?? [];
        if (response.ok && roleArray.length > 0) {
          setRoles(roleArray);
          setRolesError(null);
        } else {
          setRoles([]);
          setRolesError('Unable to load roles. Please refresh the page.');
        }
      } catch {
        if (mounted) {
          setRoles([]);
          setRolesError('Unable to load roles. Please refresh the page.');
        }
      } finally {
        if (mounted) {
          setIsRolesLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

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

  const registrationLocked = Boolean(otpRequestId);

  function validateRegistrationForm() {
    const errors: Record<string, string> = {};

    if (!/^[A-Za-z]{2,}$/.test(firstName)) {
      errors.first_name = 'First name must be at least 2 letters.';
    }
    if (!/^[A-Za-z]{2,}$/.test(surname)) {
      errors.last_name = 'Surname must be at least 2 letters.';
    }
    if (!idNumberPattern.test(idNumber)) {
      errors.id_number = 'ID number must follow the format 752027732X27.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!passwordChecks.minLength || !passwordChecks.uppercase || !passwordChecks.lowercase || !passwordChecks.digit || !passwordChecks.special) {
      errors.password = 'Password must include uppercase, lowercase, digit, special character, and 8 characters minimum.';
    }
    if (!confirmPassword || confirmPassword !== password) {
      errors.confirm_password = 'Passwords do not match.';
    }
    if (!roleId) {
      errors.role = 'Please select a role.';
    }
    if (!adminKey.trim()) {
      errors.admin_key = 'Admin registration key is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function requestOtp() {
    if (!validateRegistrationForm()) return;

    setFormError(null);
    setIsSubmitting(true);

    Swal.fire({
      title: 'Sending OTP...',
      html: 'Preparing your registration verification code.',
      allowEscapeKey: false,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      background: '#fff7e8',
      color: '#3B1F12',
    });

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_key: adminKey.trim(),
          confirm_password: confirmPassword,
          email: email.trim().toLowerCase(),
          first_name: firstName.trim(),
          id_number: idNumber,
          last_name: surname.trim(),
          password,
          role: roleId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        email?: string;
        error?: string;
        expiresIn?: string;
        fieldErrors?: Record<string, string>;
        requestId?: string;
      };

      if (!response.ok) {
        if (payload.fieldErrors) {
          setFieldErrors((current) => ({ ...current, ...payload.fieldErrors }));
        }
        const message = String(payload.error ?? 'Failed to send OTP.');
        setFormError(message);
        await Swal.fire({
          icon: 'error',
          title: 'OTP Request Failed',
          html: `<p>${message}</p>`,
          confirmButtonColor: '#F97316',
          background: '#fff7e8',
          color: '#3B1F12',
        });
        return;
      }

      setOtpRequestId(payload.requestId ?? null);
      setOtpEmail(payload.email ?? email.trim().toLowerCase());
      setOtpExpiry(payload.expiresIn ?? null);
      setOtp('');
      setFieldErrors((current) => ({ ...current, otp: '' }));

      await Swal.fire({
        icon: 'success',
        title: 'OTP Sent',
        html: `<p>We sent a verification code to <b>${payload.email ?? email}</b>.</p><p style="margin-top:8px;font-size:0.85rem;color:#666">Enter it below to finish creating the account.</p>`,
        confirmButtonColor: '#F97316',
        background: '#fff7e8',
        color: '#3B1F12',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send OTP.';
      setFormError(message);
      await Swal.fire({
        icon: 'error',
        title: 'Unexpected Error',
        html: `<p>${message}</p>`,
        confirmButtonColor: '#F97316',
        background: '#fff7e8',
        color: '#3B1F12',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyOtpAndCreateAccount() {
    const errors: Record<string, string> = {};
    if (!otpRequestId) {
      errors.otp = 'Request a verification code first.';
    }
    if (!/^[0-9]{6}$/.test(otp.trim())) {
      errors.otp = 'Enter the 6-digit OTP sent to your email.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors((current) => ({ ...current, ...errors }));
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    Swal.fire({
      title: 'Creating account...',
      html: 'Verifying OTP and finalizing your account.',
      allowEscapeKey: false,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      background: '#fff7e8',
      color: '#3B1F12',
    });

    try {
      const response = await fetch('/api/auth/register/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp: otp.trim(),
          requestId: otpRequestId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; redirectTo?: string; work_id?: string };

      if (!response.ok) {
        const message = String(payload.error ?? 'OTP verification failed.');
        setFieldErrors((current) => ({ ...current, otp: message }));
        setFormError(message);
        await Swal.fire({
          icon: 'error',
          title: 'Verification Failed',
          html: `<p>${message}</p>`,
          confirmButtonColor: '#F97316',
          background: '#fff7e8',
          color: '#3B1F12',
        });
        return;
      }

      await Swal.fire({
        icon: 'success',
        title: 'Account Created',
        html:
          `<p>Your account has been created successfully.</p>` +
          (payload.work_id ? `<p style="margin-top:10px">Work ID: <b style="color:#F97316">${payload.work_id}</b></p>` : '') +
          `<p style="margin-top:8px;font-size:0.85rem;color:#666">Your work ID has also been emailed to you.</p>`,
        confirmButtonColor: '#F97316',
        background: '#fff7e8',
        color: '#3B1F12',
      });

      router.push(payload.redirectTo ?? '/auth/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OTP verification failed.';
      setFormError(message);
      await Swal.fire({
        icon: 'error',
        title: 'Unexpected Error',
        html: `<p>${message}</p>`,
        confirmButtonColor: '#F97316',
        background: '#fff7e8',
        color: '#3B1F12',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetOtpState() {
    setOtpRequestId(null);
    setOtpEmail(null);
    setOtpExpiry(null);
    setOtp('');
    setFieldErrors((current) => ({ ...current, otp: '' }));
    setFormError(null);
  }

  const canRequestOtp =
    /^[A-Za-z]{2,}$/.test(firstName) &&
    /^[A-Za-z]{2,}$/.test(surname) &&
    idNumberPattern.test(idNumber) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    passwordChecks.minLength &&
    passwordChecks.uppercase &&
    passwordChecks.lowercase &&
    passwordChecks.digit &&
    passwordChecks.special &&
    confirmPassword === password &&
    Boolean(roleId) &&
    Boolean(adminKey.trim()) &&
    !isSubmitting;

  const canVerifyOtp = Boolean(otpRequestId && /^[0-9]{6}$/.test(otp.trim()) && !isSubmitting);

  return (
    <main className="grid min-h-screen bg-cream lg:grid-cols-2">
      <section className="hidden bg-[#3B1F12] p-10 text-[#F8EBD8] lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[#F4C89B]">Absolute Ice Cream ERP</p>
          <h1 className="mt-6 text-5xl font-semibold leading-tight">Staff Registration Portal</h1>
          <p className="mt-4 max-w-lg text-base text-[#f1dbc3]">
            Register with your assigned role, verify your email by OTP, then sign in using the work ID sent by the system.
          </p>
        </div>
        <div className="rounded-3xl border border-[#f4c89b33] bg-[#4b2817] p-6">
          <p className="text-sm text-[#f1dbc3]">Absolute Quality Icecream</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-soft">
          <h2 className="text-3xl font-semibold text-brown">Create Your Account</h2>
          <p className="mt-2 text-sm text-muted">Enter your details, request an OTP, then verify it to create the account.</p>

          {formError ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}
          {rolesError ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {rolesError}
            </div>
          ) : null}
          {otpRequestId ? (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              OTP sent to {otpEmail ?? email}. {otpExpiry ? `It expires in ${otpExpiry}.` : ''}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={(event) => event.preventDefault()}>
            <InputField
              disabled={registrationLocked}
              error={fieldErrors.first_name}
              isValid={/^[A-Za-z]{2,}$/.test(firstName)}
              label="First Name"
              onChange={(value) => {
                setFirstName(value);
                setFieldErrors((current) => ({ ...current, first_name: '' }));
              }}
              placeholder="Enter your first name"
              value={firstName}
            />

            <InputField
              disabled={registrationLocked}
              error={fieldErrors.last_name}
              isValid={/^[A-Za-z]{2,}$/.test(surname)}
              label="Surname"
              onChange={(value) => {
                setSurname(value);
                setFieldErrors((current) => ({ ...current, last_name: '' }));
              }}
              placeholder="Enter your surname"
              value={surname}
            />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brown">National ID Number</span>
              <input
                disabled={registrationLocked}
                value={idNumber}
                onChange={(event) => {
                  setIdNumber(sanitizeIdNumber(event.target.value));
                  setFieldErrors((current) => ({ ...current, id_number: '' }));
                }}
                placeholder="e.g. 752027732X27"
                className={`h-11 w-full rounded-xl border px-3 outline-none ${
                  fieldErrors.id_number ? 'border-red-500' : idNumberPattern.test(idNumber) ? 'border-green-500' : 'border-border'
                } ${registrationLocked ? 'bg-slate-50 text-slate-500' : ''}`}
              />
              {fieldErrors.id_number ? <p className="text-xs text-red-600">{fieldErrors.id_number}</p> : null}
            </label>

            <InputField
              disabled={registrationLocked}
              error={fieldErrors.email}
              isValid={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
              label="Email Address"
              onChange={(value) => {
                setEmail(value);
                setFieldErrors((current) => ({ ...current, email: '' }));
              }}
              placeholder="your.email@example.com"
              value={email}
            />

            <PasswordField
              disabled={registrationLocked}
              error={fieldErrors.password}
              isValid={passwordChecks.minLength && passwordChecks.uppercase && passwordChecks.lowercase && passwordChecks.digit && passwordChecks.special}
              label="Set Password"
              onChange={(value) => {
                setPassword(value);
                setFieldErrors((current) => ({ ...current, password: '' }));
              }}
              onToggleShow={() => setShowPassword((current) => !current)}
              placeholder="Create a strong password"
              showValue={showPassword}
              value={password}
            />

            <ul className="space-y-1 text-xs">
              <li className={passwordChecks.minLength ? 'text-green-600' : 'text-muted'}>At least 8 characters</li>
              <li className={passwordChecks.uppercase ? 'text-green-600' : 'text-muted'}>One uppercase letter</li>
              <li className={passwordChecks.lowercase ? 'text-green-600' : 'text-muted'}>One lowercase letter</li>
              <li className={passwordChecks.digit ? 'text-green-600' : 'text-muted'}>One digit</li>
              <li className={passwordChecks.special ? 'text-green-600' : 'text-muted'}>One special character</li>
            </ul>

            <PasswordField
              disabled={registrationLocked}
              error={fieldErrors.confirm_password}
              isValid={confirmPassword.length > 0 && confirmPassword === password}
              label="Confirm Password"
              onChange={(value) => {
                setConfirmPassword(value);
                setFieldErrors((current) => ({ ...current, confirm_password: '' }));
              }}
              onToggleShow={() => setShowConfirmPassword((current) => !current)}
              placeholder="Re-enter your password"
              showValue={showConfirmPassword}
              value={confirmPassword}
            />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brown">Select Your Role</span>
              <select
                value={roleId}
                disabled={isRolesLoading || registrationLocked}
                onChange={(event) => {
                  setRoleId(event.target.value);
                  setFieldErrors((current) => ({ ...current, role: '' }));
                }}
                className={`h-11 w-full rounded-xl border bg-white px-3 outline-none ${
                  fieldErrors.role ? 'border-red-500' : roleId ? 'border-green-500' : 'border-border'
                } ${registrationLocked ? 'bg-slate-50 text-slate-500' : ''}`}
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {fieldErrors.role ? <p className="text-xs text-red-600">{fieldErrors.role}</p> : null}
            </label>

            <PasswordField
              disabled={registrationLocked}
              error={fieldErrors.admin_key}
              isValid={Boolean(adminKey.trim())}
              label="Admin Registration Key"
              onChange={(value) => {
                setAdminKey(value);
                setFieldErrors((current) => ({ ...current, admin_key: '' }));
              }}
              onToggleShow={() => null}
              placeholder="Enter the admin key"
              showToggle={false}
              showValue={false}
              value={adminKey}
            />

            {otpRequestId ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-brown">Email OTP</span>
                <input
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setFieldErrors((current) => ({ ...current, otp: '' }));
                  }}
                  placeholder="Enter 6-digit OTP"
                  className={`h-11 w-full rounded-xl border px-3 outline-none ${
                    fieldErrors.otp ? 'border-red-500' : otp.length === 6 ? 'border-green-500' : 'border-border'
                  }`}
                />
                {fieldErrors.otp ? <p className="text-xs text-red-600">{fieldErrors.otp}</p> : null}
              </label>
            ) : null}

            <div className="space-y-3">
              {!otpRequestId ? (
                <button
                  type="button"
                  disabled={!canRequestOtp}
                  onClick={requestOtp}
                  className="h-11 w-full rounded-xl bg-[#F97316] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Sending OTP...' : 'Send OTP'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!canVerifyOtp}
                    onClick={verifyOtpAndCreateAccount}
                    className="h-11 w-full rounded-xl bg-[#F97316] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Creating Account...' : 'Verify OTP and Create Account'}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={resetOtpState}
                    className="h-11 w-full rounded-xl border border-border font-semibold text-brown transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Edit Registration Details
                  </button>
                </>
              )}
            </div>
          </form>

          <p className="mt-5 text-sm text-muted">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-semibold text-orange">
              Sign in with your Work ID
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function InputField({
  disabled = false,
  error,
  isValid,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  error?: string;
  isValid: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-brown">{label}</span>
      <input
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-11 w-full rounded-xl border px-3 outline-none ${
          error ? 'border-red-500' : isValid ? 'border-green-500' : 'border-border'
        } ${disabled ? 'bg-slate-50 text-slate-500' : ''}`}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </label>
  );
}

function PasswordField({
  disabled = false,
  error,
  isValid,
  label,
  onChange,
  onToggleShow,
  placeholder,
  showToggle = true,
  showValue,
  value,
}: {
  disabled?: boolean;
  error?: string;
  isValid: boolean;
  label: string;
  onChange: (value: string) => void;
  onToggleShow: () => void;
  placeholder: string;
  showToggle?: boolean;
  showValue: boolean;
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-brown">{label}</span>
      <div className={`flex h-11 items-center rounded-xl border px-3 ${error ? 'border-red-500' : isValid ? 'border-green-500' : 'border-border'} ${disabled ? 'bg-slate-50 text-slate-500' : ''}`}>
        <input
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={showValue ? 'text' : 'password'}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none"
        />
        {showToggle ? (
          <button type="button" onClick={onToggleShow} className="text-xs font-semibold text-orange">
            {showValue ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </label>
  );
}
