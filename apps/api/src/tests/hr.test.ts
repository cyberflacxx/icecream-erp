import assert from 'node:assert/strict';
import test from 'node:test';

import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { createLeaveSchema } from '../modules/hr/hr.schemas';
import { HrService } from '../modules/hr/hr.service';

const context = {
  organizationId: 'org-1',
  userProfileId: 'user-1'
};

test('createPayroll calculates netPay server-side', async () => {
  const prismaAny = prisma as unknown as Record<string, unknown>;
  const originalPayrollRecord = prismaAny.payrollRecord;
  let capturedData: Record<string, unknown> | null = null;

  prismaAny.payrollRecord = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      capturedData = data;
      return {
        ...data,
        id: 'payroll-1'
      };
    }
  };

  try {
    await HrService.createPayroll(context, {
      employeeId: '8f1a2c32-eec1-47f2-bf6e-7d2271ac2f39',
      payPeriodStart: '2026-06-01T00:00:00.000Z',
      payPeriodEnd: '2026-06-30T00:00:00.000Z',
      basicSalary: 800,
      allowances: 100,
      deductions: 50,
      notes: 'June payroll'
    });

    assert.ok(capturedData);
    const created = capturedData as {
      netPay: Decimal;
      status: string;
      createdBy: string;
    };
    assert.equal(created.netPay.toNumber(), 850);
    assert.equal(created.status, 'DRAFT');
    assert.equal(created.createdBy, context.userProfileId);
  } finally {
    prismaAny.payrollRecord = originalPayrollRecord;
  }
});

test('createPayroll throws when netPay would be negative', async () => {
  await assert.rejects(
    () => HrService.createPayroll(context, {
      employeeId: '8f1a2c32-eec1-47f2-bf6e-7d2271ac2f39',
      payPeriodStart: '2026-06-01T00:00:00.000Z',
      payPeriodEnd: '2026-06-30T00:00:00.000Z',
      basicSalary: 200,
      allowances: 0,
      deductions: 300
    }),
    (error: Error & { code?: string }) => error.code === 'NEGATIVE_NET_PAY'
  );
});

test('leave request endDate before startDate fails schema validation', () => {
  const parsed = createLeaveSchema.safeParse({
    employeeId: '8f1a2c32-eec1-47f2-bf6e-7d2271ac2f39',
    leaveType: 'ANNUAL',
    startDate: '2026-06-10T00:00:00.000Z',
    endDate: '2026-06-09T00:00:00.000Z',
    daysRequested: 1
  });

  assert.equal(parsed.success, false);
});
