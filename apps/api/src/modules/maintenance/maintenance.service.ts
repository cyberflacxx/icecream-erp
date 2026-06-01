import { prisma } from '@absolute-ice-cream/database';
import { Decimal } from '@prisma/client/runtime/library';

import { AppError } from '../../utils/errors';
import type {
  CompleteScheduleInput,
  CreateBreakdownInput,
  CreateMachineInput,
  CreateScheduleInput,
  ListBreakdownsQuery,
  ListMachinesQuery,
  ListSchedulesQuery,
  ResolveBreakdownInput,
  UpdateMachineInput
} from './maintenance.schemas';

interface MaintenanceContext {
  organizationId: string;
  userProfileId: string;
}

const decimal = (value: number | string) => new Decimal(value);

function createPaginationResult<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export class MaintenanceService {
  static async listMachines(context: MaintenanceContext, filters: ListMachinesQuery) {
    const page = filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;
    const where = {
      organizationId: context.organizationId,
      deletedAt: null,
      machineType: filters.machineType,
      status: filters.status,
      isActive: filters.isActive,
      OR: filters.search ? [
        { code: { contains: filters.search, mode: 'insensitive' as const } },
        { name: { contains: filters.search, mode: 'insensitive' as const } },
        { location: { contains: filters.search, mode: 'insensitive' as const } }
      ] : undefined
    };

    const [data, total] = await Promise.all([
      prisma.machine.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.machine.count({ where })
    ]);

    return createPaginationResult(data, total, page, limit);
  }

  static async createMachine(context: MaintenanceContext, data: CreateMachineInput) {
    const existing = await prisma.machine.findFirst({
      where: {
        organizationId: context.organizationId,
        code: data.code,
        deletedAt: null
      }
    });

    if (existing) {
      throw new AppError(`Machine code ${data.code} already exists`, 409, 'DUPLICATE_MACHINE_CODE');
    }

    return prisma.machine.create({
      data: {
        organizationId: context.organizationId,
        code: data.code,
        name: data.name,
        location: data.location ?? null,
        machineType: data.machineType,
        status: data.status,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
        isActive: data.isActive
      }
    });
  }

  static async getMachine(context: MaintenanceContext, id: string) {
    const machine = await prisma.machine.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
        deletedAt: null
      },
      include: {
        maintenanceSchedules: {
          where: { deletedAt: null },
          orderBy: { scheduledDate: 'desc' },
          take: 10
        },
        breakdowns: {
          where: { deletedAt: null },
          orderBy: { breakdownDate: 'desc' },
          take: 10
        }
      }
    });

    if (!machine) {
      throw new AppError('Machine not found', 404, 'NOT_FOUND');
    }

    return machine;
  }

  static async updateMachine(context: MaintenanceContext, id: string, data: UpdateMachineInput) {
    await MaintenanceService.getMachine(context, id);

    return prisma.machine.update({
      where: { id },
      data: {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : undefined
      }
    });
  }

  static async listSchedules(context: MaintenanceContext, filters: ListSchedulesQuery) {
    const page = filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;
    const where = {
      organizationId: context.organizationId,
      deletedAt: null,
      machineId: filters.machineId,
      maintenanceType: filters.maintenanceType,
      status: filters.status
    };

    const [data, total] = await Promise.all([
      prisma.maintenanceSchedule.findMany({
        where,
        skip,
        take: limit,
        include: {
          machine: {
            select: { id: true, name: true, code: true }
          }
        },
        orderBy: { scheduledDate: 'desc' }
      }),
      prisma.maintenanceSchedule.count({ where })
    ]);

    return createPaginationResult(data, total, page, limit);
  }

  static async createSchedule(context: MaintenanceContext, data: CreateScheduleInput) {
    const machine = await prisma.machine.findFirst({
      where: {
        id: data.machineId,
        organizationId: context.organizationId,
        deletedAt: null
      }
    });

    if (!machine) {
      throw new AppError('Machine not found', 404, 'NOT_FOUND');
    }

    return prisma.maintenanceSchedule.create({
      data: {
        organizationId: context.organizationId,
        machineId: data.machineId,
        maintenanceType: data.maintenanceType,
        status: 'SCHEDULED',
        scheduledDate: new Date(data.scheduledDate),
        notes: data.notes ?? null
      }
    });
  }

  static async getSchedule(context: MaintenanceContext, id: string) {
    const schedule = await prisma.maintenanceSchedule.findFirst({
      where: { id, organizationId: context.organizationId, deletedAt: null },
      include: {
        machine: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    if (!schedule) {
      throw new AppError('Maintenance schedule not found', 404, 'NOT_FOUND');
    }

    return schedule;
  }

  static async updateSchedule(context: MaintenanceContext, id: string, data: Partial<CreateScheduleInput>) {
    await MaintenanceService.getSchedule(context, id);

    return prisma.maintenanceSchedule.update({
      where: { id },
      data: {
        machineId: data.machineId,
        maintenanceType: data.maintenanceType,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
        notes: data.notes
      }
    });
  }

  static async completeSchedule(context: MaintenanceContext, id: string, data: CompleteScheduleInput) {
    await MaintenanceService.getSchedule(context, id);

    return prisma.maintenanceSchedule.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedDate: new Date(data.completedDate),
        performedBy: data.performedBy ?? context.userProfileId,
        cost: data.cost !== undefined ? decimal(data.cost) : undefined,
        notes: data.notes
      }
    });
  }

  static async listBreakdowns(context: MaintenanceContext, filters: ListBreakdownsQuery) {
    const page = filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;
    const where = {
      organizationId: context.organizationId,
      deletedAt: null,
      machineId: filters.machineId,
      severity: filters.severity,
      status: filters.status
    };

    const [data, total] = await Promise.all([
      prisma.machineBreakdown.findMany({
        where,
        skip,
        take: limit,
        include: {
          machine: {
            select: { id: true, name: true, code: true }
          }
        },
        orderBy: { breakdownDate: 'desc' }
      }),
      prisma.machineBreakdown.count({ where })
    ]);

    return createPaginationResult(data, total, page, limit);
  }

  static async createBreakdown(context: MaintenanceContext, data: CreateBreakdownInput) {
    const machine = await prisma.machine.findFirst({
      where: {
        id: data.machineId,
        organizationId: context.organizationId,
        deletedAt: null
      }
    });

    if (!machine) {
      throw new AppError('Machine not found', 404, 'NOT_FOUND');
    }

    return prisma.machineBreakdown.create({
      data: {
        organizationId: context.organizationId,
        machineId: data.machineId,
        breakdownDate: new Date(data.breakdownDate),
        description: data.description,
        severity: data.severity,
        status: 'SCHEDULED',
        reportedBy: context.userProfileId
      }
    });
  }

  static async getBreakdown(context: MaintenanceContext, id: string) {
    const breakdown = await prisma.machineBreakdown.findFirst({
      where: { id, organizationId: context.organizationId, deletedAt: null },
      include: {
        machine: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    if (!breakdown) {
      throw new AppError('Breakdown not found', 404, 'NOT_FOUND');
    }

    return breakdown;
  }

  static async updateBreakdown(context: MaintenanceContext, id: string, data: Partial<CreateBreakdownInput>) {
    await MaintenanceService.getBreakdown(context, id);

    return prisma.machineBreakdown.update({
      where: { id },
      data: {
        machineId: data.machineId,
        breakdownDate: data.breakdownDate ? new Date(data.breakdownDate) : undefined,
        description: data.description,
        severity: data.severity
      }
    });
  }

  static async resolveBreakdown(context: MaintenanceContext, id: string, data: ResolveBreakdownInput) {
    await MaintenanceService.getBreakdown(context, id);

    return prisma.machineBreakdown.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        resolvedAt: new Date(data.resolvedAt),
        downtimeHours: data.downtimeHours !== undefined ? decimal(data.downtimeHours) : undefined,
        repairCost: data.repairCost !== undefined ? decimal(data.repairCost) : undefined
      }
    });
  }
}
