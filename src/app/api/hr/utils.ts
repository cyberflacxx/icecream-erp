import { NextRequest } from 'next/server';

import { AuthContext, badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { normalizeShiftName } from '@/lib/hr';
import { hrService } from '@/lib/hr-server';

export async function requireHrContext(
  request?: Request | NextRequest,
  ...permissions: string[]
): Promise<{ ctx: AuthContext } | Response> {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (permissions.length > 0 && !can(ctx, ...permissions)) return forbidden();
  return { ctx };
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10)));
  return {
    from: (page - 1) * pageSize,
    page,
    pageSize,
  };
}

export function isErrorResponse(value: Response | { ctx: AuthContext }): value is Response {
  return value instanceof Response;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

export function isMissingColumnOrRelation(error: unknown, token: string) {
  const message = getErrorMessage(error).toLowerCase();
  const normalizedToken = token.toLowerCase();
  return (
    message.includes(`column ${normalizedToken} does not exist`) ||
    message.includes(`relation "${normalizedToken}" does not exist`) ||
    message.includes(`could not find the table 'icecream_erp.${normalizedToken}'`) ||
    message.includes(`could not find the '${normalizedToken}' column`) ||
    message.includes(`could not find a relationship between '${normalizedToken.split('.')[0]}'`)
  );
}

export async function loadShiftDefinitionByName(organizationId: string, shiftName?: string | null) {
  const service = hrService();
  const normalizedShift = normalizeShiftName(shiftName);
  const { data, error } = await service
    .from('hr_shift_definitions')
    .select('id, shift_name, start_time, end_time, standard_shift_hours')
    .eq('organization_id', organizationId)
    .eq('shift_name', normalizedShift)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function resolveDepartmentId(
  organizationId: string,
  input: { departmentId?: string | null; departmentName?: string | null },
) {
  if (input.departmentId) return input.departmentId;
  if (!input.departmentName) return null;

  const service = hrService();
  const { data, error } = await service
    .from('departments')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', input.departmentName)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export function requireNonNegativeNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    return badRequest(`${field} must not be negative.`);
  }
  return null;
}
