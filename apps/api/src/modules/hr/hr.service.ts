import { prisma } from '@absolute-ice-cream/database';
import { Decimal } from '@prisma/client/runtime/library';

import { AppError } from '../../utils/errors';
import type {
  CreateAttendanceInput,
  CreateEmployeeInput,
  CreateLeaveInput,
  CreatePayrollInput,
  ListAttendanceQuery,
  ListEmployeesQuery,
  ListLeaveQuery,
  ListPayrollQuery,
  UpdateEmployeeInput
} from './hr.schemas';

interface HrContext {
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

export class HrService {
  static async listEmployees(context: HrContext, filters: ListEmployeesQuery) {
    const page = filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;
    const where = {
      organizationId: context.organizationId,
      deletedAt: null,
      department: filters.department,
      status: filters.status,
      branchId: filters.branchId,
      OR: filters.search ? [
        { firstName: { contains: filters.search, mode: 'insensitive' as const } },
        { lastName: { contains: filters.search, mode: 'insensitive' as const } },
        { employeeNumber: { contains: filters.search, mode: 'insensitive' as const } },
        { email: { contains: filters.search, mode: 'insensitive' as const } }
      ] : undefined
    };

    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        include: {
          branch: {
            select: { id: true, name: true, code: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.employee.count({ where })
    ]);

    return createPaginationResult(data, total, page, limit);
  }

  static async createEmployee(context: HrContext, data: CreateEmployeeInput) {
    const existing = await prisma.employee.findFirst({
      where: {
        organizationId: context.organizationId,
        employeeNumber: data.employeeNumber,
        deletedAt: null
      }
    });

    if (existing) {
      throw new AppError(
        `Employee number ${data.employeeNumber} already exists`,
        409,
        'DUPLICATE_EMPLOYEE_NUMBER'
      );
    }

    return prisma.employee.create({
      data: {
        ...data,
        email: data.email || null,
        organizationId: context.organizationId,
        hireDate: new Date(data.hireDate)
      }
    });
  }

  static async getEmployee(context: HrContext, id: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, organizationId: context.organizationId, deletedAt: null },
      include: {
        branch: true,
        attendances: {
          orderBy: { attendanceDate: 'desc' },
          take: 10
        },
        payrollRecords: {
          orderBy: { payPeriodStart: 'desc' },
          take: 5
        }
      }
    });

    if (!employee) {
      throw new AppError('Employee not found', 404, 'NOT_FOUND');
    }

