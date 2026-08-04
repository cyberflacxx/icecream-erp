import RegisterPageClient, { type RoleOption } from './register-page-client';

import { getPublicRegistrationRoles, getSafeRegistrationErrorDetails } from '@/lib/registration';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

async function loadInitialRoles(): Promise<RoleOption[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  try {
    const service = createServiceRoleClient().schema('icecream_erp');
    const roles = await getPublicRegistrationRoles(service);

    return roles.map((role) => ({
      code: role.code,
      id: role.id,
      name: role.name,
    }));
  } catch (error) {
    console.error('Server registration roles preload failed.', {
      ...getSafeRegistrationErrorDetails(error, {
        step: 'preload_public_registration_roles',
        table: 'roles',
      }),
      route: '/auth/register',
    });

    return [];
  }
}

export default async function RegisterPage() {
  const initialRoles = await loadInitialRoles();

  return <RegisterPageClient initialRoles={initialRoles} />;
}
