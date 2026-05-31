import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const sampleAccounts = [
  {
    roleName: 'Super Admin',
    workId: 'AQI-20261001',
    firstName: 'System',
    lastName: 'Owner',
    email: 'sample.superadmin@absoluteicecream.co.zw',
    idNumber: '63-610001-A01',
    branchName: 'Harare CBD Branch'
  },
  {
    roleName: 'Procurement Officer',
    workId: 'AQI-20261002',
    firstName: 'Patience',
    lastName: 'Buyer',
    email: 'sample.procurement@absoluteicecream.co.zw',
    idNumber: '63-610002-A02',
    branchName: 'Harare CBD Branch'
  },
  {
    roleName: 'Store Keeper',
    workId: 'AQI-20261003',
    firstName: 'Tawanda',
    lastName: 'Store',
    email: 'sample.storekeeper@absoluteicecream.co.zw',
    idNumber: '63-610003-A03',
    branchName: 'Harare CBD Branch'
  },
  {
    roleName: 'Production Manager',
    workId: 'AQI-20261004',
    firstName: 'Nyasha',
    lastName: 'Plant',
    email: 'sample.productionmanager@absoluteicecream.co.zw',
    idNumber: '63-610004-A04',
    branchName: 'Harare CBD Branch'
  },
  {
    roleName: 'Production Worker',
    workId: 'AQI-20261005',
    firstName: 'Tino',
    lastName: 'Operator',
    email: 'sample.productionworker@absoluteicecream.co.zw',
    idNumber: '63-610005-A05',
    branchName: 'Harare CBD Branch'
  },
  {
    roleName: 'Sales Representative',
    workId: 'AQI-20261006',
    firstName: 'Rudo',
    lastName: 'Sales',
    email: 'sample.salesrep@absoluteicecream.co.zw',
    idNumber: '63-610006-A06',
    branchName: 'Masvingo Branch'
  },
  {
    roleName: 'Branch Manager',
    workId: 'AQI-20261007',
    firstName: 'Tapiwa',
    lastName: 'Branch',
    email: 'sample.branchmanager@absoluteicecream.co.zw',
    idNumber: '63-610007-A07',
    branchName: 'Mutare Branch'
  },
  {
    roleName: 'Accountant',
    workId: 'AQI-20261008',
    firstName: 'Farai',
    lastName: 'Books',
    email: 'sample.accountant@absoluteicecream.co.zw',
    idNumber: '63-610008-A08',
    branchName: 'Harare CBD Branch'
  },
  {
    roleName: 'Auditor',
    workId: 'AQI-20261009',
    firstName: 'Munya',
    lastName: 'Audit',
    email: 'sample.auditor@absoluteicecream.co.zw',
    idNumber: '63-610009-A09',
    branchName: 'Harare CBD Branch'
  }
] as const;

const defaultPassword = 'Demo@2026!';

async function main() {
  const organization = await prisma.organization.findFirst({
    select: { id: true }
  });

  if (!organization) {
    throw new Error('No organization found. Run the base seed first: npm run -w packages/database seed');
  }

  const roles = await prisma.role.findMany({
    where: {
      organizationId: organization.id,
      name: {
        in: sampleAccounts.map((account) => account.roleName)
      }
    },
    select: {
      id: true,
      name: true
    }
  });

  const branches = await prisma.branch.findMany({
    where: { organizationId: organization.id },
    select: {
      id: true,
      name: true
    }
  });

  const roleByName = new Map(roles.map((role) => [role.name, role] as const));
  const branchByName = new Map(branches.map((branch) => [branch.name, branch] as const));

  const missingRoles = sampleAccounts
    .map((account) => account.roleName)
    .filter((roleName) => !roleByName.has(roleName));

  if (missingRoles.length > 0) {
    throw new Error(`Missing roles: ${missingRoles.join(', ')}. Run base seed to create roles.`);
  }

  for (const account of sampleAccounts) {
    const role = roleByName.get(account.roleName)!;
    const branch = branchByName.get(account.branchName);
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    const clerkUserId = `aqi-sample-${account.workId.toLowerCase()}`;

    const profile = await prisma.userProfile.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: account.email
        }
      },
      update: {
        clerkUserId,
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        status: UserStatus.ACTIVE,
        branchId: branch?.id ?? null,
        deletedAt: null
      },
      create: {
        organizationId: organization.id,
        clerkUserId,
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        status: UserStatus.ACTIVE,
        branchId: branch?.id ?? null
      }
    });

    await prisma.userAccount.upsert({
      where: {
        workId: account.workId
      },
      update: {
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        idNumber: account.idNumber,
        passwordHash,
        roleId: role.id,
        userProfileId: profile.id,
        isActive: true,
        deletedAt: null
      },
      create: {
        workId: account.workId,
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        idNumber: account.idNumber,
        passwordHash,
        roleId: role.id,
        organizationId: organization.id,
        userProfileId: profile.id,
        isActive: true
      }
    });

    await prisma.userRole.upsert({
      where: {
        userProfileId_roleId: {
          userProfileId: profile.id,
          roleId: role.id
        }
      },
      update: {
        assignedBy: profile.id
      },
      create: {
        userProfileId: profile.id,
        roleId: role.id,
        assignedBy: profile.id
      }
    });
  }

  console.log(`Sample accounts upserted: ${sampleAccounts.length}`);
  console.log(`Default password: ${defaultPassword}`);
}

main()
  .catch((error) => {
    console.error('seed-sample-accounts failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
