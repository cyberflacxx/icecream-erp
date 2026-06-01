import assert from 'node:assert/strict';
import test from 'node:test';

import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { MaintenanceService } from '../modules/maintenance/maintenance.service';

interface MachineRow {
  code: string;
  createdAt: Date;
  deletedAt: Date | null;
  id: string;
  isActive: boolean;
  location: string | null;
  machineType: string;
  name: string;
  organizationId: string;
  purchaseDate: Date | null;
  status: string;
  updatedAt: Date;
  warrantyExpiry: Date | null;
}

interface ScheduleRow {
  completedDate: Date | null;
  cost: Decimal | null;
  createdAt: Date;
  deletedAt: Date | null;
  id: string;
  machineId: string;
  maintenanceType: 'PREVENTIVE' | 'CORRECTIVE' | 'BREAKDOWN' | 'INSPECTION';
  notes: string | null;
  organizationId: string;
  performedBy: string | null;
  scheduledDate: Date;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  updatedAt: Date;
}

interface BreakdownRow {
  breakdownDate: Date;
  createdAt: Date;
  deletedAt: Date | null;
  description: string;
  downtimeHours: Decimal | null;
  id: string;
  machineId: string;
  organizationId: string;
  repairCost: Decimal | null;
  reportedBy: string;
  resolvedAt: Date | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  updatedAt: Date;
}

interface MockState {
  breakdowns: BreakdownRow[];
  machines: MachineRow[];
  schedules: ScheduleRow[];
}

const context = {
  organizationId: 'org-1',
  userProfileId: 'user-1'
};

function decimal(value: number | string) {
  return new Decimal(value);
}

function cloneValue<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value instanceof Decimal) return new Decimal(value) as T;
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneValue(item)])
    ) as T;
  }
  return value;
}

function createState(overrides: Partial<MockState> = {}): MockState {
  const now = new Date('2026-06-01T00:00:00.000Z');
  return {
    machines: [{
      id: 'machine-1',
      organizationId: context.organizationId,
      code: 'MC-001',
      name: 'Pasteurizer',
      location: 'Factory A',
      machineType: 'PROCESSING',
      status: 'ACTIVE',
      purchaseDate: null,
      warrantyExpiry: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }],
    schedules: [{
      id: 'schedule-1',
      organizationId: context.organizationId,
      machineId: 'machine-1',
      maintenanceType: 'PREVENTIVE',
      status: 'SCHEDULED',
      scheduledDate: now,
      completedDate: null,
      performedBy: null,
      cost: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }],
    breakdowns: [{
      id: 'breakdown-1',
      organizationId: context.organizationId,
      machineId: 'machine-1',
      breakdownDate: now,
      description: 'Noise in compressor',
      severity: 'MEDIUM',
      status: 'SCHEDULED',
      reportedBy: context.userProfileId,
      resolvedAt: null,
      downtimeHours: null,
      repairCost: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }],
    ...overrides
  };
}

function createMockPrisma(initialState: MockState) {
  let state = cloneValue(initialState);
  let idCounter = 2;

  const mock = {
    machine: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = state.machines.find((machine) =>
          Object.entries(where).every(([key, value]) => (machine as unknown as Record<string, unknown>)[key] === value)
        );
        return cloneValue(row ?? null);
      },
      findMany: async () => cloneValue(state.machines),
      count: async () => state.machines.length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const row: MachineRow = {
          id: `machine-${idCounter++}`,
          organizationId: String(data.organizationId),
          code: String(data.code),
          name: String(data.name),
          location: (data.location as string | null | undefined) ?? null,
          machineType: String(data.machineType),
          status: String(data.status),
          purchaseDate: (data.purchaseDate as Date | null | undefined) ?? null,
          warrantyExpiry: (data.warrantyExpiry as Date | null | undefined) ?? null,
          isActive: Boolean(data.isActive),
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
        state.machines.push(row);
        return cloneValue(row);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = state.machines.find((machine) => machine.id === where.id);
        if (!row) throw new Error('Machine not found');
        Object.assign(row, cloneValue(data), { updatedAt: new Date() });
        return cloneValue(row);
      }
    },
    maintenanceSchedule: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = state.schedules.find((schedule) =>
          Object.entries(where).every(([key, value]) => (schedule as unknown as Record<string, unknown>)[key] === value)
        );
        return cloneValue(row ?? null);
      },
      findMany: async () => cloneValue(state.schedules),
      count: async () => state.schedules.length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const row: ScheduleRow = {
          id: `schedule-${idCounter++}`,
          organizationId: String(data.organizationId),
          machineId: String(data.machineId),
          maintenanceType: data.maintenanceType as ScheduleRow['maintenanceType'],
          status: data.status as ScheduleRow['status'],
          scheduledDate: data.scheduledDate as Date,
          completedDate: null,
          performedBy: null,
          cost: null,
          notes: (data.notes as string | null | undefined) ?? null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
        state.schedules.push(row);
        return cloneValue(row);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = state.schedules.find((schedule) => schedule.id === where.id);
        if (!row) throw new Error('Schedule not found');
        Object.assign(row, cloneValue(data), { updatedAt: new Date() });
        return cloneValue(row);
      }
    },
    machineBreakdown: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = state.breakdowns.find((breakdown) =>
          Object.entries(where).every(([key, value]) => (breakdown as unknown as Record<string, unknown>)[key] === value)
        );
        return cloneValue(row ?? null);
      },
      findMany: async () => cloneValue(state.breakdowns),
      count: async () => state.breakdowns.length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const row: BreakdownRow = {
          id: `breakdown-${idCounter++}`,
          organizationId: String(data.organizationId),
          machineId: String(data.machineId),
          breakdownDate: data.breakdownDate as Date,
          description: String(data.description),
          severity: data.severity as BreakdownRow['severity'],
          status: data.status as BreakdownRow['status'],
          reportedBy: String(data.reportedBy),
          resolvedAt: null,
          downtimeHours: null,
          repairCost: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
        state.breakdowns.push(row);
        return cloneValue(row);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = state.breakdowns.find((breakdown) => breakdown.id === where.id);
        if (!row) throw new Error('Breakdown not found');
        Object.assign(row, cloneValue(data), { updatedAt: new Date() });
        return cloneValue(row);
      }
    },
    getState: () => cloneValue(state)
  };

  return mock;
}

