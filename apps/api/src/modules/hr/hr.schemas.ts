import { z } from 'zod';

export const hrPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional()
});

export const employeeIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const createEmployeeSchema = z.object({
  employeeNumber: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  department: z.string().trim().min(1),
  jobTitle: z.string().trim().min(1),
  branchId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).default('ACTIVE'),
  hireDate: z.string().datetime()
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const listEmployeesQuerySchema = hrPaginationQuerySchema.extend({
  branchId: z.string().uuid().optional(),
  department: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional()
});

export const createAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  attendanceDate: z.string().datetime(),
  shift: z.enum(['DAY', 'NIGHT']),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  hoursWorked: z.coerce.number().min(0).optional(),
  notes: z.string().trim().optional()
});

export const listAttendanceQuerySchema = hrPaginationQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  shift: z.enum(['DAY', 'NIGHT']).optional()
});

export const createLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.string().trim().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  daysRequested: z.coerce.number().positive(),
  reason: z.string().trim().optional()
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'End date must be on or after start date',
  path: ['endDate']
});

export const listLeaveQuerySchema = hrPaginationQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional()
});

export const createPayrollSchema = z.object({
  employeeId: z.string().uuid(),
  payPeriodStart: z.string().datetime(),
  payPeriodEnd: z.string().datetime(),
  basicSalary: z.coerce.number().min(0),
  allowances: z.coerce.number().min(0).default(0),
  deductions: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional()
});

export const listPayrollQuerySchema = hrPaginationQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'APPROVED', 'PAID', 'CANCELLED']).optional()
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type ListLeaveQuery = z.infer<typeof listLeaveQuerySchema>;
export type CreatePayrollInput = z.infer<typeof createPayrollSchema>;
export type ListPayrollQuery = z.infer<typeof listPayrollQuerySchema>;
