// @ts-nocheck
import {
  ApprovalLevel,
  ApprovalStatus,
  BranchShiftStatus,
  CustomerStatus,
  DeliveryNoteStatus,
  EmployeeStatus,
  InvoiceStatus,
  InventoryBatchStatus,
  ItemType,
  MaintenanceStatus,
  MaintenanceType,
  PaymentMethod,
  PayrollStatus,
  Prisma,
  PrismaClient,
  ProductionBatchStatus,
  ProductionPlanStatus,
  PurchaseOrderStatus,
  PurchaseRequisitionStatus,
  QualityStatus,
  QuotationStatus,
  ReturnStatus,
  SalesOrderStatus,
  ShiftType,
  StockMovementType,
  SupplierStatus,
  TransactionStatus,
  TransferStatus,
  UserStatus,
  WastageType,
  BudgetStatus,
  NotificationType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const qty = (v: number) => new Prisma.Decimal(v.toFixed(3));
const money = (v: number) => new Prisma.Decimal(v.toFixed(2));

const hashPassword = async (plain: string) => bcrypt.hash(plain, 12);

const today = new Date();
const dateOnly = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
const daysAgo = (n: number) => dateOnly(new Date(today.getTime() - n * 86400000));
const daysFromNow = (n: number) => dateOnly(new Date(today.getTime() + n * 86400000));

const firstNames = [
  'Tendai',
  'Chiedza',
  'Farai',
  'Blessing',
  'Rutendo',
  'Simbarashe',
  'Nyasha',
  'Tatenda',
  'Kudakwashe',
  'Munyaradzi',
  'Tsitsi',
  'Rudo',
  'Patience',
  'Cleophas',
  'Sheila',
  'Herbert',
  'Memory',
  'Josephine',
  'Prosper',
  'Gerald',
];

const lastNames = [
  'Moyo',
  'Mutasa',
  'Chikwanda',
  'Ncube',
  'Zimba',
  'Dube',
  'Chirwa',
  'Gumbo',
  'Sibanda',
  'Choto',
  'Banda',
  'Makoni',
  'Murambinda',
  'Nhamo',
  'Mupfumira',
  'Zvobgo',
  'Chirinda',
  'Madzinga',
  'Mataruse',
  'Macheso',
];

async function runSection(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`[OK] ${name}`);
  } catch (error) {
    console.error(`[FAILED] ${name}`);
    console.error(error);
    throw error;
  }
}

function randomIp(index: number): string {
  const a = 41 + (index % 7);
  const b = 60 + (index % 90);
  const c = 10 + (index % 200);
  const d = 20 + (index % 200);
  return `${a}.${b}.${c}.${d}`;
}

function buildWorkingDays(count: number): Date[] {
  const result: Date[] = [];
  let i = 1;
  while (result.length < count) {
    const d = daysAgo(i);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      result.push(d);
    }
    i += 1;
  }
  return result.reverse();
}

