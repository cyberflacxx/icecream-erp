import { NextResponse } from 'next/server';

import { getPublicRegistrationRoles, getSafeRegistrationErrorDetails } from '@/lib/registration';
import { createServiceRoleClient } from '@/lib/supabase/server';

/** Public endpoint — no auth required. Used by the self-registration page. */
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ data: [], error: 'Unable to load roles right now. Please refresh the page.' }, { status: 503 });
  }

  try {
    const service = createServiceRoleClient().schema('icecream_erp');
    const roles = await getPublicRegistrationRoles(service);

    return NextResponse.json({
      data: roles.map((role) => ({
        code: role.code,
        id: role.id,
        name: role.name,
      })),
    });
  } catch (error) {
    console.error('Public registration roles failed to load.', {
      ...getSafeRegistrationErrorDetails(error, {
        step: 'load_public_registration_roles',
        table: 'roles',
      }),
      route: '/api/roles/public',
    });

    return NextResponse.json(
      { data: [], error: 'Unable to load roles right now. Please refresh the page.' },
      { status: 503 },
    );
  }
}
