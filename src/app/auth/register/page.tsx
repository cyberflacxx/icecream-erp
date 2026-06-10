'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
interface RoleOption {
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/roles/public');
        const payload = (await response.json()) as { data?: RoleOption[] } | RoleOption[];
        if (mounted) {
          const roleArray = Array.isArray(payload) ? payload : (payload as { data?: RoleOption[] }).data ?? [];
          if (response.ok && roleArray.length > 0) {
            setRoles(roleArray.filter(
              (item): item is RoleOption =>
                typeof item === 'object' && item !== null &&
                typeof item.id === 'string' && typeof item.name === 'string',
            ));
            setRolesError(null);
          } else {
            setRoles([]);
            setRolesError('Unable to load roles. Please refresh the page.');
            Swal.fire({
              icon: 'error',
              title: 'Could Not Load Roles',
              html: '<p>Could not load staff roles from the server. Please refresh and try again.</p>',
              confirmButtonColor: '#F97316',
              background: '#fff7e8',
              color: '#3B1F12',
            });
          }
        }
      } catch {
        if (mounted) {
          setRoles([]);
          setRolesError('Unable to load roles. Please refresh the page.');
          Swal.fire({
            icon: 'error',
            title: 'Server Unreachable',
            html: '<p>Cannot connect to the server. Please refresh and try again.</p>',
            confirmButtonColor: '#F97316',
            background: '#fff7e8',
            color: '#3B1F12',
          });
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
      minLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      digit: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    }),
    [password],
  );

  function validate() {
    const errors: Record<string, string> = {};

    if (!/^[A-Za-z]{2,}$/.test(firstName)) {
      errors.first_name = 'First name must be at least 2 characters and contain letters only';
    }
    if (!/^[A-Za-z]{2,}$/.test(surname)) {
      errors.last_name = 'Surname must be at least 2 characters and contain letters only';
    }
    if (!idNumberPattern.test(idNumber)) {
      errors.id_number = 'ID number must follow the format e.g. 752027732X27. Letter must be uppercase.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!passwordChecks.minLength || !passwordChecks.uppercase || !passwordChecks.lowercase || !passwordChecks.digit || !passwordChecks.special) {
      errors.password = 'Password does not meet all strength requirements.';
    }
    if (!confirmPassword || confirmPassword !== password) {
      errors.confirm_password = 'Passwords do not match';
    }
    if (!roleId) {
      errors.role_id = 'Please select your role';
    }
    if (!adminKey.trim()) {
      errors.admin_key = 'Invalid admin key. Please contact your administrator.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const isValidForm =
    /^[A-Za-z]{2,}$/.test(firstName) &&
    /^[A-Za-z]{2,}$/.test(surname) &&
    idNumberPattern.test(idNumber) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    passwordChecks.minLength &&
    passwordChecks.uppercase &&
    passwordChecks.lowercase &&
    passwordChecks.digit &&
    passwordChecks.special &&
    password === confirmPassword &&
    Boolean(roleId) &&
    Boolean(adminKey.trim());

  return (
    <main className="grid min-h-screen bg-cream lg:grid-cols-2">
      <section className="hidden bg-[#3B1F12] p-10 text-[#F8EBD8] lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[#F4C89B]">Absolute Ice Cream ERP</p>
          <h1 className="mt-6 text-5xl font-semibold leading-tight">Staff Registration Portal</h1>
          <p className="mt-4 max-w-lg text-base text-[#f1dbc3]">
            Register new staff accounts with controlled role-based access.
          </p>
        </div>
        <div className="rounded-3xl border border-[#f4c89b33] bg-[#4b2817] p-6">
          <p className="text-sm text-[#f1dbc3]">Absolute Quality Icecream</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-soft">
          <h2 className="text-3xl font-semibold text-brown">Create Your Account</h2>
          <p className="mt-2 text-sm text-muted">Fill in your details and enter the admin key to register.</p>

          {successMessage ? (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          ) : null}
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

          <form
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setFormError(null);

              if (!validate()) {
                return;
              }

              try {
                setIsSubmitting(true);

                Swal.fire({
                  title: 'Creating account\u2026',
                  html: 'Please wait while we register your account.',
                  allowOutsideClick: false,
                  allowEscapeKey: false,
                  didOpen: () => Swal.showLoading(),
                  background: '#fff7e8',
                  color: '#3B1F12',
                });

                const response = await fetch('/api/auth/register', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    first_name: firstName.trim(),
                    last_name: surname.trim(),
                    id_number: idNumber,
                    email: email.trim().toLowerCase(),
                    password,
                    confirm_password: confirmPassword,
                    role: roleId,
                    admin_key: adminKey,
                  }),
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                  const responseError = payload as {
                    error?: string;
                    fieldErrors?: Record<string, string>;
                  };
                  if (responseError.fieldErrors && typeof responseError.fieldErrors === 'object') {
                    setFieldErrors((current) => ({
                      ...current,
                      ...responseError.fieldErrors
                    }));
                  }
                  const msg = String(responseError.error ?? 'Registration failed.');
                  setFormError(msg);
                  Swal.fire({
                    icon: response.status === 409 ? 'warning' : 'error',
                    title: response.status === 409 ? 'Already Registered' : response.status === 403 ? 'Invalid Admin Key' : 'Registration Failed',
                    html: msg,
                    confirmButtonColor: '#F97316',
                    background: '#fff7e8',
                    color: '#3B1F12',
                  });
                  return;
                }

                const accountPayload = payload as { work_id?: string };
                await Swal.fire({
                  icon: 'success',
                  title: 'Account Created! 🎉',
                  html:
                    `<p>Your account has been registered successfully.</p>` +
                    (accountPayload.work_id
                      ? `<p style="margin-top:12px">Your Work ID is: <b style="font-size:1.1rem;color:#F97316">${accountPayload.work_id}</b></p>`
                      : '') +
                    `<p style="margin-top:8px;font-size:0.85rem;color:#666">A confirmation has been sent to <b>${email}</b>. Use your Work ID to log in.</p>`,
                  confirmButtonColor: '#F97316',
                  confirmButtonText: 'Go to Login',
                  background: '#fff7e8',
                  color: '#3B1F12',
                  iconColor: '#22c55e',
                  allowOutsideClick: false,
                });
                router.push('/auth/login');
              } catch (error) {
                Swal.fire({
                  icon: 'error',
                  title: error instanceof TypeError ? 'Server Unreachable' : 'Unexpected Error',
                  html: error instanceof TypeError
                    ? '<p>Cannot connect to the server. Please refresh and try again.</p>'
                    : (error instanceof Error ? error.message : 'Something went wrong. Please try again.'),
                  confirmButtonColor: '#F97316',
                  background: '#fff7e8',
                  color: '#3B1F12',
                });
                setFormError(error instanceof Error ? error.message : 'Registration failed.');
            } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <InputField
              label="First Name"
              placeholder="Enter your first name"
              value={firstName}
              onChange={(value) => {
                setFirstName(value);
                setFieldErrors((current) => ({ ...current, first_name: '' }));
              }}
              error={fieldErrors.first_name}
              isValid={/^[A-Za-z]{2,}$/.test(firstName)}
            />

            <InputField
              label="Surname"
              placeholder="Enter your surname"
              value={surname}
              onChange={(value) => {
                setSurname(value);
                setFieldErrors((current) => ({ ...current, last_name: '' }));
              }}
              error={fieldErrors.last_name}
              isValid={/^[A-Za-z]{2,}$/.test(surname)}
            />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brown">National ID Number</span>
              <input
                value={idNumber}
                onChange={(event) => {
                  setIdNumber(sanitizeIdNumber(event.target.value));
                  setFieldErrors((current) => ({ ...current, id_number: '' }));
                }}
                placeholder="e.g. 752027732X27"
                className={`h-11 w-full rounded-xl border px-3 outline-none ${
                  fieldErrors.id_number ? 'border-red-500' : idNumberPattern.test(idNumber) ? 'border-green-500' : 'border-border'
                }`}
              />
              <p className="text-xs text-muted">Enter without dashes. Letter must be uppercase.</p>
              <p className="text-xs text-muted">Characters: {idNumber.length}</p>
              {fieldErrors.id_number ? <p className="text-xs text-red-600">{fieldErrors.id_number}</p> : null}
            </label>

            <InputField
              label="Email Address"
              placeholder="your.email@example.com"
              value={email}
              onChange={(value) => {
                setEmail(value);
                setFieldErrors((current) => ({ ...current, email: '' }));
              }}
              error={fieldErrors.email}
              isValid={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
            />

            <PasswordField
              label="Set Password"
              placeholder="Create a strong password"
              value={password}
              showValue={showPassword}
              onToggleShow={() => setShowPassword((current) => !current)}
              onChange={(value) => {
                setPassword(value);
                setFieldErrors((current) => ({ ...current, password: '' }));
              }}
              error={fieldErrors.password}
              isValid={
                passwordChecks.minLength &&
                passwordChecks.uppercase &&
                passwordChecks.lowercase &&
                passwordChecks.digit &&
                passwordChecks.special
              }
            />

            <ul className="space-y-1 text-xs">
              <li className={passwordChecks.minLength ? 'text-green-600' : 'text-muted'}>✓ At least 8 characters</li>
              <li className={passwordChecks.uppercase ? 'text-green-600' : 'text-muted'}>✓ One uppercase letter</li>
              <li className={passwordChecks.lowercase ? 'text-green-600' : 'text-muted'}>✓ One lowercase letter</li>
              <li className={passwordChecks.digit ? 'text-green-600' : 'text-muted'}>✓ One digit (0-9)</li>
              <li className={passwordChecks.special ? 'text-green-600' : 'text-muted'}>✓ One special character</li>
            </ul>

            <PasswordField
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              showValue={showConfirmPassword}
              onToggleShow={() => setShowConfirmPassword((current) => !current)}
              onChange={(value) => {
                setConfirmPassword(value);
                setFieldErrors((current) => ({ ...current, confirm_password: '' }));
              }}
              error={fieldErrors.confirm_password}
              isValid={confirmPassword.length > 0 && confirmPassword === password}
            />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brown">Select Your Role</span>
              <select
                value={roleId}
                onChange={(event) => {
                  setRoleId(event.target.value);
                  setFieldErrors((current) => ({ ...current, role_id: '' }));
                }}
                disabled={isRolesLoading}
                className={`h-11 w-full rounded-xl border bg-white px-3 outline-none ${
                  fieldErrors.role_id ? 'border-red-500' : roleId ? 'border-green-500' : 'border-border'
                }`}
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {fieldErrors.role_id ? <p className="text-xs text-red-600">{fieldErrors.role_id}</p> : null}
            </label>

            <PasswordField
              label="Admin Key"
              placeholder="Enter the admin key provided by your administrator"
              value={adminKey}
              showValue={false}
              onToggleShow={() => null}
              onChange={(value) => {
                setAdminKey(value);
                setFieldErrors((current) => ({ ...current, admin_key: '' }));
              }}
              error={fieldErrors.admin_key}
              isValid={Boolean(adminKey.trim())}
              showToggle={false}
            />
            <p className="text-xs text-muted">Contact your system administrator for the admin key.</p>

            <button
              type="submit"
              disabled={!isValidForm || isSubmitting}
              className="h-11 w-full rounded-xl bg-[#F97316] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
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
  label,
  placeholder,
  value,
  onChange,
  error,
  isValid
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  isValid: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-brown">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-11 w-full rounded-xl border px-3 outline-none ${
          error ? 'border-red-500' : isValid ? 'border-green-500' : 'border-border'
        }`}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </label>
  );
}

function PasswordField({
  label,
  placeholder,
  value,
  showValue,
  onToggleShow,
  onChange,
  error,
  isValid,
  showToggle = true
}: {
  label: string;
  placeholder: string;
  value: string;
  showValue: boolean;
  onToggleShow: () => void;
  onChange: (value: string) => void;
  error?: string;
  isValid: boolean;
  showToggle?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-brown">{label}</span>
      <div className={`flex h-11 items-center rounded-xl border px-3 ${error ? 'border-red-500' : isValid ? 'border-green-500' : 'border-border'}`}>
        <input
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
