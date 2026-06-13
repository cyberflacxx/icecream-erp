import { NextResponse } from 'next/server';

import { getPublicRegistrationRoles } from '@/lib/registration';
import { createServiceRoleClient } from '@/lib/supabase/server';

/** Public endpoint — no auth required. Used by the self-registration page. */
export async function GET() {
  const service = createServiceRoleClient().schema('icecream_erp');
  const roles = await getPublicRegistrationRoles(service);

  return NextResponse.json({
    data: roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
    })),
  });
}