    return employee;
  }

  static async updateEmployee(context: HrContext, id: string, data: UpdateEmployeeInput) {
    const employee = await prisma.employee.findFirst({
      where: { id, organizationId: context.organizationId, deletedAt: null }
    });

    if (!employee) {
      throw new AppError('Employee not found', 404, 'NOT_FOUND');
    }

    return prisma.employee.update({
      where: { id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined
      }
    });
  }

  static async deleteEmployee(context: HrContext, id: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, organizationId: context.organizationId, deletedAt: null }
    });

    if (!employee) {
      throw new AppError('Employee not found', 404, 'NOT_FOUND');
    }

    return prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'TERMINATED'
      }
    });
  }

  static async listAttendance(context: HrContext, filters: ListAttendanceQuery) {
    const page = filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;
    const where = {
      organizationId: context.organizationId,
      employeeId: filters.employeeId,
      shift: filters.shift,
      attendanceDate: filters.dateFrom || filters.dateTo ? {
        gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        lte: filters.dateTo ? new Date(filters.dateTo) : undefined
      } : undefined
    };

    const [data, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true
            }
          }
        },
        orderBy: { attendanceDate: 'desc' }
      }),
      prisma.attendance.count({ where })
    ]);

    return createPaginationResult(data, total, page, limit);
  }

  static async createAttendance(context: HrContext, data: CreateAttendanceInput) {
    const attendanceDate = new Date(data.attendanceDate);
    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate_shift: {
          employeeId: data.employeeId,
          attendanceDate,
          shift: data.shift
        }
      }
    });

    if (existing) {
      throw new AppError(
        'Attendance record already exists for this employee, date, and shift',
        409,
        'DUPLICATE_ATTENDANCE'
      );
    }

    return prisma.attendance.create({
      data: {
        organizationId: context.organizationId,
        employeeId: data.employeeId,
        attendanceDate,
        shift: data.shift,
        checkIn: data.checkIn ? new Date(data.checkIn) : null,
        checkOut: data.checkOut ? new Date(data.checkOut) : null,
        hoursWorked: data.hoursWorked !== undefined ? decimal(data.hoursWorked) : null,
        notes: data.notes ?? null
      }
    });
  }

  static async getAttendance(context: HrContext, id: string) {
    const record = await prisma.attendance.findFirst({
      where: {
        id,
        organizationId: context.organizationId
      },
      include: {
        employee: true
      }
    });

    if (!record) {
      throw new AppError('Attendance record not found', 404, 'NOT_FOUND');
    }

    return record;
  }

  static async listLeaveRequests(context: HrContext, filters: ListLeaveQuery) {
    const page = filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;
    const where = {
      organizationId: context.organizationId,
      deletedAt: null,
      employeeId: filters.employeeId,
      status: filters.status
    };

    const [data, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.leaveRequest.count({ where })
    ]);

    return createPaginationResult(data, total, page, limit);
  }

  static async createLeaveRequest(context: HrContext, data: CreateLeaveInput) {
    return prisma.leaveRequest.create({
      data: {
        organizationId: context.organizationId,
        employeeId: data.employeeId,
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        daysRequested: decimal(data.daysRequested),
        reason: data.reason ?? null,
        status: 'PENDING'
      }
    });
  }

  static async getLeaveRequest(context: HrContext, id: string) {
    const record = await prisma.leaveRequest.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
        deletedAt: null
      }
    });

    if (!record) {
      throw new AppError('Leave request not found', 404, 'NOT_FOUND');
    }

    return record;
  }

  static async approveLeave(context: HrContext, id: string) {
    await HrService.getLeaveRequest(context, id);

    return prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: context.userProfileId,
        approvedAt: new Date()
      }
    });
  }

  static async rejectLeave(context: HrContext, id: string) {
    await HrService.getLeaveRequest(context, id);

    return prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED'
      }
    });
  }

  static async listPayroll(context: HrContext, filters: ListPayrollQuery) {
    const page = filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;
    const where = {
      organizationId: context.organizationId,
      deletedAt: null,
      employeeId: filters.employeeId,
      status: filters.status
    };

    const [data, total] = await Promise.all([
      prisma.payrollRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payrollRecord.count({ where })
    ]);

    return createPaginationResult(data, total, page, limit);
  }

  static async createPayroll(context: HrContext, data: CreatePayrollInput) {
    const netPay = data.basicSalary + (data.allowances ?? 0) - (data.deductions ?? 0);

    if (netPay < 0) {
      throw new AppError(
        'Net pay cannot be negative. Deductions exceed salary and allowances.',
        400,
        'NEGATIVE_NET_PAY'
      );
    }

    return prisma.payrollRecord.create({
      data: {
        organizationId: context.organizationId,
        employeeId: data.employeeId,
        payPeriodStart: new Date(data.payPeriodStart),
        payPeriodEnd: new Date(data.payPeriodEnd),
        basicSalary: decimal(data.basicSalary),
        allowances: decimal(data.allowances ?? 0),
        deductions: decimal(data.deductions ?? 0),
        netPay: decimal(netPay),
        status: 'DRAFT',
        notes: data.notes ?? null,
        createdBy: context.userProfileId
      }
    });
  }

  static async getPayroll(context: HrContext, id: string) {
    const record = await prisma.payrollRecord.findFirst({
      where: { id, organizationId: context.organizationId, deletedAt: null },
      include: { employee: true }
    });

    if (!record) {
      throw new AppError('Payroll record not found', 404, 'NOT_FOUND');
    }

    return record;
  }

  static async approvePayroll(context: HrContext, id: string) {
    await HrService.getPayroll(context, id);

    return prisma.payrollRecord.update({
      where: { id },
      data: {
        status: 'APPROVED'
      }
    });
  }

  static async payPayroll(context: HrContext, id: string) {
    await HrService.getPayroll(context, id);

    return prisma.payrollRecord.update({
      where: { id },
      data: {
        status: 'PAID'
      }
    });
  }
}