async function main(): Promise<void> {
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error('Base seed not found. Run prisma/seed.ts first.');
  }

  const roles = await prisma.role.findMany({ where: { organizationId: organization.id } });
  const roleByName = new Map(roles.map((r) => [r.name, r] as const));
  const branches = await prisma.branch.findMany({ where: { organizationId: organization.id } });
  const branchByName = new Map(branches.map((b) => [b.name, b] as const));
  const warehouses = await prisma.warehouse.findMany({ where: { organizationId: organization.id } });
  const warehouseByName = new Map(warehouses.map((w) => [w.name, w] as const));
  const units = await prisma.unitOfMeasure.findMany({ where: { organizationId: organization.id } });
  const unitByName = new Map(units.map((u) => [u.name, u] as const));
  const categories = await prisma.itemCategory.findMany({ where: { organizationId: organization.id } });
  const categoryByName = new Map(categories.map((c) => [c.name, c] as const));
  const items = await prisma.item.findMany({ where: { organizationId: organization.id } });
  const itemByName = new Map(items.map((i) => [i.name, i] as const));
  const accounts = await prisma.account.findMany({ where: { organizationId: organization.id } });
  const accountByCode = new Map(accounts.map((a) => [a.accountCode, a] as const));
  const workflows = await prisma.approvalWorkflow.findMany({ where: { organizationId: organization.id } });
  const workflowByEntity = new Map(workflows.map((w) => [w.entityType, w] as const));

  await runSection('Cleanup Testing Data', async () => {
    await prisma.$transaction([
      prisma.documentFile.deleteMany({ where: { organizationId: organization.id } }),
      prisma.auditLog.deleteMany({ where: { organizationId: organization.id } }),
      prisma.notification.deleteMany({ where: { organizationId: organization.id } }),
      prisma.approvalAction.deleteMany({}),
      prisma.approvalRequest.deleteMany({ where: { organizationId: organization.id } }),
      prisma.assetDepreciation.deleteMany({}),
      prisma.fixedAsset.deleteMany({ where: { organizationId: organization.id } }),
      prisma.budgetRevision.deleteMany({}),
      prisma.budgetLine.deleteMany({}),
      prisma.budget.deleteMany({ where: { organizationId: organization.id } }),
      prisma.bankReconciliation.deleteMany({ where: { organizationId: organization.id } }),
      prisma.pettyCashReplenishment.deleteMany({ where: { organizationId: organization.id } }),
      prisma.pettyCashRequest.deleteMany({ where: { organizationId: organization.id } }),
      prisma.journalEntryLine.deleteMany({}),
      prisma.journalEntry.deleteMany({ where: { organizationId: organization.id } }),
      prisma.payrollRecord.deleteMany({ where: { organizationId: organization.id } }),
      prisma.leaveRequest.deleteMany({ where: { organizationId: organization.id } }),
      prisma.attendance.deleteMany({ where: { organizationId: organization.id } }),
      prisma.branchShiftClose.deleteMany({ where: { organizationId: organization.id } }),
      prisma.branchExpense.deleteMany({ where: { organizationId: organization.id } }),
      prisma.branchSaleItem.deleteMany({}),
      prisma.branchSale.deleteMany({ where: { organizationId: organization.id } }),
      prisma.customerReturn.deleteMany({ where: { organizationId: organization.id } }),
      prisma.payment.deleteMany({ where: { organizationId: organization.id } }),
      prisma.invoiceItem.deleteMany({}),
      prisma.invoice.deleteMany({ where: { organizationId: organization.id } }),
      prisma.deliveryNoteItem.deleteMany({}),
      prisma.deliveryNote.deleteMany({ where: { organizationId: organization.id } }),
      prisma.salesOrderItem.deleteMany({}),
      prisma.salesOrder.deleteMany({ where: { organizationId: organization.id } }),
      prisma.quotationItem.deleteMany({}),
      prisma.quotation.deleteMany({ where: { organizationId: organization.id } }),
      prisma.customerComplaint.deleteMany({ where: { organizationId: organization.id } }),
      prisma.customer.deleteMany({ where: { organizationId: organization.id } }),
      prisma.machineBreakdown.deleteMany({ where: { organizationId: organization.id } }),
      prisma.maintenanceSchedule.deleteMany({ where: { organizationId: organization.id } }),
      prisma.shiftReport.deleteMany({ where: { organizationId: organization.id } }),
      prisma.qualityCheck.deleteMany({ where: { organizationId: organization.id } }),
      prisma.productionWastage.deleteMany({ where: { organizationId: organization.id } }),
      prisma.productionWorkerAssignment.deleteMany({}),
      prisma.productionBatchOutput.deleteMany({}),
      prisma.productionBatchMaterial.deleteMany({}),
      prisma.productionMaterialRequestItem.deleteMany({}),
      prisma.productionMaterialRequest.deleteMany({ where: { organizationId: organization.id } }),
      prisma.productionBatch.deleteMany({ where: { organizationId: organization.id } }),
      prisma.productionPlanItem.deleteMany({}),
      prisma.productionPlan.deleteMany({ where: { organizationId: organization.id } }),
      prisma.stockAdjustmentItem.deleteMany({}),
      prisma.stockAdjustment.deleteMany({ where: { organizationId: organization.id } }),
      prisma.stockTransferItem.deleteMany({}),
      prisma.stockTransfer.deleteMany({ where: { organizationId: organization.id } }),
      prisma.stockMovement.deleteMany({ where: { organizationId: organization.id } }),
      prisma.supplierReturnItem.deleteMany({}),
      prisma.supplierReturn.deleteMany({ where: { organizationId: organization.id } }),
      prisma.goodsReceivedNoteItem.deleteMany({}),
      prisma.goodsReceivedNote.deleteMany({ where: { organizationId: organization.id } }),
      prisma.purchaseOrderItem.deleteMany({}),
      prisma.purchaseOrder.deleteMany({ where: { organizationId: organization.id } }),
      prisma.supplierQuotationItem.deleteMany({}),
      prisma.supplierQuotation.deleteMany({}),
      prisma.rFQItem.deleteMany({}),
      prisma.rFQSupplier.deleteMany({}),
      prisma.requestForQuotation.deleteMany({ where: { organizationId: organization.id } }),
      prisma.purchaseRequisitionItem.deleteMany({}),
      prisma.purchaseRequisition.deleteMany({ where: { organizationId: organization.id } }),
      prisma.supplierPerformance.deleteMany({}),
      prisma.inventoryBatch.deleteMany({ where: { organizationId: organization.id } }),
      prisma.stockBalance.deleteMany({ where: { organizationId: organization.id } }),
      prisma.cashAccount.deleteMany({ where: { organizationId: organization.id } }),
      prisma.bankAccount.deleteMany({ where: { organizationId: organization.id } }),
      prisma.sparePart.deleteMany({ where: { organizationId: organization.id } }),
      prisma.supplier.deleteMany({ where: { organizationId: organization.id } }),
      prisma.userRole.deleteMany({}),
      prisma.userAccount.deleteMany({ where: { organizationId: organization.id, workId: { not: 'AQI-20260001' } } }),
      prisma.userProfile.deleteMany({ where: { organizationId: organization.id, email: { not: 'admin@absoluteicecream.co.zw' } } }),
      prisma.employee.deleteMany({ where: { organizationId: organization.id } }),
    ]);
  });

  await runSection('Users (20 Accounts)', async () => {
    const users = [
      ['AQI-20260001', 'System', 'Administrator', 'admin@absoluteicecream.co.zw', 'Super Admin', 'Harare CBD Branch'],
      ['AQI-20260002', 'Tendai', 'Moyo', 't.moyo@absoluteicecream.co.zw', 'Super Admin', 'Harare CBD Branch'],
      ['AQI-20260003', 'Chiedza', 'Mutasa', 'c.mutasa@absoluteicecream.co.zw', 'Procurement Officer', 'Harare CBD Branch'],
      ['AQI-20260004', 'Farai', 'Chikwanda', 'f.chikwanda@absoluteicecream.co.zw', 'Procurement Officer', 'Harare CBD Branch'],
      ['AQI-20260005', 'Blessing', 'Ncube', 'b.ncube@absoluteicecream.co.zw', 'Store Keeper', 'Harare CBD Branch'],
      ['AQI-20260006', 'Rutendo', 'Zimba', 'r.zimba@absoluteicecream.co.zw', 'Store Keeper', 'Masvingo Branch'],
      ['AQI-20260007', 'Simbarashe', 'Dube', 's.dube@absoluteicecream.co.zw', 'Production Manager', 'Harare CBD Branch'],
      ['AQI-20260008', 'Nyasha', 'Chirwa', 'n.chirwa@absoluteicecream.co.zw', 'Production Manager', 'Harare CBD Branch'],
      ['AQI-20260009', 'Tatenda', 'Gumbo', 't.gumbo@absoluteicecream.co.zw', 'Production Worker', 'Harare CBD Branch'],
      ['AQI-20260010', 'Kudakwashe', 'Sibanda', 'k.sibanda@absoluteicecream.co.zw', 'Production Worker', 'Harare CBD Branch'],
      ['AQI-20260011', 'Munyaradzi', 'Choto', 'm.choto@absoluteicecream.co.zw', 'Production Worker', 'Harare CBD Branch'],
      ['AQI-20260012', 'Tsitsi', 'Banda', 't.banda@absoluteicecream.co.zw', 'Sales Representative', 'Harare CBD Branch'],
      ['AQI-20260013', 'Rudo', 'Makoni', 'r.makoni@absoluteicecream.co.zw', 'Sales Representative', 'Mutare Branch'],
      ['AQI-20260014', 'Patience', 'Murambinda', 'p.murambinda@absoluteicecream.co.zw', 'Branch Manager', 'Harare CBD Branch'],
      ['AQI-20260015', 'Cleophas', 'Nhamo', 'c.nhamo@absoluteicecream.co.zw', 'Branch Manager', 'Masvingo Branch'],
      ['AQI-20260016', 'Sheila', 'Mupfumira', 's.mupfumira@absoluteicecream.co.zw', 'Branch Manager', 'Mutare Branch'],
      ['AQI-20260017', 'Herbert', 'Zvobgo', 'h.zvobgo@absoluteicecream.co.zw', 'Accountant', 'Harare CBD Branch'],
      ['AQI-20260018', 'Memory', 'Chirinda', 'm.chirinda@absoluteicecream.co.zw', 'Accountant', 'Harare CBD Branch'],
      ['AQI-20260019', 'Prosper', 'Mataruse', 'p.mataruse@absoluteicecream.co.zw', 'Auditor', 'Harare CBD Branch'],
      ['AQI-20260020', 'Josephine', 'Madzinga', 'j.madzinga@absoluteicecream.co.zw', 'Accountant', 'Harare CBD Branch'],
    ] as const;

    const roleLinks: Array<{ userProfileId: string; roleId: string }> = [];
    for (let i = 0; i < users.length; i += 1) {
      const [workId, firstName, lastName, email, roleName, branchName] = users[i];
      const role = roleByName.get(roleName);
      const branch = branchByName.get(branchName);
      if (!role) throw new Error(`Role not found: ${roleName}`);

      const profile = await prisma.userProfile.upsert({
        where: { organizationId_email: { organizationId: organization.id, email } },
        update: {
          firstName,
          lastName,
          email,
          phone: `+263-77${String(200000 + i).slice(-6)}`,
          branchId: branch?.id ?? null,
          status: UserStatus.ACTIVE,
          clerkUserId: `aqi-test-${workId.toLowerCase()}`,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          clerkUserId: `aqi-test-${workId.toLowerCase()}`,
          firstName,
          lastName,
          email,
          phone: `+263-77${String(200000 + i).slice(-6)}`,
          branchId: branch?.id ?? null,
          status: UserStatus.ACTIVE,
        },
      });

      const testPasswordHash = await hashPassword('Test@2026!');

      await prisma.userAccount.upsert({
        where: { workId },
        update: {
          firstName,
          lastName,
          idNumber: `63-${String(i + 1).padStart(6, '0')}-A${String(i + 1).padStart(2, '0')}`,
          email,
          passwordHash: testPasswordHash,
          roleId: role.id,
          userProfileId: profile.id,
          isActive: true,
          deletedAt: null,
        },
        create: {
          workId,
          firstName,
          lastName,
          idNumber: `63-${String(i + 1).padStart(6, '0')}-A${String(i + 1).padStart(2, '0')}`,
          email,
          passwordHash: testPasswordHash,
          roleId: role.id,
          organizationId: organization.id,
          userProfileId: profile.id,
          isActive: true,
        },
      });

      roleLinks.push({ userProfileId: profile.id, roleId: role.id });
    }

    await prisma.userRole.createMany({
      data: roleLinks.map((link) => ({
        ...link,
        assignedBy: roleLinks[0]?.userProfileId ?? null,
      })),
      skipDuplicates: true,
    });

    console.log('Users seeded: 20');
  });

  const userProfiles = await prisma.userProfile.findMany({ where: { organizationId: organization.id } });
  const userByEmail = new Map(userProfiles.map((u) => [u.email, u] as const));

  await runSection('Employees (20)', async () => {
    const employeeSeeds = [
      ['E001', 'Tendai', 'Moyo', 'Production', 'Manager', 'Harare CBD Branch', 1200, '2022-03-14'],
      ['E002', 'Chiedza', 'Mutasa', 'Procurement', 'Officer', 'Harare CBD Branch', 900, '2023-01-09'],
      ['E003', 'Farai', 'Chikwanda', 'Procurement', 'Officer', 'Harare CBD Branch', 880, '2023-05-10'],
      ['E004', 'Blessing', 'Ncube', 'Stores', 'Store Keeper', 'Harare CBD Branch', 760, '2023-02-20'],
      ['E005', 'Rutendo', 'Zimba', 'Stores', 'Store Keeper', 'Masvingo Branch', 740, '2024-01-18'],
      ['E006', 'Simbarashe', 'Dube', 'Production', 'Manager', 'Harare CBD Branch', 1150, '2022-11-04'],
      ['E007', 'Nyasha', 'Chirwa', 'Production', 'Manager', 'Harare CBD Branch', 1120, '2023-06-22'],
      ['E008', 'Tatenda', 'Gumbo', 'Production', 'Worker', 'Harare CBD Branch', 560, '2024-02-14'],
      ['E009', 'Kudakwashe', 'Sibanda', 'Production', 'Worker', 'Harare CBD Branch', 550, '2024-03-02'],
      ['E010', 'Munyaradzi', 'Choto', 'Production', 'Worker', 'Harare CBD Branch', 540, '2024-05-17'],
      ['E011', 'Tsitsi', 'Banda', 'Sales', 'Representative', 'Harare CBD Branch', 680, '2023-04-03'],
      ['E012', 'Rudo', 'Makoni', 'Sales', 'Representative', 'Mutare Branch', 670, '2024-01-29'],
      ['E013', 'Patience', 'Murambinda', 'Sales', 'Branch Manager', 'Harare CBD Branch', 980, '2022-08-08'],
      ['E014', 'Cleophas', 'Nhamo', 'Sales', 'Branch Manager', 'Masvingo Branch', 940, '2023-09-01'],
      ['E015', 'Sheila', 'Mupfumira', 'Sales', 'Branch Manager', 'Mutare Branch', 930, '2023-10-12'],
      ['E016', 'Herbert', 'Zvobgo', 'Finance', 'Accountant', 'Harare CBD Branch', 1020, '2022-07-15'],
      ['E017', 'Memory', 'Chirinda', 'Finance', 'Accountant', 'Harare CBD Branch', 1000, '2023-03-07'],
      ['E018', 'Josephine', 'Madzinga', 'Finance', 'Manager', 'Harare CBD Branch', 1180, '2022-05-23'],
      ['E019', 'Prosper', 'Mataruse', 'Finance', 'Auditor', 'Harare CBD Branch', 1100, '2023-12-05'],
      ['E020', 'Gerald', 'Macheso', 'Administration', 'Clerk', 'Harare CBD Branch', 450, '2025-01-13'],
    ] as const;

    const createdEmployees: Array<{ employeeNumber: string; id: string; firstName: string; lastName: string }> = [];

    for (const [employeeNumber, firstName, lastName, department, jobTitle, branchName, , hireDate] of employeeSeeds) {
      const branch = branchByName.get(branchName);
      const employee = await prisma.employee.upsert({
        where: { organizationId_employeeNumber: { organizationId: organization.id, employeeNumber } },
        update: {
          firstName,
          lastName,
          email: `${firstName.toLowerCase().charAt(0)}.${lastName.toLowerCase()}@absoluteicecream.co.zw`,
          phone: `+263-78${String(300000 + createdEmployees.length).slice(-6)}`,
          department,
          jobTitle,
          branchId: branch?.id ?? null,
          status: EmployeeStatus.ACTIVE,
          hireDate: new Date(`${hireDate}T00:00:00.000Z`),
        },
        create: {
          organizationId: organization.id,
          employeeNumber,
          firstName,
          lastName,
          email: `${firstName.toLowerCase().charAt(0)}.${lastName.toLowerCase()}@absoluteicecream.co.zw`,
          phone: `+263-78${String(300000 + createdEmployees.length).slice(-6)}`,
          department,
          jobTitle,
          branchId: branch?.id ?? null,
          status: EmployeeStatus.ACTIVE,
          hireDate: new Date(`${hireDate}T00:00:00.000Z`),
        },
      });
      createdEmployees.push({ employeeNumber, id: employee.id, firstName, lastName });
    }

    for (const employee of createdEmployees) {
      const user = userByEmail.get(`${employee.firstName.toLowerCase().charAt(0)}.${employee.lastName.toLowerCase()}@absoluteicecream.co.zw`);
      if (user) {
        await prisma.userProfile.update({
          where: { id: user.id },
          data: { employeeId: employee.id },
        });
      }
    }
    console.log('Employees seeded: 20');
  });

  const employees = await prisma.employee.findMany({ where: { organizationId: organization.id } });

  await runSection('Attendance (~400)', async () => {
    const workingDays = buildWorkingDays(20);
    const rows: Prisma.AttendanceCreateManyInput[] = [];

    for (let e = 0; e < employees.length; e += 1) {
      for (let d = 0; d < workingDays.length; d += 1) {
        const key = (e + d) % 20;
        let shift = ShiftType.DAY;
        let checkIn: Date | null = null;
        let checkOut: Date | null = null;
        let hoursWorked: Prisma.Decimal | null = null;
        let notes: string | null = null;

        if (key < 12) {
          shift = ShiftType.DAY;
          const inHour = 5;
          const inMin = 45 + ((e + d) % 15);
          checkIn = new Date(`${workingDays[d].toISOString().slice(0, 10)}T${String(inHour).padStart(2, '0')}:${String(inMin).padStart(2, '0')}:00.000Z`);
          const hrs = 7.5 + ((e + d) % 4) * 0.5;
          checkOut = new Date(checkIn.getTime() + hrs * 3600000);
          hoursWorked = new Prisma.Decimal(hrs.toFixed(2));
        } else if (key < 18) {
          shift = ShiftType.NIGHT;
          const inHour = 17;
          const inMin = 45 + ((e + d) % 15);
          checkIn = new Date(`${workingDays[d].toISOString().slice(0, 10)}T${String(inHour).padStart(2, '0')}:${String(inMin).padStart(2, '0')}:00.000Z`);
          const hrs = 7.5 + ((e + d + 1) % 4) * 0.5;
          checkOut = new Date(checkIn.getTime() + hrs * 3600000);
          hoursWorked = new Prisma.Decimal(hrs.toFixed(2));
        } else if (key === 18) {
          shift = ShiftType.DAY;
          notes = 'ABSENT';
        } else {
          shift = ShiftType.DAY;
          notes = 'ON_LEAVE';
        }

        rows.push({
          organizationId: organization.id,
          employeeId: employees[e].id,
          attendanceDate: workingDays[d],
          shift,
          checkIn,
          checkOut,
          hoursWorked,
          notes,
        });
      }
    }

    await prisma.attendance.createMany({ data: rows });
    console.log(`Attendance seeded: ${rows.length}`);
  });

  await runSection('Leave Requests (20)', async () => {
    const leaveTypes = ['Annual Leave', 'Sick Leave', 'Emergency Leave', 'Maternity Leave', 'Study Leave'];
    const statuses: Array<ApprovalStatus | LeaveStatus> = [];
    const distribution = ['PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'REJECTED', 'REJECTED', 'REJECTED', 'REJECTED', 'CANCELLED', 'CANCELLED', 'CANCELLED'] as const;
    void statuses;

    const approver = userByEmail.get('j.madzinga@absoluteicecream.co.zw') ?? userProfiles[0];

    for (let i = 0; i < 20; i += 1) {
      const employee = employees[i % employees.length];
      const leaveType = i === 16 ? 'Maternity Leave' : i === 17 ? 'Study Leave' : leaveTypes[i % 3];
      const status = distribution[i];
      const startDate = i < 12 ? daysAgo(90 - i * 2) : daysFromNow(5 + i);
      const endDate = new Date(startDate.getTime() + (2 + (i % 4)) * 86400000);
      await prisma.leaveRequest.create({
        data: {
          organizationId: organization.id,
          employeeId: employee.id,
          leaveType,
          startDate,
          endDate,
          daysRequested: new Prisma.Decimal((2 + (i % 4)).toFixed(2)),
          reason: `${leaveType} request`,
          status: status as any,
          approvedBy: status === 'APPROVED' ? approver?.id ?? null : null,
          approvedAt: status === 'APPROVED' ? daysAgo(2 + i) : null,
        },
      });
    }
    console.log('Leave requests seeded: 20');
  });

  await runSection('Suppliers (15)', async () => {
    const supplierCategoryNames = [
      'Dairy Suppliers',
      'Flavour Suppliers',
      'Packaging Suppliers',
      'Chemical Suppliers',
      'Equipment Suppliers',
    ];

    for (const name of supplierCategoryNames) {
      await prisma.supplierCategory.upsert({
        where: { organizationId_name: { organizationId: organization.id, name } },
        update: {},
        create: { organizationId: organization.id, name, description: `${name} category` },
      });
    }

    const categoriesNow = await prisma.supplierCategory.findMany({ where: { organizationId: organization.id } });
    const categoryNowByName = new Map(categoriesNow.map((c) => [c.name, c] as const));
    const createdBy = userByEmail.get('c.mutasa@absoluteicecream.co.zw') ?? userProfiles[0];

    const supplierSeeds = [
      ['SUP001', 'Dairibord Zimbabwe Limited', 'Dairy Suppliers', 'Mr. T. Chikosi', '+263 4 667 234', 'supplies@dairibord.co.zw', 'Harare, Zimbabwe', '30 days', 15000, SupplierStatus.ACTIVE],
      ['SUP002', 'National Foods Holdings', 'Dairy Suppliers', 'Mrs. F. Mawere', '+263 242 701201', 'procurement@natfoods.co.zw', 'Harare, Zimbabwe', '14 days', 20000, SupplierStatus.ACTIVE],
      ['SUP003', 'Bulawayo Packaging Industries', 'Packaging Suppliers', 'Mr. S. Ndlovu', '+263 292 731821', 'sales@bpi.co.zw', 'Bulawayo, Zimbabwe', '30 days', 8000, SupplierStatus.ACTIVE],
      ['SUP004', 'Flavour House Zimbabwe', 'Flavour Suppliers', 'Ms. R. Chinyama', '+263 242 744522', 'quotes@flavourhouse.co.zw', 'Harare, Zimbabwe', '21 days', 5000, SupplierStatus.ACTIVE],
      ['SUP005', 'Delta Beverages Ingredients', 'Dairy Suppliers', 'Mr. B. Mutswa', '+263 4 793021', 'ingredients@delta.co.zw', 'Harare, Zimbabwe', '30 days', 12000, SupplierStatus.ACTIVE],
      ['SUP006', 'Zimgold Packaging Ltd', 'Packaging Suppliers', 'Ms. N. Phiri', '+263 242 742100', 'orders@zimgoldpack.co.zw', 'Harare, Zimbabwe', '14 days', 6000, SupplierStatus.ACTIVE],
      ['SUP007', 'Chemplex Corporation', 'Chemical Suppliers', 'Mr. H. Chikowore', '+263 4 668910', 'industrial@chemplex.co.zw', 'Harare, Zimbabwe', '30 days', 4000, SupplierStatus.ACTIVE],
      ['SUP008', 'Olivine Industries', 'Dairy Suppliers', 'Mrs. P. Sithole', '+263 4 705201', 'supply@olivine.co.zw', 'Harare, Zimbabwe', '21 days', 10000, SupplierStatus.ACTIVE],
      ['SUP009', 'Probrands Zimbabwe', 'Flavour Suppliers', 'Mr. T. Murape', '+263 4 740122', 'sales@probrands.co.zw', 'Harare, Zimbabwe', '14 days', 3000, SupplierStatus.ACTIVE],
      ['SUP010', 'ZimPlast Packaging', 'Packaging Suppliers', 'Ms. C. Mutambirwa', '+263 4 796655', 'pricing@zimplast.co.zw', 'Harare, Zimbabwe', '30 days', 7500, SupplierStatus.ACTIVE],
      ['SUP011', 'Triangle Sugar Corporation', 'Dairy Suppliers', 'Mr. F. Mushore', '+263 39 263099', 'industry@trianglesugar.co.zw', 'Chiredzi, Zimbabwe', '30 days', 18000, SupplierStatus.ACTIVE],
      ['SUP012', 'Willowton Oil Zimbabwe', 'Dairy Suppliers', 'Mrs. T. Machinga', '+263 4 772313', 'trading@willowton.co.zw', 'Harare, Zimbabwe', '21 days', 9000, SupplierStatus.ACTIVE],
      ['SUP013', 'Zim Dairy Co-op', 'Dairy Suppliers', 'Mr. P. Mudzimu', '+263 66 210025', 'ops@zimdairycoop.co.zw', 'Gweru, Zimbabwe', '30 days', 4500, SupplierStatus.INACTIVE],
      ['SUP014', 'Fast Supply Solutions', 'Packaging Suppliers', 'Mr. K. Jena', '+263 4 773100', 'admin@fastsupply.co.zw', 'Harare, Zimbabwe', '7 days', 2500, SupplierStatus.BLACKLISTED],
      ['SUP015', 'New Era Packaging', 'Packaging Suppliers', 'Ms. L. Dongo', '+263 242 778431', 'contact@newerapack.co.zw', 'Harare, Zimbabwe', '30 days', 5000, SupplierStatus.ACTIVE],
    ] as const;

    for (const [code, name, catName, contactPerson, phone, email, address, terms, creditLimit, status] of supplierSeeds) {
      await prisma.supplier.upsert({
        where: { organizationId_code: { organizationId: organization.id, code } },
        update: {
          name,
          categoryId: categoryNowByName.get(catName)?.id ?? categoriesNow[0].id,
          contactPerson,
          phone,
          email,
          address,
          paymentTerms: terms,
          creditLimit: money(creditLimit),
          status,
          createdBy: createdBy?.id ?? null,
          deletedAt: null,
        },
        create: {
          organizationId: organization.id,
          code,
          name,
          categoryId: categoryNowByName.get(catName)?.id ?? categoriesNow[0].id,
          contactPerson,
          phone,
          email,
          address,
          paymentTerms: terms,
          creditLimit: money(creditLimit),
          currentBalance: money(0),
          status,
          createdBy: createdBy?.id ?? null,
        },
      });
    }
    console.log('Suppliers seeded: 15');
  });

  const suppliers = await prisma.supplier.findMany({ where: { organizationId: organization.id } });
  const supplierByCode = new Map(suppliers.map((s) => [s.code, s] as const));

  await runSection('Supplier Performance (10)', async () => {
    const evaluator = userByEmail.get('h.zvobgo@absoluteicecream.co.zw') ?? userProfiles[0];
    const topCodes = ['SUP001', 'SUP002', 'SUP003', 'SUP004', 'SUP011'];
    let created = 0;
    for (let i = 0; i < topCodes.length; i += 1) {
      const supplier = supplierByCode.get(topCodes[i]);
      if (!supplier) continue;
      for (let j = 0; j < 2; j += 1) {
        const base = 72 + i * 3 + j * 4;
        await prisma.supplierPerformance.create({
          data: {
            supplierId: supplier.id,
            evaluationDate: daysAgo(30 * (j + 1) + i * 6),
            onTimeDelivery: base,
            qualityScore: Math.min(98, base + 3),
            priceCompetitiveness: base - 2,
            communicationScore: base + 1,
            overallScore: base,
            notes: j === 0 ? 'Consistent monthly supply' : 'Improved lead times after review',
            evaluatedBy: evaluator?.id ?? randomUUID(),
          },
        });
        created += 1;
      }
    }
    console.log(`Supplier performance seeded: ${created}`);
  });

  await runSection('Purchase Requisitions (20)', async () => {
    const requestors = [
      userByEmail.get('c.mutasa@absoluteicecream.co.zw'),
      userByEmail.get('f.chikwanda@absoluteicecream.co.zw'),
      userByEmail.get('b.ncube@absoluteicecream.co.zw'),
      userByEmail.get('r.zimba@absoluteicecream.co.zw'),
      userByEmail.get('s.dube@absoluteicecream.co.zw'),
    ].filter(Boolean);
    const approver = userByEmail.get('j.madzinga@absoluteicecream.co.zw') ?? userProfiles[0];
    const statusPattern: PurchaseRequisitionStatus[] = [
      PurchaseRequisitionStatus.DRAFT,
      PurchaseRequisitionStatus.DRAFT,
      PurchaseRequisitionStatus.DRAFT,
      PurchaseRequisitionStatus.SUBMITTED,
      PurchaseRequisitionStatus.SUBMITTED,
      PurchaseRequisitionStatus.SUBMITTED,
      PurchaseRequisitionStatus.SUBMITTED,
      PurchaseRequisitionStatus.LEVEL1_APPROVED,
      PurchaseRequisitionStatus.LEVEL1_APPROVED,
      PurchaseRequisitionStatus.LEVEL1_APPROVED,
      PurchaseRequisitionStatus.LEVEL2_APPROVED,
      PurchaseRequisitionStatus.LEVEL2_APPROVED,
      PurchaseRequisitionStatus.LEVEL2_APPROVED,
      PurchaseRequisitionStatus.LEVEL3_APPROVED,
      PurchaseRequisitionStatus.LEVEL3_APPROVED,
      PurchaseRequisitionStatus.LEVEL3_APPROVED,
      PurchaseRequisitionStatus.REJECTED,
      PurchaseRequisitionStatus.REJECTED,
      PurchaseRequisitionStatus.CANCELLED,
      PurchaseRequisitionStatus.PO_CREATED,
    ];
    const lineItems = [
      'UHT Full Cream Milk',
      'Sugar (50kg bags)',
      'Vanilla Flavour',
      'Cone Shells',
      '2L Tub Containers',
      'Wrappers (cone)',
      'Chocolate Type A (Dark)',
      'Chocolate Type B (Milk)',
      'Chocolate Type C (White)',
      'Strawberry Flavour',
      'Stabilizer',
      'Emulsifier',
    ];

    for (let i = 0; i < 20; i += 1) {
      const status = statusPattern[i];
      const requestedBy = requestors[i % requestors.length];
      if (!requestedBy) continue;
      const pr = await prisma.purchaseRequisition.create({
        data: {
          organizationId: organization.id,
          requisitionNumber: `PR-${String(i + 1).padStart(4, '0')}`,
          requestedBy: requestedBy.id,
          department: i % 3 === 0 ? 'Production' : i % 3 === 1 ? 'Stores' : 'Procurement',
          requestDate: daysAgo(25 - i),
          neededByDate: daysFromNow(4 + (i % 12)),
          status,
          approvalStatus: status,
          approvedBy: [
            PurchaseRequisitionStatus.LEVEL1_APPROVED,
            PurchaseRequisitionStatus.LEVEL2_APPROVED,
            PurchaseRequisitionStatus.LEVEL3_APPROVED,
            PurchaseRequisitionStatus.PO_CREATED,
          ].includes(status)
            ? approver?.id ?? null
            : null,
          approvedAt: [
            PurchaseRequisitionStatus.LEVEL1_APPROVED,
            PurchaseRequisitionStatus.LEVEL2_APPROVED,
            PurchaseRequisitionStatus.LEVEL3_APPROVED,
            PurchaseRequisitionStatus.PO_CREATED,
          ].includes(status)
            ? daysAgo(15 - i)
            : null,
          remarks:
            status === PurchaseRequisitionStatus.REJECTED
              ? i === 16
                ? 'Rejected at level 2: budget exceeded'
                : 'Rejected at level 1: items available in stock'
              : status === PurchaseRequisitionStatus.CANCELLED
              ? 'Cancelled by requestor due to production plan changes'
              : `Requisition for ${(i % 2 === 0 && 'raw materials') || 'packaging materials'}`,
        },
      });

      const lines = 2 + (i % 4);
      for (let j = 0; j < lines; j += 1) {
        const itemName = lineItems[(i + j) % lineItems.length];
        const item = itemByName.get(itemName);
        if (!item) continue;
        const quantity = 40 + i * 4 + j * 10;
        await prisma.purchaseRequisitionItem.create({
          data: {
            requisitionId: pr.id,
            itemId: item.id,
            quantityRequested: qty(quantity),
            quantityApproved: [
              PurchaseRequisitionStatus.LEVEL1_APPROVED,
              PurchaseRequisitionStatus.LEVEL2_APPROVED,
              PurchaseRequisitionStatus.LEVEL3_APPROVED,
              PurchaseRequisitionStatus.PO_CREATED,
            ].includes(status)
              ? qty(quantity - (j % 2) * 5)
              : null,
            unitOfMeasureId: item.unitOfMeasureId,
            estimatedUnitCost: item.unitCost ?? money(1),
            remarks: `Requested for ${pr.department} usage`,
          },
        });
      }
    }
    console.log('Purchase requisitions seeded: 20');
  });

  const requisitions = await prisma.purchaseRequisition.findMany({ where: { organizationId: organization.id } });

  await runSection('RFQs (10) and RFQ Suppliers', async () => {
    const creator = userByEmail.get('c.mutasa@absoluteicecream.co.zw') ?? userProfiles[0];
    const rfqStatuses = ['DRAFT', 'DRAFT', 'SENT', 'SENT', 'SENT', 'RESPONSES_RECEIVED', 'RESPONSES_RECEIVED', 'RESPONSES_RECEIVED', 'CLOSED', 'CLOSED'];
    const rfqItems = [
      'UHT Full Cream Milk',
      'Cone Shells',
      'Vanilla Flavour',
      'Chocolate Type A (Dark)',
      'Sugar (50kg bags)',
      'Cone Shells',
      'Stabilizer',
      'Labels (2L Vanilla)',
      'Fresh Milk',
      '2L Tub Containers',
    ];
    const supplierCodes = ['SUP001', 'SUP002', 'SUP003', 'SUP004', 'SUP006', 'SUP007', 'SUP009', 'SUP010', 'SUP011', 'SUP012'];

    for (let i = 0; i < 10; i += 1) {
      const req = requisitions[i % requisitions.length];
      const rfq = await prisma.requestForQuotation.create({
        data: {
          organizationId: organization.id,
          rfqNumber: `RFQ-${String(i + 1).padStart(4, '0')}`,
          requisitionId: req?.id ?? null,
          issueDate: daysAgo(20 - i),
          closingDate: daysAgo(12 - i),
          status: rfqStatuses[i],
          notes: `${rfqStatuses[i]} RFQ for procurement cycle`,
          createdBy: creator?.id ?? userProfiles[0].id,
        },
      });

      const item = itemByName.get(rfqItems[i]) ?? items[i % items.length];
      if (item) {
        await prisma.rFQItem.create({
          data: {
            rfqId: rfq.id,
            itemId: item.id,
            quantityRequired: qty(250 + i * 20),
            unitOfMeasureId: item.unitOfMeasureId,
            specifications: `Commercial grade ${item.name}`,
          },
        });
      }

      const supplierCount = i < 2 ? 1 : i < 5 ? 3 : 2 + (i % 2);
      for (let s = 0; s < supplierCount; s += 1) {
        const supplier = supplierByCode.get(supplierCodes[(i + s) % supplierCodes.length]);
        if (!supplier) continue;
        await prisma.rFQSupplier.create({
          data: {
            rfqId: rfq.id,
            supplierId: supplier.id,
            sentAt: rfqStatuses[i] === 'DRAFT' ? null : daysAgo(19 - i),
            responseReceived: ['RESPONSES_RECEIVED', 'CLOSED'].includes(rfqStatuses[i]) ? true : s % 2 === 0,
            responseDate: ['RESPONSES_RECEIVED', 'CLOSED'].includes(rfqStatuses[i]) ? daysAgo(10 - i + s) : null,
            quotedAmount: ['RESPONSES_RECEIVED', 'CLOSED'].includes(rfqStatuses[i]) ? money(400 + i * 55 + s * 15) : null,
            notes: `Supplier response for ${rfq.rfqNumber}`,
          },
        });
      }
    }
    console.log('RFQs seeded: 10');
  });

  const rfqs = await prisma.requestForQuotation.findMany({ where: { organizationId: organization.id } });

  await runSection('Supplier Quotations (15)', async () => {
    const selector = userByEmail.get('c.mutasa@absoluteicecream.co.zw') ?? userProfiles[0];
    const quotationPlan = [
      ['RFQ-0006', ['SUP003', 'SUP010', 'SUP006']],
      ['RFQ-0007', ['SUP007', 'SUP004']],
      ['RFQ-0008', ['SUP003', 'SUP006', 'SUP010']],
      ['RFQ-0009', ['SUP001', 'SUP002']],
      ['RFQ-0003', ['SUP004', 'SUP009']],
      ['RFQ-0004', ['SUP004', 'SUP011', 'SUP012']],
    ] as const;

    let count = 0;
    for (const [rfqNumber, supplierCodesForRfq] of quotationPlan) {
      const rfq = rfqs.find((r) => r.rfqNumber === rfqNumber);
      if (!rfq) continue;
      for (let i = 0; i < supplierCodesForRfq.length; i += 1) {
        if (count >= 15) break;
        const supplier = supplierByCode.get(supplierCodesForRfq[i]);
        if (!supplier) continue;
        const basePrice = rfqNumber === 'RFQ-0006' ? [0.08, 0.075, 0.09][i] ?? 0.08 : 1.2 + i * 0.15;
        const quantity = 1000 + i * 250;
        const total = quantity * basePrice;
        const quotation = await prisma.supplierQuotation.create({
          data: {
            rfqId: rfq.id,
            supplierId: supplier.id,
            quotationDate: daysAgo(8 + i),
            validUntil: daysFromNow(12 + i),
            totalAmount: money(total),
            deliveryDays: 5 + i * 2,
            paymentTerms: '30 days',
            notes: `Quoted for ${rfq.rfqNumber}`,
            isSelected: (rfq.status === 'CLOSED' && i === 0) || (rfqNumber === 'RFQ-0006' && i === 1),
            selectedBy: (rfq.status === 'CLOSED' && i === 0) || (rfqNumber === 'RFQ-0006' && i === 1) ? selector?.id ?? null : null,
            selectedAt: (rfq.status === 'CLOSED' && i === 0) || (rfqNumber === 'RFQ-0006' && i === 1) ? daysAgo(3) : null,
          },
        });

        const rfqItem = await prisma.rFQItem.findFirst({ where: { rfqId: rfq.id } });
        await prisma.supplierQuotationItem.create({
          data: {
            quotationId: quotation.id,
            itemId: rfqItem?.itemId ?? items[i % items.length].id,
            quantity: qty(quantity),
            unitPrice: money(basePrice),
            totalPrice: money(total),
            deliveryDays: 5 + i * 2,
          },
        });
        count += 1;
      }
      if (count >= 15) break;
    }
    console.log(`Supplier quotations seeded: ${count}`);
  });

  await runSection('Purchase Orders (20) + Items', async () => {
    const creator = userByEmail.get('c.mutasa@absoluteicecream.co.zw') ?? userProfiles[0];
    const approver = userByEmail.get('j.madzinga@absoluteicecream.co.zw') ?? userProfiles[0];
    const statuses: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.AWAITING_APPROVAL,
      PurchaseOrderStatus.AWAITING_APPROVAL,
      PurchaseOrderStatus.AWAITING_APPROVAL,
      PurchaseOrderStatus.LEVEL1_APPROVED,
      PurchaseOrderStatus.LEVEL1_APPROVED,
      PurchaseOrderStatus.LEVEL1_APPROVED,
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.SENT_TO_SUPPLIER,
      PurchaseOrderStatus.SENT_TO_SUPPLIER,
      PurchaseOrderStatus.SENT_TO_SUPPLIER,
      PurchaseOrderStatus.SENT_TO_SUPPLIER,
      PurchaseOrderStatus.PARTIAL_RECEIVED,
      PurchaseOrderStatus.PARTIAL_RECEIVED,
      PurchaseOrderStatus.PARTIAL_RECEIVED,
      PurchaseOrderStatus.FULLY_RECEIVED,
      PurchaseOrderStatus.FULLY_RECEIVED,
      PurchaseOrderStatus.CANCELLED,
    ];

    const supplierList = ['SUP001', 'SUP011', 'SUP003', 'SUP004', 'SUP012', 'SUP001', 'SUP006', 'SUP003', 'SUP005', 'SUP002', 'SUP004', 'SUP010', 'SUP007', 'SUP001', 'SUP003', 'SUP004', 'SUP011', 'SUP001', 'SUP006', 'SUP014'];
    const itemPlan = [
      ['UHT Full Cream Milk', 'Cream'],
      ['Sugar (50kg bags)', 'Glucose Syrup'],
      ['Cone Shells', '2L Tub Containers'],
      ['Vanilla Flavour', 'Strawberry Flavour'],
      ['Food Colouring (Red)', 'Food Colouring (Brown)'],
    ];

    for (let i = 0; i < 20; i += 1) {
      const supplier = supplierByCode.get(supplierList[i]) ?? suppliers[i % suppliers.length];
      const requisition = requisitions[i % requisitions.length];
      if (!supplier) continue;

      let subtotal = 0;
      const po = await prisma.purchaseOrder.create({
        data: {
          organizationId: organization.id,
          poNumber: `PO-${String(i + 1).padStart(4, '0')}`,
          supplierId: supplier.id,
          requisitionId: requisition?.id ?? null,
          orderDate: daysAgo(18 - i),
          expectedDeliveryDate: daysFromNow(2 + (i % 8)),
          status: statuses[i],
          subtotal: money(0),
          taxAmount: money(0),
          discountAmount: money(0),
          total: money(0),
          notes: statuses[i] === PurchaseOrderStatus.CANCELLED ? 'Cancelled: supplier unable to deliver' : `PO ${statuses[i]}`,
          createdBy: creator?.id ?? null,
          approvedBy:
            [
              PurchaseOrderStatus.LEVEL1_APPROVED,
              PurchaseOrderStatus.APPROVED,
              PurchaseOrderStatus.SENT_TO_SUPPLIER,
              PurchaseOrderStatus.PARTIAL_RECEIVED,
              PurchaseOrderStatus.FULLY_RECEIVED,
            ].includes(statuses[i])
              ? approver?.id ?? null
              : null,
          approvedAt:
            [
              PurchaseOrderStatus.LEVEL1_APPROVED,
              PurchaseOrderStatus.APPROVED,
              PurchaseOrderStatus.SENT_TO_SUPPLIER,
              PurchaseOrderStatus.PARTIAL_RECEIVED,
              PurchaseOrderStatus.FULLY_RECEIVED,
            ].includes(statuses[i])
              ? daysAgo(10 - i)
              : null,
        },
      });

      const plan = itemPlan[i % itemPlan.length];
      for (let j = 0; j < 2 + (i % 3); j += 1) {
        const item = itemByName.get(plan[j % plan.length]) ?? items[(i + j) % items.length];
        const quantityOrdered = 100 + i * 8 + j * 20;
        const unitCost = Number(item?.unitCost ?? money(1));
        const lineTotal = quantityOrdered * unitCost;
        subtotal += lineTotal;
        await prisma.purchaseOrderItem.create({
          data: {
            purchaseOrderId: po.id,
            itemId: item!.id,
            quantityOrdered: qty(quantityOrdered),
            quantityReceived:
              statuses[i] === PurchaseOrderStatus.FULLY_RECEIVED
                ? qty(quantityOrdered)
                : statuses[i] === PurchaseOrderStatus.PARTIAL_RECEIVED
                ? qty(quantityOrdered * 0.6)
                : qty(0),
            unitCost: money(unitCost),
            totalCost: money(lineTotal),
            unitOfMeasureId: item!.unitOfMeasureId,
          },
        });
      }

      const tax = i % 3 === 0 ? subtotal * 0.15 : 0;
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          subtotal: money(subtotal),
          taxAmount: money(tax),
          total: money(subtotal + tax),
        },
      });
    }
    console.log('Purchase orders seeded: 20');
  });

  const purchaseOrders = await prisma.purchaseOrder.findMany({ where: { organizationId: organization.id } });
  const poByNumber = new Map(purchaseOrders.map((po) => [po.poNumber, po] as const));

  await runSection('GRNs (15) + Items', async () => {
    const receivingWarehouse = warehouseByName.get('Main Raw Materials Warehouse') ?? warehouses[0];
    const receiver = userByEmail.get('b.ncube@absoluteicecream.co.zw') ?? userProfiles[0];
    const statusPattern = [
      'DRAFT',
      'DRAFT',
      'RECEIVED',
      'RECEIVED',
      'QUALITY_INSPECTION',
      'QUALITY_INSPECTION',
      'QUALITY_PASSED',
      'QUALITY_PASSED',
      'QUALITY_PASSED',
      'QUALITY_PASSED',
      'QUALITY_FAILED',
      'QUALITY_FAILED',
      'POSTED',
      'POSTED',
      'POSTED',
    ] as const;
    const poNumbers = ['PO-0015', 'PO-0016', 'PO-0017', 'PO-0011', 'PO-0012', 'PO-0013', 'PO-0018', 'PO-0019', 'PO-0014', 'PO-0010', 'PO-0005', 'PO-0006', 'PO-0018', 'PO-0019', 'PO-0011'];

    for (let i = 0; i < 15; i += 1) {
      const po = poByNumber.get(poNumbers[i]) ?? purchaseOrders[i % purchaseOrders.length];
      if (!po || !receivingWarehouse) continue;

      const status = statusPattern[i];
      const grn = await prisma.goodsReceivedNote.create({
        data: {
          organizationId: organization.id,
          grnNumber: `GRN-${String(i + 1).padStart(4, '0')}`,
          purchaseOrderId: po.id,
          warehouseId: receivingWarehouse.id,
          receivedDate: daysAgo(9 - i),
          receivedBy: receiver?.id ?? userProfiles[0].id,
          status: status as any,
          qualityStatus:
            status === 'QUALITY_FAILED'
              ? QualityStatus.FAILED
              : status === 'QUALITY_PASSED' || status === 'POSTED'
              ? QualityStatus.PASSED
              : QualityStatus.PENDING,
          qualityNotes:
            status === 'QUALITY_FAILED'
              ? i === 10
                ? 'Chocolate batch failed specification test'
                : 'Label color mismatch'
              : status === 'QUALITY_INSPECTION'
              ? 'Pending lab verification'
              : 'Quality acceptable',
          notes: `GRN status ${status}`,
        },
      });

      const poItems = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
      for (let j = 0; j < poItems.length; j += 1) {
        const poItem = poItems[j];
        const received = status === 'DRAFT' ? Number(poItem.quantityOrdered) * 0.5 : Number(poItem.quantityOrdered);
        const rejected = status === 'QUALITY_FAILED' ? Math.max(1, received * 0.2) : j === 0 && i % 4 === 0 ? 2 : 0;
        await prisma.goodsReceivedNoteItem.create({
          data: {
            grnId: grn.id,
            itemId: poItem.itemId,
            poItemId: poItem.id,
            quantityExpected: poItem.quantityOrdered,
            quantityReceived: qty(received),
            quantityRejected: qty(rejected),
            unitCost: poItem.unitCost,
            batchNumber: `BT-${grn.grnNumber}-${String(j + 1).padStart(2, '0')}`,
            expiryDate: ['UHT Full Cream Milk', 'Fresh Milk', 'Cream', 'Vanilla Flavour', 'Strawberry Flavour'].includes(items.find((it) => it.id === poItem.itemId)?.name ?? '')
              ? daysFromNow(120 + i * 3)
              : null,
            qualityNotes: rejected > 0 ? 'Rejected damaged quantity' : 'Accepted',
          },
        });
      }
    }
    console.log('GRNs seeded: 15');
  });

  const grns = await prisma.goodsReceivedNote.findMany({ where: { organizationId: organization.id } });
  const grnByNumber = new Map(grns.map((g) => [g.grnNumber, g] as const));

  await runSection('Supplier Returns (10)', async () => {
    const creator = userByEmail.get('b.ncube@absoluteicecream.co.zw') ?? userProfiles[0];
    const statuses: ReturnStatus[] = [
      ReturnStatus.DRAFT,
      ReturnStatus.DRAFT,
      ReturnStatus.DRAFT,
      ReturnStatus.DRAFT,
      ReturnStatus.APPROVED,
      ReturnStatus.APPROVED,
      ReturnStatus.APPROVED,
      ReturnStatus.COMPLETED,
      ReturnStatus.COMPLETED,
      ReturnStatus.CANCELLED,
    ];
    for (let i = 0; i < 10; i += 1) {
      const grn = grns[i % grns.length];
      const po = await prisma.purchaseOrder.findUnique({ where: { id: grn.purchaseOrderId } });
      if (!po) continue;
      const supplierId = po.supplierId;
      const supplierReturn = await prisma.supplierReturn.create({
        data: {
          organizationId: organization.id,
          returnNumber: `SR-${String(i + 1).padStart(4, '0')}`,
          supplierId,
          grnId: grn.id,
          returnDate: daysAgo(7 - i),
          reason:
            i === 0
              ? 'Rejected chocolate batch'
              : i === 1
              ? 'Damaged packaging'
              : i === 9
              ? 'Rejected by supplier: return window elapsed'
              : 'Quality variance return',
          totalValue: money(180 + i * 45),
          status: statuses[i],
          createdBy: creator?.id ?? userProfiles[0].id,
        },
      });

      const gItems = await prisma.goodsReceivedNoteItem.findMany({ where: { grnId: grn.id } });
      const source = gItems[0];
      if (source) {
        const quantity = Math.max(1, Number(source.quantityRejected) || Number(source.quantityReceived) * 0.1);
        await prisma.supplierReturnItem.create({
          data: {
            returnId: supplierReturn.id,
            itemId: source.itemId,
            quantity: qty(quantity),
            unitCost: source.unitCost,
            totalCost: money(quantity * Number(source.unitCost)),
            reason: supplierReturn.reason,
          },
        });
      }
    }
    console.log('Supplier returns seeded: 10');
  });

  await runSection('Stock Balances + Inventory Batches', async () => {
    const rawWarehouse = warehouseByName.get('Main Raw Materials Warehouse');
    const coldRoom = warehouseByName.get('Finished Goods Cold Room');
    const harareWh = warehouseByName.get('Harare Branch Warehouse');
    const masWh = warehouseByName.get('Masvingo Branch Warehouse');
    const mutWh = warehouseByName.get('Mutare Branch Warehouse');
    const allWarehouses = [rawWarehouse, coldRoom, harareWh, masWh, mutWh].filter(Boolean) as typeof warehouses;
    const openingByName: Record<string, number> = {
      'UHT Full Cream Milk': 850,
      'Fresh Milk': 200,
      'Milk Powder': 150,
      Cream: 95,
      'Sugar (50kg bags)': 38,
      'Glucose Syrup': 80,
      'Vanilla Flavour': 25,
      'Strawberry Flavour': 18,
      'Chocolate Type A (Dark)': 75,
      'Chocolate Type B (Milk)': 60,
      'Chocolate Type C (White)': 45,
      Stabilizer: 40,
      Emulsifier: 22,
      'Food Colouring (Red)': 5,
      'Food Colouring (Brown)': 4,
      'Ice Cream Mix (base)': 200,
      'Cone Shells': 8500,
      '2L Tub Containers': 2200,
      '5L Tub Containers': 850,
      '2L Lids': 2400,
      '5L Lids': 900,
      'Wrappers (cone)': 9000,
      'Carton Boxes (2L x12)': 180,
      'Carton Boxes (5L x6)': 140,
      'Labels (2L Vanilla)': 2500,
      'Labels (2L Chocolate)': 2000,
      'Labels (2L Strawberry)': 1800,
      'Labels (5L Vanilla)': 900,
      'Labels (5L Chocolate)': 750,
      'Vanilla Cone': 3200,
      'Chocolate Cone': 2800,
      'Strawberry Cone': 2100,
      'Vanilla 2L Tub': 480,
      'Chocolate 2L Tub': 420,
      'Strawberry 2L Tub': 380,
      'Vanilla 5L Tub': 120,
      'Chocolate 5L Tub': 95,
      'Bulk Vanilla (20L)': 35,
      'Mixed Cone Pack (x12)': 210,
    };

    for (const item of items) {
      for (let w = 0; w < allWarehouses.length; w += 1) {
        const wh = allWarehouses[w];
        let q = 0;
        if (wh.name === 'Main Raw Materials Warehouse' && item.itemType !== ItemType.FINISHED_GOOD) q = openingByName[item.name] ?? 0;
        if (wh.name === 'Finished Goods Cold Room' && item.itemType === ItemType.FINISHED_GOOD) q = openingByName[item.name] ?? 0;
        if (wh.name === 'Harare Branch Warehouse' && item.itemType === ItemType.FINISHED_GOOD) q = Math.max(0, Math.round((openingByName[item.name] ?? 0) * 0.14));
        if (wh.name === 'Masvingo Branch Warehouse' && item.itemType === ItemType.FINISHED_GOOD) q = Math.max(0, Math.round((openingByName[item.name] ?? 0) * 0.09));
        if (wh.name === 'Mutare Branch Warehouse' && item.itemType === ItemType.FINISHED_GOOD) q = Math.max(0, Math.round((openingByName[item.name] ?? 0) * 0.07));

        await prisma.stockBalance.create({
          data: {
            organizationId: organization.id,
            itemId: item.id,
            warehouseId: wh.id,
            quantityOnHand: qty(q),
            quantityReserved: qty(0),
            quantityAvailable: qty(q),
          },
        });

        if (q > 0) {
          await prisma.inventoryBatch.create({
            data: {
              organizationId: organization.id,
              itemId: item.id,
              warehouseId: wh.id,
              batchNumber: `BATCH-${wh.code}-${item.code}`.slice(0, 60),
              quantityReceived: qty(q),
              quantityRemaining: qty(q),
              unitCost: item.unitCost ?? money(1),
              status: InventoryBatchStatus.ACTIVE,
              manufacturedDate: daysAgo(60),
              expiryDate: item.trackExpiry ? daysFromNow(180) : null,
              supplierId: suppliers.find((s) => s.status === SupplierStatus.ACTIVE)?.id ?? null,
            },
          });
        }
      }
    }
    console.log(`Stock balances seeded: ${items.length * 5}`);
  });

  await runSection('Stock Movements / Transfers / Adjustments', async () => {
    const creator = userByEmail.get('b.ncube@absoluteicecream.co.zw') ?? userProfiles[0];
    const balances = await prisma.stockBalance.findMany({ where: { organizationId: organization.id } });

    const movementRows: Prisma.StockMovementCreateManyInput[] = [];
    let movementCount = 0;
    for (let i = 0; i < Math.min(120, balances.length); i += 1) {
      const balance = balances[i];
      const unitCost = Number(items.find((it) => it.id === balance.itemId)?.unitCost ?? 1);
      const qtyMoved = 1 + (i % 12);
      movementRows.push({
        organizationId: organization.id,
        itemId: balance.itemId,
        warehouseId: balance.warehouseId,
        movementType:
          i % 5 === 0
            ? StockMovementType.PURCHASE_RECEIVE
            : i % 5 === 1
            ? StockMovementType.PRODUCTION_ISSUE
            : i % 5 === 2
            ? StockMovementType.SALES_ISSUE
            : i % 5 === 3
            ? StockMovementType.TRANSFER_OUT
            : StockMovementType.ADJUSTMENT_IN,
        quantity: qty(qtyMoved),
        unitCost: money(unitCost),
        totalCost: money(qtyMoved * unitCost),
        referenceType: i % 2 === 0 ? 'seed-testing' : 'historical',
        referenceId: `SM-${String(i + 1).padStart(5, '0')}`,
        notes: 'Testing stock movement',
        createdBy: creator?.id ?? null,
        createdAt: daysAgo(14 - (i % 10)),
      });
      movementCount += 1;
    }
    await prisma.stockMovement.createMany({ data: movementRows });

    const transferStatuses = [TransferStatus.DRAFT, TransferStatus.IN_TRANSIT, TransferStatus.COMPLETED, TransferStatus.CANCELLED];
    const branchWarehouses = warehouses.filter((w) => w.type !== 'MAIN');
    const mainWh = warehouseByName.get('Main Raw Materials Warehouse') ?? warehouses[0];
    const transferCount = 10;
    for (let i = 0; i < transferCount; i += 1) {
      const toWh = branchWarehouses[i % branchWarehouses.length];
      const transfer = await prisma.stockTransfer.create({
        data: {
          organizationId: organization.id,
          transferNumber: `TRF-${String(i + 1).padStart(4, '0')}`,
          fromWarehouseId: mainWh.id,
          toWarehouseId: toWh.id,
          transferDate: daysAgo(12 - i),
          status: transferStatuses[i % transferStatuses.length],
          notes: 'Inter-warehouse stock transfer',
          requestedBy: creator?.id ?? null,
          approvedBy: i % 2 === 0 ? (userByEmail.get('j.madzinga@absoluteicecream.co.zw')?.id ?? null) : null,
        },
      });
      for (let j = 0; j < 2; j += 1) {
        const item = items[(i + j) % items.length];
        const requested = 20 + i * 2 + j * 5;
        await prisma.stockTransferItem.create({
          data: {
            transferId: transfer.id,
            itemId: item.id,
            quantityRequested: qty(requested),
            quantitySent: transfer.status !== TransferStatus.DRAFT ? qty(requested) : null,
            quantityReceived: transfer.status === TransferStatus.COMPLETED ? qty(requested - 1) : null,
            unitCost: item.unitCost ?? money(1),
          },
        });
      }
    }

    const adjuster = userByEmail.get('b.ncube@absoluteicecream.co.zw') ?? userProfiles[0];
    const approver = userByEmail.get('j.madzinga@absoluteicecream.co.zw') ?? userProfiles[0];
    for (let i = 0; i < 10; i += 1) {
      const wh = warehouses[i % warehouses.length];
      const status = [TransactionStatus.DRAFT, TransactionStatus.APPROVED, TransactionStatus.POSTED, TransactionStatus.VOIDED][i % 4];
      const adjustment = await prisma.stockAdjustment.create({
        data: {
          organizationId: organization.id,
          adjustmentNumber: `ADJ-${String(i + 1).padStart(4, '0')}`,
          warehouseId: wh.id,
          adjustmentDate: daysAgo(9 - i),
          reason: i % 2 === 0 ? 'Cycle count variance' : 'Damaged stock write-off',
          status,
          createdBy: adjuster?.id ?? userProfiles[0].id,
          approvedBy: [TransactionStatus.APPROVED, TransactionStatus.POSTED].includes(status) ? approver?.id ?? null : null,
          notes: `Adjustment status ${status}`,
        },
      });
      const item = items[i % items.length];
      const before = 100 + i * 3;
      const delta = i % 2 === 0 ? 5 : -4;
      await prisma.stockAdjustmentItem.create({
        data: {
          adjustmentId: adjustment.id,
          itemId: item.id,
          quantityBefore: qty(before),
          quantityAdjusted: qty(delta),
          quantityAfter: qty(before + delta),
          unitCost: item.unitCost ?? money(1),
          movementType: delta >= 0 ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT,
          reason: adjustment.reason,
        },
      });
    }

    console.log(`Stock movements seeded: ${movementCount}`);
    console.log('Stock transfers seeded: 10');
    console.log('Stock adjustments seeded: 10');
  });

  await runSection('Production + Maintenance', async () => {
    const recipes = await prisma.recipe.findMany({ where: { organizationId: organization.id } });
    const productionManager = userByEmail.get('s.dube@absoluteicecream.co.zw') ?? userProfiles[0];
    const workers = employees.filter((e) => e.department === 'Production');
    const rawWh = warehouseByName.get('Main Raw Materials Warehouse') ?? warehouses[0];

    for (let i = 0; i < 10; i += 1) {
      const plan = await prisma.productionPlan.create({
        data: {
          organizationId: organization.id,
          planNumber: `PPLAN-${String(i + 1).padStart(4, '0')}`,
          planDate: daysAgo(10 - i),
          shift: i % 2 === 0 ? ShiftType.DAY : ShiftType.NIGHT,
          productionLine: i % 2 === 0 ? 'Line 1' : 'Line 2',
          status: [ProductionPlanStatus.DRAFT, ProductionPlanStatus.APPROVED, ProductionPlanStatus.IN_PROGRESS, ProductionPlanStatus.COMPLETED][i % 4],
          createdBy: productionManager?.id ?? null,
        },
      });
      const recipe = recipes[i % recipes.length];
      await prisma.productionPlanItem.create({
        data: {
          productionPlanId: plan.id,
          recipeId: recipe.id,
          plannedQuantity: qty(500 + i * 50),
          expectedOutput: qty(480 + i * 48),
          notes: 'Planned production quantity',
        },
      });
    }
    console.log('Production plans seeded: 10');

    const plans = await prisma.productionPlan.findMany({ where: { organizationId: organization.id } });
    for (let i = 0; i < 20; i += 1) {
      const plan = plans[i % plans.length];
      const recipe = recipes[i % recipes.length];
      const batch = await prisma.productionBatch.create({
        data: {
          organizationId: organization.id,
          batchNumber: `BATCH-${String(i + 1).padStart(4, '0')}`,
          productionPlanId: plan.id,
          recipeId: recipe.id,
          productionDate: daysAgo(9 - i),
          shift: i % 2 === 0 ? ShiftType.DAY : ShiftType.NIGHT,
          productionLine: i % 2 === 0 ? 'Line 1' : 'Line 2',
          warehouseId: rawWh.id,
          plannedQuantity: qty(450 + i * 20),
          expectedOutput: qty(430 + i * 18),
          actualOutput: i > 5 ? qty(420 + i * 17) : null,
          wastageQuantity: i % 4 === 0 ? qty(4 + i * 0.2) : qty(0),
          wastagePercentage: i % 4 === 0 ? new Prisma.Decimal('1.20') : new Prisma.Decimal('0.00'),
          efficiencyPercentage: i > 5 ? new Prisma.Decimal('96.20') : null,
          status: [
            ProductionBatchStatus.DRAFT,
            ProductionBatchStatus.PLANNED,
            ProductionBatchStatus.MATERIALS_REQUESTED,
            ProductionBatchStatus.MATERIALS_APPROVED,
            ProductionBatchStatus.MATERIALS_RESERVED,
            ProductionBatchStatus.IN_PROGRESS,
            ProductionBatchStatus.WIP,
            ProductionBatchStatus.QUALITY_CHECK,
            ProductionBatchStatus.COMPLETED,
            ProductionBatchStatus.CANCELLED,
          ][i % 10],
          qualityStatus: i % 7 === 0 ? QualityStatus.FAILED : i % 3 === 0 ? QualityStatus.PASSED : QualityStatus.PENDING,
          wastageReason: i % 4 === 0 ? 'Line startup wastage' : null,
          qualityNotes: i % 7 === 0 ? 'Viscosity outside tolerance' : 'Within acceptable range',
          startedBy: productionManager?.id ?? null,
          closedBy: i > 8 ? (userByEmail.get('n.chirwa@absoluteicecream.co.zw')?.id ?? productionManager?.id ?? null) : null,
          startTime: new Date(`${daysAgo(9 - i).toISOString().slice(0, 10)}T06:00:00.000Z`),
          endTime: i > 8 ? new Date(`${daysAgo(9 - i).toISOString().slice(0, 10)}T15:00:00.000Z`) : null,
        },
      });

      const recipeItems = await prisma.recipeItem.findMany({ where: { recipeId: recipe.id } });
      for (let r = 0; r < Math.min(4, recipeItems.length); r += 1) {
        const line = recipeItems[r];
        const req = Number(line.quantityRequired) * (1 + i * 0.02);
        await prisma.productionBatchMaterial.create({
          data: {
            batchId: batch.id,
            itemId: line.itemId,
            quantityRequired: qty(req),
            quantityIssued: i > 3 ? qty(req * 0.98) : null,
            quantityActual: i > 7 ? qty(req * 0.97) : null,
            variance: i > 7 ? qty(-req * 0.01) : null,
            unitId: line.unitId,
          },
        });
      }

      await prisma.productionBatchOutput.create({
        data: {
          batchId: batch.id,
          itemId: recipe.finishedItemId,
          expectedQuantity: batch.expectedOutput,
          actualQuantity: batch.actualOutput,
          wastageQuantity: batch.wastageQuantity,
          unitId: recipe.outputUnitId,
        },
      });

      const assignees = workers.slice(0, 3);
      for (let w = 0; w < assignees.length; w += 1) {
        await prisma.productionWorkerAssignment.create({
          data: {
            batchId: batch.id,
            employeeId: assignees[w].id,
            shift: batch.shift,
            roleInProduction: w === 0 ? 'Mixer Operator' : w === 1 ? 'Filler Operator' : 'Packhouse Operator',
            startTime: batch.startTime,
            endTime: batch.endTime,
          },
        });
      }

      if (i % 4 === 0) {
        const mat = recipeItems[0];
        await prisma.productionWastage.create({
          data: {
            organizationId: organization.id,
            productionBatchId: batch.id,
            itemId: mat.itemId,
            wastageType: WastageType.MATERIAL_WASTAGE,
            quantity: qty(2 + i * 0.2),
            unitCost: money(1.2 + i * 0.05),
            totalCost: money((2 + i * 0.2) * (1.2 + i * 0.05)),
            reason: 'Spillage during transfer',
            reportedBy: productionManager?.id ?? userProfiles[0].id,
          },
        });
      }
    }
    console.log('Production batches seeded: 20');

    const batches = await prisma.productionBatch.findMany({ where: { organizationId: organization.id } });
    for (let i = 0; i < 12; i += 1) {
      const batch = batches[i % batches.length];
      const pmr = await prisma.productionMaterialRequest.create({
        data: {
          organizationId: organization.id,
          requestNumber: `PMR-${String(i + 1).padStart(4, '0')}`,
          productionBatchId: batch.id,
          requestDate: daysAgo(8 - i),
          status: [ApprovalStatus.PENDING, ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.ESCALATED][i % 4],
          requestedBy: productionManager?.id ?? userProfiles[0].id,
          approvedBy: i % 4 === 1 ? (userByEmail.get('b.ncube@absoluteicecream.co.zw')?.id ?? null) : null,
          approvedAt: i % 4 === 1 ? daysAgo(5 - i) : null,
          notes: 'Production material request for batch',
        },
      });
      const materialLines = await prisma.productionBatchMaterial.findMany({ where: { batchId: batch.id }, take: 2 });
      for (const line of materialLines) {
        await prisma.productionMaterialRequestItem.create({
          data: {
            productionMaterialRequestId: pmr.id,
            itemId: line.itemId,
            quantityRequested: line.quantityRequired,
            quantityApproved: i % 4 === 1 ? line.quantityRequired : null,
            quantityIssued: i % 4 === 1 ? line.quantityIssued : null,
            unitOfMeasureId: line.unitId,
          },
        });
      }
    }
    console.log('Production material requests seeded: 12');

    for (let i = 0; i < 20; i += 1) {
      const batch = batches[i % batches.length];
      await prisma.qualityCheck.create({
        data: {
          organizationId: organization.id,
          referenceType: 'production_batch',
          referenceId: batch.id,
          checkedBy: userByEmail.get('n.chirwa@absoluteicecream.co.zw')?.id ?? null,
          checkDate: daysAgo(6 - (i % 6)),
          status: i % 6 === 0 ? QualityStatus.FAILED : i % 2 === 0 ? QualityStatus.PASSED : QualityStatus.PENDING,
          notes: i % 6 === 0 ? 'Texture failed standard' : 'Within quality parameters',
          passedQuantity: qty(120 + i * 5),
          failedQuantity: i % 6 === 0 ? qty(10 + i) : qty(0),
        },
      });
    }
    console.log('Quality checks seeded: 20');

    for (let i = 0; i < 15; i += 1) {
      const batch = batches[i % batches.length];
      await prisma.shiftReport.create({
        data: {
          organizationId: organization.id,
          productionBatchId: batch.id,
          branchId: i % 3 === 0 ? (branchByName.get('Harare CBD Branch')?.id ?? null) : null,
          reportDate: daysAgo(5 - (i % 5)),
          shiftType: i % 2 === 0 ? ShiftType.DAY : ShiftType.NIGHT,
          status: [BranchShiftStatus.OPEN, BranchShiftStatus.SUBMITTED, BranchShiftStatus.REVIEWED, BranchShiftStatus.APPROVED, BranchShiftStatus.REJECTED][i % 5],
          preparedBy: productionManager?.id ?? userProfiles[0].id,
          approvedBy: i % 5 >= 2 ? (userByEmail.get('h.zvobgo@absoluteicecream.co.zw')?.id ?? null) : null,
          notes: 'Shift performance summary',
        },
      });
    }
    console.log('Shift reports seeded: 15');

    const machines = await prisma.machine.findMany({ where: { organizationId: organization.id } });
    for (let i = 0; i < 12; i += 1) {
      const machine = machines[i % machines.length];
      await prisma.maintenanceSchedule.create({
        data: {
          organizationId: organization.id,
          machineId: machine.id,
          maintenanceType: [MaintenanceType.PREVENTIVE, MaintenanceType.CORRECTIVE, MaintenanceType.INSPECTION][i % 3],
          status: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.COMPLETED, MaintenanceStatus.OVERDUE][i % 4],
          scheduledDate: daysAgo(15 - i),
          completedDate: i % 4 === 2 ? daysAgo(12 - i) : null,
          performedBy: userByEmail.get('r.zimba@absoluteicecream.co.zw')?.id ?? null,
          cost: money(35 + i * 8),
          notes: 'Routine machine maintenance',
        },
      });
    }
    for (let i = 0; i < 6; i += 1) {
      const machine = machines[i % machines.length];
      await prisma.machineBreakdown.create({
        data: {
          organizationId: organization.id,
          machineId: machine.id,
          breakdownDate: daysAgo(9 - i),
          description: `${machine.name} stoppage due to compressor issue`,
          severity: i % 2 === 0 ? 'HIGH' : 'MEDIUM',
          status: i % 3 === 0 ? MaintenanceStatus.IN_PROGRESS : i % 3 === 1 ? MaintenanceStatus.COMPLETED : MaintenanceStatus.SCHEDULED,
          reportedBy: userByEmail.get('s.dube@absoluteicecream.co.zw')?.id ?? userProfiles[0].id,
          resolvedAt: i % 3 === 1 ? daysAgo(7 - i) : null,
          downtimeHours: new Prisma.Decimal((2 + i * 0.5).toFixed(2)),
          repairCost: money(90 + i * 25),
        },
      });
    }
    console.log('Maintenance schedules seeded: 12');
    console.log('Machine breakdowns seeded: 6');
  });

  await runSection('Customers / Quotations / Orders / Delivery / Invoices / Payments', async () => {
    const salesRep = userByEmail.get('t.banda@absoluteicecream.co.zw') ?? userProfiles[0];
    const customerSeeds = [
      'Choppies Zimbabwe',
      'OK Zimbabwe',
      'TM Pick n Pay',
      'Spar Zimbabwe',
      'Bon Marche',
      'N Richards Group',
      'Gain Cash & Carry',
      'Metro Peech & Browne',
      'Mutare Wholesale Hub',
      'Masvingo Family Mart',
      'Bikita Retailers',
      'Kwekwe Supermart',
      'Gweru Fresh Foods',
      'Chegutu Mini Market',
      'Bindura Foodworld',
      'Rusape Bazaar',
      'Kadoma Grocers',
      'Hwange Hyper',
      'Karoi Trade Centre',
      'Chiredzi Foodline',
    ];

    for (let i = 0; i < customerSeeds.length; i += 1) {
      await prisma.customer.create({
        data: {
          organizationId: organization.id,
          code: `CUST-${String(i + 1).padStart(4, '0')}`,
          name: customerSeeds[i],
          customerType: i < 14 ? 'WHOLESALE' : 'RETAIL',
          phone: `+263-7${String(70000000 + i).slice(-8)}`,
          email: `accounts${i + 1}@${customerSeeds[i].toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.zw`,
          address: i % 2 === 0 ? 'Harare, Zimbabwe' : 'Regional Branch, Zimbabwe',
          creditLimit: money(1500 + i * 350),
          currentBalance: money(i % 5 === 0 ? 450 : 0),
          paymentTerms: i % 2 === 0 ? '30 days' : '14 days',
          status: i === 18 ? CustomerStatus.BLACKLISTED : CustomerStatus.ACTIVE,
          createdBy: salesRep?.id ?? null,
        },
      });
    }
    console.log('Customers seeded: 20');

    const customers = await prisma.customer.findMany({ where: { organizationId: organization.id } });
    const fgWarehouse = warehouseByName.get('Finished Goods Cold Room') ?? warehouses[0];
    const branchHarare = branchByName.get('Harare CBD Branch');
    const finishedItems = items.filter((i) => i.itemType === ItemType.FINISHED_GOOD);

    const quotationStatuses: QuotationStatus[] = [
      QuotationStatus.DRAFT,
      QuotationStatus.DRAFT,
      QuotationStatus.SENT,
      QuotationStatus.SENT,
      QuotationStatus.SENT,
      QuotationStatus.ACCEPTED,
      QuotationStatus.ACCEPTED,
      QuotationStatus.ACCEPTED,
      QuotationStatus.REJECTED,
      QuotationStatus.REJECTED,
      QuotationStatus.EXPIRED,
      QuotationStatus.EXPIRED,
      QuotationStatus.CANCELLED,
      QuotationStatus.CANCELLED,
      QuotationStatus.ACCEPTED,
      QuotationStatus.ACCEPTED,
      QuotationStatus.SENT,
      QuotationStatus.SENT,
      QuotationStatus.DRAFT,
      QuotationStatus.ACCEPTED,
    ];

    for (let i = 0; i < 20; i += 1) {
      const customer = customers[i % customers.length];
      const quote = await prisma.quotation.create({
        data: {
          organizationId: organization.id,
          quotationNumber: `QT-${String(i + 1).padStart(4, '0')}`,
          customerId: customer.id,
          quotationDate: daysAgo(20 - i),
          validUntil: daysFromNow(10 + i),
          status: quotationStatuses[i],
          subtotal: money(0),
          taxAmount: money(0),
          discountAmount: money(0),
          total: money(0),
          notes: 'Customer quotation',
          createdBy: salesRep?.id ?? null,
        },
      });
      let subtotal = 0;
      for (let j = 0; j < 2 + (i % 3); j += 1) {
        const item = finishedItems[(i + j) % finishedItems.length];
        const quantity = 40 + i * 5 + j * 8;
        const unitPrice = Number(item.sellingPrice ?? money(1.5));
        const totalPrice = quantity * unitPrice;
        subtotal += totalPrice;
        await prisma.quotationItem.create({
          data: {
            quotationId: quote.id,
            itemId: item.id,
            quantity: qty(quantity),
            unitPrice: money(unitPrice),
            discountPercent: new Prisma.Decimal((j % 2 === 0 ? 0 : 2.5).toFixed(2)),
            totalPrice: money(totalPrice),
          },
        });
      }
      const tax = i % 4 === 0 ? subtotal * 0.15 : 0;
      await prisma.quotation.update({ where: { id: quote.id }, data: { subtotal: money(subtotal), taxAmount: money(tax), total: money(subtotal + tax) } });
    }
    console.log('Quotations seeded: 20');

    const quotations = await prisma.quotation.findMany({ where: { organizationId: organization.id } });
    const orderStatuses: SalesOrderStatus[] = [
      SalesOrderStatus.DRAFT,
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.CREDIT_CHECK,
      SalesOrderStatus.PICKING,
      SalesOrderStatus.DISPATCHED,
      SalesOrderStatus.DELIVERED,
      SalesOrderStatus.INVOICED,
      SalesOrderStatus.PARTIALLY_PAID,
      SalesOrderStatus.PAID,
      SalesOrderStatus.CANCELLED,
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.PICKING,
      SalesOrderStatus.DISPATCHED,
      SalesOrderStatus.DELIVERED,
      SalesOrderStatus.INVOICED,
      SalesOrderStatus.PARTIALLY_PAID,
      SalesOrderStatus.PAID,
      SalesOrderStatus.CREDIT_CHECK,
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.CANCELLED,
    ];

    for (let i = 0; i < 20; i += 1) {
      const quote = quotations[i % quotations.length];
      const order = await prisma.salesOrder.create({
        data: {
          organizationId: organization.id,
          orderNumber: `SO-${String(i + 1).padStart(4, '0')}`,
          customerId: quote.customerId,
          quotationId: quote.id,
          orderDate: daysAgo(15 - i),
          requiredDate: daysFromNow(3 + (i % 7)),
          status: orderStatuses[i],
          subtotal: quote.total,
          taxAmount: quote.taxAmount,
          discountAmount: quote.discountAmount,
          total: quote.total,
          warehouseId: fgWarehouse.id,
          branchId: branchHarare?.id ?? null,
          notes: `Sales order ${orderStatuses[i]}`,
          createdBy: salesRep?.id ?? null,
        },
      });
      const qItems = await prisma.quotationItem.findMany({ where: { quotationId: quote.id } });
      for (const line of qItems) {
        const deliveredFactor = [SalesOrderStatus.DELIVERED, SalesOrderStatus.INVOICED, SalesOrderStatus.PARTIALLY_PAID, SalesOrderStatus.PAID].includes(order.status) ? 1 : order.status === SalesOrderStatus.DISPATCHED ? 0.7 : 0;
        await prisma.salesOrderItem.create({
          data: {
            salesOrderId: order.id,
            itemId: line.itemId,
            quantityOrdered: line.quantity,
            quantityDelivered: qty(Number(line.quantity) * deliveredFactor),
            unitPrice: line.unitPrice,
            discountPercent: line.discountPercent,
            totalPrice: line.totalPrice,
          },
        });
      }
    }
    console.log('Sales orders seeded: 20');

    const orders = await prisma.salesOrder.findMany({ where: { organizationId: organization.id } });
    for (let i = 0; i < 20; i += 1) {
      const order = orders[i % orders.length];
      const delivery = await prisma.deliveryNote.create({
        data: {
          organizationId: organization.id,
          deliveryNumber: `DN-${String(i + 1).padStart(4, '0')}`,
          salesOrderId: order.id,
          deliveryDate: daysAgo(10 - i),
          deliveredBy: userByEmail.get('r.makoni@absoluteicecream.co.zw')?.id ?? salesRep?.id ?? null,
          status: [DeliveryNoteStatus.DRAFT, DeliveryNoteStatus.DISPATCHED, DeliveryNoteStatus.DELIVERED, DeliveryNoteStatus.CANCELLED][i % 4],
          notes: 'Delivery note for order',
        },
      });
      const orderItems = await prisma.salesOrderItem.findMany({ where: { salesOrderId: order.id } });
      for (const orderItem of orderItems) {
        await prisma.deliveryNoteItem.create({
          data: {
            deliveryNoteId: delivery.id,
            salesOrderItemId: orderItem.id,
            itemId: orderItem.itemId,
            quantity: orderItem.quantityDelivered,
          },
        });
      }
    }
    console.log('Delivery notes seeded: 20');

    const invoiceStatuses: InvoiceStatus[] = [
      InvoiceStatus.DRAFT,
      InvoiceStatus.DRAFT,
      InvoiceStatus.SENT,
      InvoiceStatus.SENT,
      InvoiceStatus.SENT,
      InvoiceStatus.PARTIAL_PAID,
      InvoiceStatus.PARTIAL_PAID,
      InvoiceStatus.PARTIAL_PAID,
      InvoiceStatus.PARTIAL_PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.CANCELLED,
      InvoiceStatus.CANCELLED,
    ];
    for (let i = 0; i < 20; i += 1) {
      const order = orders[i % orders.length];
      const orderItems = await prisma.salesOrderItem.findMany({ where: { salesOrderId: order.id } });
      const subtotal = orderItems.reduce((acc, line) => acc + Number(line.totalPrice), 0);
      const tax = i % 2 === 0 ? subtotal * 0.15 : 0;
      const total = subtotal + tax;
      const status = invoiceStatuses[i];
      const amountPaid =
        status === InvoiceStatus.PAID ? total : status === InvoiceStatus.PARTIAL_PAID ? total * 0.45 : 0;
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: organization.id,
          invoiceNumber: `INV-${String(i + 1).padStart(4, '0')}`,
          customerId: order.customerId,
          salesOrderId: order.id,
          invoiceDate: daysAgo(9 - i),
          dueDate: daysFromNow(15 - (i % 10)),
          status,
          subtotal: money(subtotal),
          taxAmount: money(tax),
          discountAmount: money(0),
          total: money(total),
          amountPaid: money(amountPaid),
          balanceDue: money(total - amountPaid),
          notes: 'Invoice record for customer order',
          createdBy: salesRep?.id ?? null,
        },
      });
      for (const line of orderItems) {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            itemId: line.itemId,
            quantity: line.quantityOrdered,
            unitPrice: line.unitPrice,
            discountPercent: line.discountPercent,
            totalPrice: line.totalPrice,
          },
        });
      }
    }
    console.log('Invoices seeded: 20');

    const invoices = await prisma.invoice.findMany({ where: { organizationId: organization.id } });
    for (let i = 0; i < 6; i += 1) {
      const invoice = invoices[i % invoices.length];
      await prisma.customerReturn.create({
        data: {
          organizationId: organization.id,
          returnNumber: `CRN-${String(i + 1).padStart(4, '0')}`,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          returnDate: daysAgo(4 + i),
          reason: i % 2 === 0 ? 'Damaged tubs on delivery' : 'Near expiry stock returned',
          totalValue: money(120 + i * 35),
          status: [ReturnStatus.DRAFT, ReturnStatus.APPROVED, ReturnStatus.COMPLETED, ReturnStatus.CANCELLED, ReturnStatus.APPROVED, ReturnStatus.COMPLETED][i],
          createdBy: salesRep?.id ?? userProfiles[0].id,
        },
      });
    }
    console.log('Customer returns seeded: 6');

    for (let i = 0; i < 20; i += 1) {
      const invoice = invoices[i % invoices.length];
      const supplier = suppliers[i % suppliers.length];
      await prisma.payment.create({
        data: {
          organizationId: organization.id,
          paymentNumber: `PAY-${String(i + 1).padStart(4, '0')}`,
          customerId: i < 14 ? invoice.customerId : null,
          supplierId: i >= 14 ? supplier.id : null,
          paymentDate: daysAgo(5 - (i % 5)),
          amount: i < 14 ? money(Math.max(80, Number(invoice.total) * 0.5)) : money(500 + i * 25),
          paymentMethod: [PaymentMethod.BANK_TRANSFER, PaymentMethod.ECOCASH, PaymentMethod.CARD, PaymentMethod.CASH, PaymentMethod.CREDIT][i % 5],
          referenceNumber: `REF-${String(10000 + i)}`,
          notes: i < 14 ? `Payment for ${invoice.invoiceNumber}` : `Supplier payment ${supplier.code}`,
          createdBy: userByEmail.get('h.zvobgo@absoluteicecream.co.zw')?.id ?? null,
        },
      });
    }
    console.log('Payments seeded: 20');
  });

  await runSection('Spare Parts + Customer Complaints', async () => {
    const spareItem = items.find((i) => i.itemType === ItemType.SPARE_PART);
    for (let i = 0; i < 10; i += 1) {
      await prisma.sparePart.create({
        data: {
          organizationId: organization.id,
          itemId: spareItem?.id ?? null,
          code: `SP-${String(i + 1).padStart(4, '0')}`,
          name: i % 2 === 0 ? 'Freezer belt assembly' : 'Packaging roller kit',
          machineType: i % 2 === 0 ? 'Freezer' : 'Packaging',
          quantityOnHand: qty(6 + i),
          reorderLevel: qty(3),
          unitCost: money(45 + i * 8),
        },
      });
    }
    console.log('Spare parts seeded: 10');

    const customerRows = await prisma.customer.findMany({ where: { organizationId: organization.id } });
    const invoiceRows = await prisma.invoice.findMany({ where: { organizationId: organization.id } });
    for (let i = 0; i < 8; i += 1) {
      await prisma.customerComplaint.create({
        data: {
          organizationId: organization.id,
          customerId: customerRows[i % customerRows.length].id,
          invoiceId: invoiceRows[i % invoiceRows.length]?.id ?? null,
          complaintDate: daysAgo(i + 1),
          title: i % 2 === 0 ? 'Packaging integrity issue' : 'Temperature concern on delivery',
          details: 'Customer reported issue requiring investigation and corrective action',
          status: i < 3 ? 'OPEN' : i < 6 ? 'IN_PROGRESS' : 'RESOLVED',
          resolvedBy: i >= 6 ? (userByEmail.get('r.makoni@absoluteicecream.co.zw')?.id ?? null) : null,
          resolvedAt: i >= 6 ? daysAgo(1) : null,
          resolutionNote: i >= 6 ? 'Resolved with replacement and credit note' : null,
        },
      });
    }
    console.log('Customer complaints seeded: 8');
  });

  await runSection('Branch Sales / Expenses / Shift Closes', async () => {
    const branchesNow = await prisma.branch.findMany({ where: { organizationId: organization.id } });
    const saleItems = [
      'Vanilla Cone',
      'Chocolate Cone',
      'Strawberry Cone',
      'Vanilla 2L Tub',
      'Chocolate 2L Tub',
      'Strawberry 2L Tub',
      'Vanilla 5L Tub',
      'Chocolate 5L Tub',
    ];
    const servedBy = [
      userByEmail.get('p.murambinda@absoluteicecream.co.zw'),
      userByEmail.get('c.nhamo@absoluteicecream.co.zw'),
      userByEmail.get('s.mupfumira@absoluteicecream.co.zw'),
    ];

    let saleCount = 0;
    for (let b = 0; b < branchesNow.length; b += 1) {
      for (let i = 0; i < 20; i += 1) {
        const branch = branchesNow[b];
        const sale = await prisma.branchSale.create({
          data: {
            organizationId: organization.id,
            branchId: branch.id,
            saleNumber: `BRSAL-${branch.code.slice(0, 3)}-${String(i + 1).padStart(3, '0')}`,
            saleDate: i < 10 ? daysAgo(0) : daysAgo(1),
            shift: i % 3 === 0 ? ShiftType.NIGHT : ShiftType.DAY,
            totalAmount: money(0),
            paymentMethod: [PaymentMethod.CASH, PaymentMethod.ECOCASH, PaymentMethod.CARD, PaymentMethod.CREDIT][(i + b) % 4],
            paymentReference: `BREF-${branch.code}-${i + 1}`,
            servedBy: servedBy[b]?.id ?? userProfiles[0].id,
          },
        });

        let total = 0;
        for (let j = 0; j < 2 + (i % 2); j += 1) {
          const item = itemByName.get(saleItems[(i + j) % saleItems.length]);
          if (!item) continue;
          const quantity = 6 + ((i + j + b) % 18);
          const unitPrice = Number(item.sellingPrice ?? money(1));
          const lineTotal = quantity * unitPrice;
          total += lineTotal;
          await prisma.branchSaleItem.create({
            data: {
              branchSaleId: sale.id,
              itemId: item.id,
              quantity: qty(quantity),
              unitPrice: money(unitPrice),
              totalPrice: money(lineTotal),
            },
          });
          await prisma.stockMovement.create({
            data: {
              organizationId: organization.id,
              itemId: item.id,
              warehouseId: (warehouseByName.get(`${branch.name.replace(' Branch', '')} Branch Warehouse`) ?? warehouses[0]).id,
              movementType: StockMovementType.SALES_ISSUE,
              quantity: qty(quantity),
              unitCost: item.unitCost ?? money(1),
              totalCost: money(quantity * Number(item.unitCost ?? money(1))),
              referenceType: 'branch_sale',
              referenceId: sale.id,
              notes: 'Branch sale issue',
              createdBy: servedBy[b]?.id ?? null,
            },
          });
        }
        await prisma.branchSale.update({ where: { id: sale.id }, data: { totalAmount: money(total) } });
        saleCount += 1;
      }
    }
    console.log(`Branch sales seeded: ${saleCount}`);

    const categories = ['UTILITIES', 'CLEANING', 'MAINTENANCE', 'TRANSPORT', 'STATIONERY', 'REFRESHMENTS', 'SECURITY', 'MISCELLANEOUS'];
    let expenseCount = 0;
    for (let b = 0; b < branchesNow.length; b += 1) {
      for (let i = 0; i < 15; i += 1) {
        await prisma.branchExpense.create({
          data: {
            organizationId: organization.id,
            branchId: branchesNow[b].id,
            expenseDate: daysAgo(6 - (i % 6)),
            category: categories[i % categories.length],
            description: `${categories[i % categories.length]} expense (${i < 4 ? 'DRAFT' : i < 12 ? 'APPROVED' : 'POSTED'})`,
            amount: money(8 + i * 3 + b * 2),
            paymentMethod: i % 3 === 0 ? PaymentMethod.CASH : PaymentMethod.ECOCASH,
            receiptUrl: `https://supabase.example.com/storage/branch-expense-${branchesNow[b].code}-${i + 1}.pdf`,
            approvedBy: i >= 4 ? (userByEmail.get('j.madzinga@absoluteicecream.co.zw')?.id ?? null) : null,
            createdBy: servedBy[b]?.id ?? userProfiles[0].id,
          },
        });
        expenseCount += 1;
      }
    }
    console.log(`Branch expenses seeded: ${expenseCount}`);

    const shiftStatuses = [
      BranchShiftStatus.OPEN,
      BranchShiftStatus.OPEN,
      BranchShiftStatus.SUBMITTED,
      BranchShiftStatus.SUBMITTED,
      BranchShiftStatus.SUBMITTED,
      BranchShiftStatus.REVIEWED,
      BranchShiftStatus.APPROVED,
      BranchShiftStatus.APPROVED,
      BranchShiftStatus.APPROVED,
      BranchShiftStatus.REJECTED,
    ];
    for (let i = 0; i < 10; i += 1) {
      const branch = branchesNow[i % branchesNow.length];
      const status = shiftStatuses[i];
      await prisma.branchShiftClose.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          shiftDate: daysAgo(i > 1 ? i : 0),
          shiftType: i % 2 === 0 ? ShiftType.DAY : ShiftType.NIGHT,
          openingStockValue: money(4250 + i * 80),
          stockReceivedValue: money(300 + i * 50),
          stockSoldValue: money(250 + i * 35),
          damagedStockValue: money(5 + i * 1.5),
          closingStockValue: money(4300 + i * 70),
          expectedCash: money(150 + i * 12),
          actualCash: money(148 + i * 12 - (i % 3 === 0 ? 2 : 0)),
          ecocashTotal: money(170 + i * 9),
          cardTotal: money(55 + i * 4),
          expensesTotal: money(35 + i * 3),
          cashVariance: money(i % 3 === 0 ? -2 : 0),
          stockVariance: money(i === 9 ? -45 : 0),
          status,
          notes: status === BranchShiftStatus.REJECTED ? 'Rejected: cash variance too high' : 'Shift close summary',
          closedBy: servedBy[i % servedBy.length]?.id ?? userProfiles[0].id,
          approvedBy: [BranchShiftStatus.REVIEWED, BranchShiftStatus.APPROVED].includes(status) ? (userByEmail.get('j.madzinga@absoluteicecream.co.zw')?.id ?? null) : null,
          approvedAt: [BranchShiftStatus.REVIEWED, BranchShiftStatus.APPROVED].includes(status) ? daysAgo(i - 1) : null,
        },
      });
    }
    console.log('Branch shift closes seeded: 10');
  });

  await runSection('Finance + Controls Modules', async () => {
    const financeUser = userByEmail.get('h.zvobgo@absoluteicecream.co.zw') ?? userProfiles[0];
    const financeManager = userByEmail.get('j.madzinga@absoluteicecream.co.zw') ?? userProfiles[0];

    const payrollStatuses = [PayrollStatus.DRAFT, PayrollStatus.APPROVED, PayrollStatus.PAID, PayrollStatus.CANCELLED];
    for (let i = 0; i < employees.length; i += 1) {
      const basic = 350 + (i % 10) * 85;
      const allowances = (i % 4) * 20;
      const deductions = (i % 3) * 15;
      await prisma.payrollRecord.create({
        data: {
          organizationId: organization.id,
          employeeId: employees[i].id,
          payPeriodStart: new Date(`${today.toISOString().slice(0, 7)}-01T00:00:00.000Z`),
          payPeriodEnd: new Date(`${today.toISOString().slice(0, 7)}-28T00:00:00.000Z`),
          basicSalary: money(basic),
          allowances: money(allowances),
          deductions: money(deductions),
          netPay: money(basic + allowances - deductions),
          status: payrollStatuses[i % payrollStatuses.length],
          notes: 'Monthly payroll run',
          createdBy: financeUser?.id ?? null,
        },
      });
    }
    console.log(`Payroll records seeded: ${employees.length}`);

    const journalTemplates: Array<{ description: string; debit: string; credit: string; amount: number }> = [
      { description: 'Monthly salary accrual', debit: '6010', credit: '2040', amount: 8500 },
      { description: 'Petty cash replenishment', debit: '1020', credit: '1030', amount: 520 },
      { description: 'Depreciation for month', debit: '6090', credit: '1120', amount: 740 },
      { description: 'Sales revenue posting', debit: '1040', credit: '4000', amount: 2788.75 },
      { description: 'GRN stock posting', debit: '1050', credit: '2010', amount: 626.75 },
    ];
    for (let i = 0; i < 20; i += 1) {
      const t = journalTemplates[i % journalTemplates.length];
      const entry = await prisma.journalEntry.create({
        data: {
          organizationId: organization.id,
          entryNumber: `JE-${String(i + 1).padStart(4, '0')}`,
          entryDate: daysAgo(20 - i),
          description:
            i < 3
              ? `[DRAFT] ${t.description}`
              : i < 6
              ? `[AWAITING_APPROVAL] ${t.description}`
              : i < 10
              ? `[APPROVED] ${t.description}`
              : i < 18
              ? `[POSTED] ${t.description}`
              : `[VOIDED] ${t.description}`,
          referenceType: i % 2 === 0 ? 'seed-testing' : 'transaction',
          referenceId: `JREF-${String(i + 1).padStart(4, '0')}`,
          createdBy: financeUser?.id ?? null,
        },
      });
      await prisma.journalEntryLine.createMany({
        data: [
          {
            journalEntryId: entry.id,
            accountId: accountByCode.get(t.debit)?.id ?? accounts[0].id,
            description: 'Debit line',
            debitAmount: money(t.amount),
            creditAmount: money(0),
          },
          {
            journalEntryId: entry.id,
            accountId: accountByCode.get(t.credit)?.id ?? accounts[1]?.id ?? accounts[0].id,
            description: 'Credit line',
            debitAmount: money(0),
            creditAmount: money(t.amount),
          },
        ],
      });
    }
    console.log('Journal entries seeded: 20');

    const pettyStatuses = [ApprovalStatus.PENDING, ApprovalStatus.PENDING, ApprovalStatus.PENDING, ApprovalStatus.PENDING, ApprovalStatus.APPROVED, ApprovalStatus.APPROVED, ApprovalStatus.APPROVED, ApprovalStatus.APPROVED, ApprovalStatus.APPROVED, ApprovalStatus.REJECTED];
    for (let i = 0; i < 10; i += 1) {
      await prisma.pettyCashRequest.create({
        data: {
          organizationId: organization.id,
          requestNumber: `PC-${String(i + 1).padStart(4, '0')}`,
          branchId: branches[i % branches.length]?.id ?? null,
          requestedBy: userProfiles[(i + 2) % userProfiles.length].id,
          requestDate: daysAgo(6 - (i % 6)),
          amountRequested: money(8 + i * 2.5),
          purpose: i % 3 === 0 ? 'Cleaning supplies' : i % 3 === 1 ? 'Transport reimbursement' : 'Stationery',
          status: pettyStatuses[i],
          approvedBy: pettyStatuses[i] === ApprovalStatus.APPROVED ? financeUser?.id ?? null : null,
          approvedAt: pettyStatuses[i] === ApprovalStatus.APPROVED ? daysAgo(4 - (i % 4)) : null,
          disbursedAt: i >= 7 && pettyStatuses[i] === ApprovalStatus.APPROVED ? daysAgo(2 - (i % 2)) : null,
        },
      });
    }
    console.log('Petty cash requests seeded: 10');

    const cashMain = await prisma.cashAccount.create({
      data: {
        organizationId: organization.id,
        accountId: accountByCode.get('1020')?.id ?? accounts[0].id,
        branchId: null,
        name: 'HQ Petty Cash',
        balance: money(850),
      },
    });
    const cashHarare = await prisma.cashAccount.create({
      data: {
        organizationId: organization.id,
        accountId: accountByCode.get('1011')?.id ?? accounts[0].id,
        branchId: branchByName.get('Harare CBD Branch')?.id ?? null,
        name: 'Harare Branch Cash Float',
        balance: money(420),
      },
    });
    const cashMas = await prisma.cashAccount.create({
      data: {
        organizationId: organization.id,
        accountId: accountByCode.get('1012')?.id ?? accounts[0].id,
        branchId: branchByName.get('Masvingo Branch')?.id ?? null,
        name: 'Masvingo Branch Cash Float',
        balance: money(280),
      },
    });
    console.log('Cash accounts seeded: 3');

    const bankMain = await prisma.bankAccount.create({
      data: {
        organizationId: organization.id,
        accountId: accountByCode.get('1030')?.id ?? accounts[0].id,
        accountName: 'CBZ Main Trading Account',
        bankName: 'CBZ Bank',
        accountNumber: '1000012456789',
        branchName: 'Harare Main Branch',
        swiftCode: 'COBZZWHA',
        currency: 'USD',
        currentBalance: money(15230),
      },
    });
    await prisma.bankAccount.create({
      data: {
        organizationId: organization.id,
        accountId: accountByCode.get('1030')?.id ?? accounts[0].id,
        accountName: 'FBC Operations Account',
        bankName: 'FBC Bank',
        accountNumber: '2000098712345',
        branchName: 'Borrowdale Branch',
        swiftCode: 'FBCPZWHA',
        currency: 'USD',
        currentBalance: money(8650),
      },
    });
    console.log('Bank accounts seeded: 2');

    const pettyRequests = await prisma.pettyCashRequest.findMany({ where: { organizationId: organization.id }, take: 5 });
    const cashAccounts = [cashMain, cashHarare, cashMas];
    for (let i = 0; i < 5; i += 1) {
      await prisma.pettyCashReplenishment.create({
        data: {
          organizationId: organization.id,
          replenishmentNumber: `PCR-${String(i + 1).padStart(4, '0')}`,
          cashAccountId: cashAccounts[i % cashAccounts.length].id,
          requestId: pettyRequests[i]?.id ?? null,
          replenishmentDate: daysAgo(5 - i),
          amount: money(40 + i * 10),
          status: [TransactionStatus.DRAFT, TransactionStatus.APPROVED, TransactionStatus.POSTED, TransactionStatus.VOIDED, TransactionStatus.APPROVED][i],
          approvedBy: i >= 1 ? financeManager?.id ?? null : null,
          createdBy: financeUser?.id ?? userProfiles[0].id,
        },
      });
    }
    console.log('Petty cash replenishments seeded: 5');

    for (let i = 0; i < 5; i += 1) {
      await prisma.bankReconciliation.create({
        data: {
          organizationId: organization.id,
          bankAccountId: bankMain.id,
          periodStart: new Date(`2026-0${i + 1}-01T00:00:00.000Z`),
          periodEnd: new Date(`2026-0${i + 1}-28T00:00:00.000Z`),
          openingBalance: money(12450 + i * 400),
          closingBalance: money(13250 + i * 450),
          statementBalance: money(15230 + i * 250),
          outstandingDeposits: money(2100 - i * 200),
          outstandingPayments: money(680 - i * 55),
          reconciledBalance: money(16650 + i * 180),
          isReconciled: i > 0,
          reconciledBy: i > 0 ? financeUser?.id ?? null : null,
          reconciledAt: i > 0 ? daysAgo(3 + i) : null,
        },
      });
    }
    console.log('Bank reconciliations seeded: 5');

    const budgetSeeds = [
      ['BUD-0001', 'Production Department Budget 2026', 'Production', BudgetStatus.DRAFT, 240000],
      ['BUD-0002', 'Procurement Budget 2026', 'Procurement', BudgetStatus.SUBMITTED, 180000],
      ['BUD-0003', 'Sales Budget 2026', 'Sales', BudgetStatus.APPROVED, 450000],
      ['BUD-0004', 'Finance and Admin Budget 2026', 'Finance', BudgetStatus.APPROVED, 85000],
      ['BUD-0005', 'Overall Company Budget 2026', 'Administration', BudgetStatus.APPROVED, 1200000],
    ] as const;
    const departments = await prisma.department.findMany({ where: { organizationId: organization.id } });
    const deptByName = new Map(departments.map((d) => [d.name, d] as const));
    for (let i = 0; i < budgetSeeds.length; i += 1) {
      const [code, name, deptName, status, totalBudgeted] = budgetSeeds[i];
      const budget = await prisma.budget.create({
        data: {
          organizationId: organization.id,
          budgetCode: code,
          name,
          budgetYear: 2026,
          budgetType: i === 4 ? 'COMPANY_WIDE' : 'DEPARTMENTAL',
          departmentId: deptByName.get(deptName)?.id ?? null,
          branchId: null,
          status,
          totalBudgeted: money(totalBudgeted),
          approvedBy: status === BudgetStatus.APPROVED ? financeManager?.id ?? null : null,
          approvedAt: status === BudgetStatus.APPROVED ? daysAgo(20 - i) : null,
          createdBy: financeUser?.id ?? userProfiles[0].id,
        },
      });
      const budgetAccounts = ['6010', '6020', '6030', '6040', '6050', '6070', '6080', '6090'];
      for (let a = 0; a < 8; a += 1) {
        const monthly = (totalBudgeted / 12) * (0.08 + a * 0.005);
        await prisma.budgetLine.create({
          data: {
            budgetId: budget.id,
            accountId: accountByCode.get(budgetAccounts[a])?.id ?? accounts[0].id,
            january: money(monthly),
            february: money(monthly),
            march: money(monthly),
            april: money(monthly),
            may: money(monthly),
            june: money(monthly),
            july: money(monthly),
            august: money(monthly),
            september: money(monthly),
            october: money(monthly),
            november: money(monthly),
            december: money(monthly),
            annualTotal: money(monthly * 12),
          },
        });
      }
      if (i > 1) {
        await prisma.budgetRevision.create({
          data: {
            budgetId: budget.id,
            revisionNumber: 1,
            reason: 'Mid-year adjustment',
            revisedBy: financeUser?.id ?? userProfiles[0].id,
            approvedBy: financeManager?.id ?? null,
          },
        });
      }
    }
    console.log('Budgets seeded: 5');

    const assetSeeds = [
      ['FA-0001', 'Ice Cream Freezer Line 1', 'Production Equipment', 45000, 10, 2000, 37700],
      ['FA-0002', 'Ice Cream Freezer Line 2', 'Production Equipment', 42000, 10, 2000, 35400],
      ['FA-0003', 'Cone Production Machine', 'Production Equipment', 28000, 10, 1500, 23500],
      ['FA-0004', 'Packaging Machine 1', 'Production Equipment', 18500, 8, 1200, 15100],
      ['FA-0005', 'Packaging Machine 2', 'Production Equipment', 17800, 8, 1200, 14650],
      ['FA-0006', 'Blast Freezer', 'Production Equipment', 32000, 10, 1800, 26800],
      ['FA-0007', 'Cold Room Unit 1', 'Production Equipment', 24500, 8, 1200, 20100],
      ['FA-0008', 'Cold Room Unit 2', 'Production Equipment', 23000, 8, 1200, 18800],
      ['FA-0009', 'Delivery Truck (Harare)', 'Motor Vehicles', 22000, 5, 2000, 14900],
      ['FA-0010', 'Office Furniture and Equipment', 'Office Equipment', 8500, 6, 500, 6400],
    ] as const;
    for (const [code, name, category, purchaseCost, life, residual, current] of assetSeeds) {
      const asset = await prisma.fixedAsset.create({
        data: {
          organizationId: organization.id,
          assetCode: code,
          name,
          description: `${name} fixed asset`,
          category,
          location: 'Harare HQ',
          purchaseDate: daysAgo(1200),
          purchaseCost: money(purchaseCost),
          usefulLifeYears: life,
          residualValue: money(residual),
          depreciationMethod: 'STRAIGHT_LINE',
          currentValue: money(current),
          accumulatedDep: money(purchaseCost - current),
          isActive: true,
        },
      });
      for (let m = 0; m < 12; m += 1) {
        const dep = (purchaseCost - residual) / (life * 12);
        await prisma.assetDepreciation.create({
          data: {
            assetId: asset.id,
            periodStart: daysAgo((12 - m) * 30),
            periodEnd: daysAgo((11 - m) * 30),
            depreciationAmount: money(dep),
            accumulatedTotal: money(dep * (m + 1)),
            bookValue: money(purchaseCost - dep * (m + 1)),
          },
        });
      }
    }
    console.log('Fixed assets seeded: 10');
    console.log('Asset depreciation rows seeded: 120');

    const approvalEntities = [
      'PURCHASE_REQUISITION',
      'PURCHASE_ORDER',
      'STOCK_ADJUSTMENT',
      'STOCK_TRANSFER',
      'PRODUCTION_MATERIAL_REQUEST',
      'CREDIT_SALES_AUTHORIZATION',
      'BRANCH_EXPENSE',
      'PAYMENT',
      'PAYROLL',
      'BUDGET',
      'JOURNAL_ENTRY',
    ];
    const workflowFallback = workflows[0];
    for (let i = 0; i < 20; i += 1) {
      const entityType = approvalEntities[i % approvalEntities.length];
      const wf = workflowByEntity.get(entityType) ?? workflowFallback;
      if (!wf) continue;
      const status = i < 5 ? ApprovalStatus.PENDING : i < 13 ? ApprovalStatus.ESCALATED : i < 18 ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
      const request = await prisma.approvalRequest.create({
        data: {
          organizationId: organization.id,
          workflowId: wf.id,
          entityType,
          entityId: `${entityType}-${String(i + 1).padStart(4, '0')}`,
          currentStep: i % 3 + 1,
          status,
          requestedBy: userProfiles[i % userProfiles.length].id,
          requestedAt: daysAgo(7 - (i % 7)),
          completedAt: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED].includes(status) ? daysAgo(1) : null,
        },
      });
      const actionSteps = status === ApprovalStatus.PENDING ? 0 : status === ApprovalStatus.ESCALATED ? 1 : 2 + (i % 2);
      for (let s = 0; s < actionSteps; s += 1) {
        await prisma.approvalAction.create({
          data: {
            approvalRequestId: request.id,
            stepNumber: s + 1,
            level: [ApprovalLevel.LEVEL1_SUPERVISOR, ApprovalLevel.LEVEL2_MANAGER, ApprovalLevel.LEVEL3_FINANCE_MANAGER, ApprovalLevel.LEVEL4_MANAGING_DIRECTOR][Math.min(s, 3)],
            actionBy: userProfiles[(i + s) % userProfiles.length].id,
            action: s + 1 === actionSteps && status === ApprovalStatus.REJECTED ? ApprovalStatus.REJECTED : ApprovalStatus.APPROVED,
            comments: `Approval step ${s + 1}`,
            actedAt: daysAgo(5 - s),
          },
        });
      }
    }
    console.log('Approval requests seeded: 20');

    const notificationTemplates = [
      ['Low stock alert', 'UHT Milk below reorder level', NotificationType.WARNING],
      ['PR approved', 'Purchase Requisition approved at Level 1', NotificationType.SUCCESS],
      ['Quality failed', 'GRN quality check failed', NotificationType.ERROR],
      ['Approval needed', 'PO awaiting your approval', NotificationType.ACTION_REQUIRED],
      ['Supplier pending', 'Supplier pending onboarding approval', NotificationType.INFO],
    ] as const;
    let noteCount = 0;
    for (let u = 0; u < userProfiles.length; u += 1) {
      for (let n = 0; n < 20; n += 1) {
        const template = notificationTemplates[n % notificationTemplates.length];
        await prisma.notification.create({
          data: {
            organizationId: organization.id,
            userProfileId: userProfiles[u].id,
            title: template[0],
            message: `${template[1]} (${userProfiles[u].firstName})`,
            type: template[2],
            isRead: n < 10,
            referenceType: 'seed-testing',
            referenceId: `NOTIF-${u + 1}-${n + 1}`,
            createdAt: daysAgo(n % 7),
          },
        });
        noteCount += 1;
      }
    }
    console.log(`Notifications seeded: ${noteCount}`);

    for (let i = 0; i < 30; i += 1) {
      const action =
        i < 5
          ? 'USER_LOGIN'
          : i < 13
          ? 'RECORD_CREATED'
          : i < 18
          ? 'RECORD_UPDATED'
          : i < 23
          ? 'RECORD_APPROVED'
          : i < 27
          ? 'RECORD_POSTED'
          : i < 29
          ? 'OVERRIDE_ACTION'
          : 'FAILED_ACTION';
      await prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          userProfileId: userProfiles[i % userProfiles.length].id,
          action,
          entityType: i % 2 === 0 ? 'purchase_order' : 'stock_adjustment',
          entityId: `AUD-${String(i + 1).padStart(4, '0')}`,
          oldValues: { status: 'previous_state', index: i },
          newValues: { status: 'new_state', index: i },
          ipAddress: randomIp(i),
          userAgent: 'Mozilla/5.0',
        },
      });
    }
    console.log('Audit logs seeded: 30');

    const fileTypes = [
      ['purchase_order', 'PO-0009.pdf'],
      ['purchase_order', 'PO-0010.pdf'],
      ['purchase_order', 'PO-0011.pdf'],
      ['purchase_order', 'PO-0012.pdf'],
      ['purchase_order', 'PO-0013.pdf'],
      ['grn', 'GRN-0007-note.jpg'],
      ['grn', 'GRN-0008-note.jpg'],
      ['grn', 'GRN-0011-note.jpg'],
      ['invoice', 'INV-0010.pdf'],
      ['invoice', 'INV-0011.pdf'],
      ['invoice', 'INV-0012.pdf'],
      ['invoice', 'INV-0013.pdf'],
      ['invoice', 'INV-0014.pdf'],
      ['quotation', 'QT-0006.pdf'],
      ['quotation', 'QT-0007.pdf'],
      ['delivery_note', 'DN-0007.pdf'],
      ['delivery_note', 'DN-0008.pdf'],
      ['shift_close', 'BSC-0007.pdf'],
      ['shift_close', 'BSC-0008.pdf'],
      ['shift_close', 'BSC-0009.pdf'],
    ] as const;
    for (let i = 0; i < fileTypes.length; i += 1) {
      const [referenceType, fileName] = fileTypes[i];
      await prisma.documentFile.create({
        data: {
          organizationId: organization.id,
          referenceType,
          referenceId: `DOC-${String(i + 1).padStart(4, '0')}`,
          fileName,
          fileUrl: `https://supabase.example.com/storage/${fileName}`,
          fileType: fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          fileSize: 125000 + i * 3500,
          uploadedBy: userProfiles[i % userProfiles.length].id,
        },
      });
    }
    console.log('Document files seeded: 20');
  });
}

main()
  .catch((error) => {
    console.error('seed-testing failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
