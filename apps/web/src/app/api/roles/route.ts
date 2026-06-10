import { NextResponse } from 'next/server';

import { ROLES } from '@/lib/auth-roles';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    data: ROLES.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystemRole: true,
      permissions: [],
      userCount: 0,
    })),
    pagination: { page: 1, pageSize: ROLES.length, total: ROLES.length },
  });
}
