import { NextRequest, NextResponse } from 'next/server';

import { apiServerError, badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { isMissingColumnError, isMissingTableError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

type MachineRow = Record<string, unknown>;
type MachineProfileRow = Record<string, unknown>;
type MaintenanceScheduleRow = Record<string, unknown>;
type MachineBreakdownRow = Record<string, unknown>;

const healthStatuses = new Set(['HEALTHY', 'NEEDS_SERVICE', 'UNDER_MAINTENANCE', 'CRITICAL', 'RETIRED']);
const operationalStatuses = new Set(['ACTIVE', 'INACTIVE', 'BROKEN_DOWN', 'UNDER_REPAIR']);

function safeDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeMachineCode(row: MachineRow) {
  return String(row.code ?? row.asset_number ?? '');
}

function normalizeMachineType(row: MachineRow) {
  return String(row.machine_type ?? row.description ?? 'GENERAL');
}

function normalizeOperationalStatus(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (operationalStatuses.has(normalized)) return normalized;
  if (normalized === 'OPERATIONAL') return 'ACTIVE';
  if (normalized === 'BREAKDOWN') return 'BROKEN_DOWN';
  if (normalized === 'MAINTENANCE_DUE' || normalized === 'MAINTENANCE') return 'UNDER_REPAIR';
  return normalized || 'ACTIVE';
}

function deriveHealthStatus(
  operationalStatus: string,
  nextServiceDate: string | null,
  explicitHealthStatus?: string | null,
) {
  const normalizedHealth = explicitHealthStatus ? String(explicitHealthStatus).trim().toUpperCase() : '';
  if (healthStatuses.has(normalizedHealth)) {
    return normalizedHealth;
  }
  if (operationalStatus === 'RETIRED' || operationalStatus === 'INACTIVE') return 'RETIRED';
  if (operationalStatus === 'BROKEN_DOWN') return 'CRITICAL';
  if (operationalStatus === 'UNDER_REPAIR') return 'UNDER_MAINTENANCE';
  if (!nextServiceDate) return 'HEALTHY';

  const nextService = new Date(nextServiceDate);
  if (Number.isNaN(nextService.getTime())) return 'HEALTHY';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (nextService.getTime() < today.getTime()) return 'NEEDS_SERVICE';

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  if (nextService.getTime() <= sevenDaysFromNow.getTime()) return 'NEEDS_SERVICE';

  return 'HEALTHY';
}

function buildServiceNotes(details: {
  notes?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  serviceProvider?: string;
}) {
  return [
    details.serviceProvider ? `Service provider: ${details.serviceProvider}` : null,
    details.serialNumber ? `Serial number: ${details.serialNumber}` : null,
    details.manufacturer ? `Manufacturer: ${details.manufacturer}` : null,
    details.model ? `Model: ${details.model}` : null,
    details.notes ? `Notes: ${details.notes}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

async function loadMachineProfiles(service: ReturnType<typeof createServiceRoleClient>, machineIds: string[]) {
  if (!machineIds.length) return new Map<string, MachineProfileRow>();

  const profilesResult = await service
    .schema('icecream_erp')
    .from('machine_profiles')
    .select('*')
    .in('machine_id', machineIds);

  if (profilesResult.error && !isMissingTableError(profilesResult.error, 'machine_profiles')) {
    throw profilesResult.error;
  }

  return new Map(
    (profilesResult.data ?? []).map((row) => [String(row.machine_id ?? ''), row as MachineProfileRow]),
  );
}

function buildMachinePayload(params: {
  body: {
    code: string;
    machineType: string;
    location?: string;
    name: string;
    operationalStatus?: string;
    purchaseDate?: string;
  };
  organizationId: string;
}) {
  const operationalStatus = normalizeOperationalStatus(params.body.operationalStatus ?? 'ACTIVE');

  return {
    modern: {
      code: params.body.code,
      is_active: operationalStatus !== 'INACTIVE',
      location: params.body.location ?? null,
      machine_type: params.body.machineType,
      name: params.body.name,
      organization_id: params.organizationId,
      purchase_date: params.body.purchaseDate ? new Date(params.body.purchaseDate).toISOString() : null,
      status: operationalStatus,
      warranty_expiry: null,
    },
    legacy: {
      asset_number: params.body.code,
      description: params.body.machineType,
      location: params.body.location ?? null,
      name: params.body.name,
      organization_id: params.organizationId,
      purchase_date: params.body.purchaseDate ? new Date(params.body.purchaseDate).toISOString() : null,
      status: operationalStatus,
    },
  };
}

function normalizeMachineRecord(input: {
  breakdowns: MachineBreakdownRow[];
  machine: MachineRow;
  profile: MachineProfileRow | null;
  schedules: MaintenanceScheduleRow[];
}) {
  const machineId = String(input.machine.id ?? '');
  const completedSchedules = input.schedules.filter((row) => String(row.status ?? '').toUpperCase() === 'COMPLETED');
  const scheduledRows = input.schedules.filter((row) => !String(row.completed_date ?? '') && row.scheduled_date);
  const latestCompletedSchedule = completedSchedules[0] ?? null;
  const nextScheduledRow = scheduledRows
    .map((row) => ({ ...row, scheduled_date: safeDate(row.scheduled_date) }))
    .filter((row) => row.scheduled_date)
    .sort((left, right) => String(left.scheduled_date).localeCompare(String(right.scheduled_date)))[0] ?? null;

  const totalMaintenanceCost =
    input.schedules.reduce((sum, row) => sum + Number(row.cost ?? 0), 0) +
    input.breakdowns.reduce((sum, row) => sum + Number(row.repair_cost ?? 0), 0);
  const lastServiceDate =
    safeDate(input.machine.last_maintenance) ??
    safeDate(latestCompletedSchedule?.completed_date ?? latestCompletedSchedule?.scheduled_date) ??
    null;
  const nextServiceDate =
    safeDate(input.machine.next_maintenance) ??
    safeDate(nextScheduledRow?.scheduled_date) ??
    null;
  const operationalStatus = normalizeOperationalStatus(input.machine.status);
  const explicitHealthStatus = input.profile?.health_status ? String(input.profile.health_status) : null;
  const healthStatus = deriveHealthStatus(operationalStatus, nextServiceDate, explicitHealthStatus);

  return {
    branchName: String(input.profile?.branch_name ?? ''),
    breakdownCount: input.breakdowns.length,
    code: normalizeMachineCode(input.machine),
    id: machineId,
    healthStatus,
    isActive: input.machine.is_active !== false && operationalStatus !== 'INACTIVE',
    lastServiceCost: Number(
      input.profile?.last_service_cost ??
        latestCompletedSchedule?.cost ??
        0,
    ),
    lastServiceDate,
    location: String(input.machine.location ?? ''),
    machineType: normalizeMachineType(input.machine),
    manufacturer: String(input.profile?.manufacturer ?? ''),
    model: String(input.profile?.model ?? ''),
    name: String(input.machine.name ?? 'Unnamed machine'),
    nextServiceDate,
    notes: String(input.profile?.notes ?? ''),
    operationalStatus,
    purchaseCost: Number(input.profile?.purchase_cost ?? input.machine.purchase_cost ?? 0),
    purchaseDate: safeDate(input.machine.purchase_date),
    serialNumber: String(input.profile?.serial_number ?? ''),
    serviceInterval: Number(input.profile?.service_interval_days ?? 0),
    serviceProvider: String(input.profile?.service_provider ?? ''),
    totalMaintenanceCost,
  };
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'maintenance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'));
  const search = (searchParams.get('search') ?? '').trim().toLowerCase();
  const machineType = (searchParams.get('machineType') ?? '').trim().toUpperCase();
  const status = (searchParams.get('status') ?? '').trim().toUpperCase();
  const isActive = searchParams.get('isActive');

  try {
    let machinesResult = await service
      .schema('icecream_erp')
      .from('machines')
      .select('*', { count: 'exact' })
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (machinesResult.error && isMissingColumnError(machinesResult.error, 'machines', 'deleted_at')) {
      machinesResult = await service
        .schema('icecream_erp')
        .from('machines')
        .select('*', { count: 'exact' })
        .eq('organization_id', ctx.organizationId)
        .order('created_at', { ascending: false });
    }

    if (machinesResult.error) {
      if (isMissingTableError(machinesResult.error, 'machines')) {
        return NextResponse.json({ data: [], total: 0, page, limit, totalPages: 0 });
      }
      throw machinesResult.error;
    }

    const machineRows = (machinesResult.data ?? []) as MachineRow[];
    const machineIds = machineRows.map((row) => String(row.id ?? '')).filter(Boolean);
    const [profilesByMachineId, schedulesResult, breakdownsResult] = await Promise.all([
      loadMachineProfiles(service, machineIds),
      machineIds.length
        ? service
            .schema('icecream_erp')
            .from('maintenance_schedules')
            .select('machine_id, scheduled_date, completed_date, status, cost')
            .in('machine_id', machineIds)
            .order('completed_date', { ascending: false, nullsFirst: false })
        : Promise.resolve({ data: [], error: null }),
      machineIds.length
        ? service
            .schema('icecream_erp')
            .from('machine_breakdowns')
            .select('machine_id, status, repair_cost')
            .in('machine_id', machineIds)
            .order('breakdown_date', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (schedulesResult.error && !isMissingTableError(schedulesResult.error, 'maintenance_schedules')) {
      throw schedulesResult.error;
    }
    if (breakdownsResult.error && !isMissingTableError(breakdownsResult.error, 'machine_breakdowns')) {
      throw breakdownsResult.error;
    }

    const schedulesByMachineId = new Map<string, MaintenanceScheduleRow[]>();
    for (const row of schedulesResult.data ?? []) {
      const machineId = String(row.machine_id ?? '');
      const current = schedulesByMachineId.get(machineId) ?? [];
      current.push(row as MaintenanceScheduleRow);
      schedulesByMachineId.set(machineId, current);
    }

    const breakdownsByMachineId = new Map<string, MachineBreakdownRow[]>();
    for (const row of breakdownsResult.data ?? []) {
      const machineId = String(row.machine_id ?? '');
      const current = breakdownsByMachineId.get(machineId) ?? [];
      current.push(row as MachineBreakdownRow);
      breakdownsByMachineId.set(machineId, current);
    }

    const normalized = machineRows
      .map((machine) =>
        normalizeMachineRecord({
          breakdowns: breakdownsByMachineId.get(String(machine.id ?? '')) ?? [],
          machine,
          profile: profilesByMachineId.get(String(machine.id ?? '')) ?? null,
          schedules: schedulesByMachineId.get(String(machine.id ?? '')) ?? [],
        }),
      )
      .filter((machine) => {
        if (status && machine.operationalStatus !== status) return false;
        if (machineType && machine.machineType.trim().toUpperCase() !== machineType) return false;
        if (isActive === 'true' && !machine.isActive) return false;
        if (isActive === 'false' && machine.isActive) return false;
        if (!search) return true;

        const haystack = [
          machine.code,
          machine.name,
          machine.location,
          machine.branchName,
          machine.machineType,
          machine.serialNumber,
          machine.manufacturer,
          machine.model,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(search);
      });

    const start = (page - 1) * limit;
    const data = normalized.slice(start, start + limit);

    return NextResponse.json({
      data,
      total: normalized.length,
      page,
      limit,
      totalPages: Math.ceil(normalized.length / limit),
    });
  } catch (err) {
    return apiServerError({
      ctx,
      error: err,
      message: 'Machines could not be loaded.',
      module: 'maintenance.machines',
      path: request.nextUrl.pathname,
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'maintenance.write')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      branchName?: string;
      code: string;
      healthStatus?: string;
      lastServiceCost?: number;
      lastServiceDate?: string;
      location?: string;
      machineType: string;
      manufacturer?: string;
      model?: string;
      name: string;
      notes?: string;
      operationalStatus?: string;
      purchaseCost?: number;
      purchaseDate?: string;
      serialNumber?: string;
      serviceInterval?: number;
      serviceProvider?: string;
      nextServiceDate?: string;
    };

    if (!body.code || !body.name || !body.machineType) {
      return badRequest('code, name, and machineType are required.');
    }

    let existingResult = await service
      .schema('icecream_erp')
      .from('machines')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('code', body.code)
      .maybeSingle();

    if (existingResult.error && isMissingColumnError(existingResult.error, 'machines', 'code')) {
      existingResult = await service
        .schema('icecream_erp')
        .from('machines')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .eq('asset_number', body.code)
        .maybeSingle();
    }

    if (existingResult.error && !isMissingTableError(existingResult.error, 'machines')) {
      throw existingResult.error;
    }
    if (existingResult.data) return badRequest(`Machine code ${body.code} already exists.`);

    const payloads = buildMachinePayload({
      body,
      organizationId: ctx.organizationId,
    });

    let machineInsert = await service
      .schema('icecream_erp')
      .from('machines')
      .insert(payloads.modern)
      .select('*')
      .single();

    if (
      machineInsert.error &&
      (
        isMissingColumnError(machineInsert.error, 'machines', 'code') ||
        isMissingColumnError(machineInsert.error, 'machines', 'machine_type') ||
        isMissingColumnError(machineInsert.error, 'machines', 'is_active') ||
        isMissingColumnError(machineInsert.error, 'machines', 'warranty_expiry')
      )
    ) {
      machineInsert = await service
        .schema('icecream_erp')
        .from('machines')
        .insert(payloads.legacy)
        .select('*')
        .single();
    }

    if (machineInsert.error && isMissingTableError(machineInsert.error, 'machines')) {
      return NextResponse.json(
        { error: 'Machine maintenance is not available in this environment.' },
        { status: 503 },
      );
    }
    if (machineInsert.error || !machineInsert.data) {
      throw machineInsert.error ?? new Error('Failed to create machine.');
    }

    const machineId = String(machineInsert.data.id ?? '');
    const normalizedHealthStatus = String(body.healthStatus ?? '').trim().toUpperCase();
    const profilePayload = {
      branch_name: body.branchName?.trim() || null,
      health_status: healthStatuses.has(normalizedHealthStatus) ? normalizedHealthStatus : null,
      last_service_cost: Number(body.lastServiceCost ?? 0) || 0,
      machine_id: machineId,
      manufacturer: body.manufacturer?.trim() || null,
      model: body.model?.trim() || null,
      notes: body.notes?.trim() || null,
      organization_id: ctx.organizationId,
      purchase_cost: Number(body.purchaseCost ?? 0) || 0,
      serial_number: body.serialNumber?.trim() || null,
      service_interval_days: Number(body.serviceInterval ?? 0) || 0,
      service_provider: body.serviceProvider?.trim() || null,
    };

    const profileInsert = await service
      .schema('icecream_erp')
      .from('machine_profiles')
      .upsert(profilePayload, { onConflict: 'machine_id' });
    if (profileInsert.error && !isMissingTableError(profileInsert.error, 'machine_profiles')) {
      throw profileInsert.error;
    }

    const serviceNotes = buildServiceNotes({
      manufacturer: body.manufacturer,
      model: body.model,
      notes: body.notes,
      serialNumber: body.serialNumber,
      serviceProvider: body.serviceProvider,
    });

    if (body.lastServiceDate) {
      const completedScheduleResult = await service
        .schema('icecream_erp')
        .from('maintenance_schedules')
        .insert({
          completed_date: new Date(body.lastServiceDate).toISOString(),
          cost: Number(body.lastServiceCost ?? 0) || 0,
          machine_id: machineId,
          maintenance_type: 'PREVENTIVE',
          notes: serviceNotes || null,
          organization_id: ctx.organizationId,
          scheduled_date: new Date(body.lastServiceDate).toISOString(),
          status: 'COMPLETED',
        });
      if (completedScheduleResult.error && !isMissingTableError(completedScheduleResult.error, 'maintenance_schedules')) {
        throw completedScheduleResult.error;
      }
    }

    if (body.nextServiceDate) {
      const scheduledResult = await service
        .schema('icecream_erp')
        .from('maintenance_schedules')
        .insert({
          machine_id: machineId,
          maintenance_type: 'PREVENTIVE',
          notes: serviceNotes || null,
          organization_id: ctx.organizationId,
          scheduled_date: new Date(body.nextServiceDate).toISOString(),
          status: 'SCHEDULED',
        });
      if (scheduledResult.error && !isMissingTableError(scheduledResult.error, 'maintenance_schedules')) {
        throw scheduledResult.error;
      }
    }

    return NextResponse.json({ id: machineId }, { status: 201 });
  } catch (err) {
    return apiServerError({
      ctx,
      error: err,
      message: 'The machine record could not be created.',
      module: 'maintenance.machines',
      path: request.nextUrl.pathname,
      status: 500,
      transactionReference: 'maintenance-machine-create',
    });
  }
}