async function withMockState<T>(initialState: MockState, callback: (mock: ReturnType<typeof createMockPrisma>) => Promise<T>) {
  const prismaAny = prisma as unknown as Record<string, unknown>;
  const mock = createMockPrisma(initialState);
  const original = {
    machine: prismaAny.machine,
    maintenanceSchedule: prismaAny.maintenanceSchedule,
    machineBreakdown: prismaAny.machineBreakdown
  };

  Object.assign(prismaAny, {
    machine: mock.machine,
    maintenanceSchedule: mock.maintenanceSchedule,
    machineBreakdown: mock.machineBreakdown
  });

  try {
    return await callback(mock);
  } finally {
    Object.assign(prismaAny, original);
  }
}

test('createMachine throws on duplicate machine code', async () => {
  await withMockState(createState(), async () => {
    await assert.rejects(
      () => MaintenanceService.createMachine(context, {
        code: 'MC-001',
        name: 'Pasteurizer Duplicate',
        location: 'Factory B',
        machineType: 'PROCESSING',
        status: 'ACTIVE',
        isActive: true
      }),
      (error: Error & { code?: string }) => error.code === 'DUPLICATE_MACHINE_CODE'
    );
  });
});

test('createMachine succeeds with unique machine code', async () => {
  await withMockState(createState(), async (mock) => {
    const created = await MaintenanceService.createMachine(context, {
      code: 'MC-002',
      name: 'Homogenizer',
      location: 'Factory B',
      machineType: 'PROCESSING',
      status: 'ACTIVE',
      isActive: true
    });

    assert.equal(created.code, 'MC-002');
    assert.equal(mock.getState().machines.length, 2);
  });
});

test('createSchedule sets status to SCHEDULED', async () => {
  await withMockState(createState(), async () => {
    const created = await MaintenanceService.createSchedule(context, {
      machineId: 'machine-1',
      maintenanceType: 'PREVENTIVE',
      scheduledDate: '2026-06-10T00:00:00.000Z',
      notes: 'Weekly check'
    });

    assert.equal(created.status, 'SCHEDULED');
  });
});

test('completeSchedule updates status to COMPLETED', async () => {
  await withMockState(createState(), async () => {
    const completed = await MaintenanceService.completeSchedule(context, 'schedule-1', {
      completedDate: '2026-06-12T00:00:00.000Z',
      cost: 150
    });

    assert.equal(completed.status, 'COMPLETED');
    assert.equal(completed.cost?.toNumber(), 150);
  });
});

test('resolveBreakdown updates status to COMPLETED', async () => {
  await withMockState(createState(), async () => {
    const resolved = await MaintenanceService.resolveBreakdown(context, 'breakdown-1', {
      resolvedAt: '2026-06-12T00:00:00.000Z',
      downtimeHours: 2.5,
      repairCost: 300
    });

    assert.equal(resolved.status, 'COMPLETED');
    assert.equal(resolved.downtimeHours?.toNumber(), 2.5);
    assert.equal(resolved.repairCost?.toNumber(), 300);
  });
});
