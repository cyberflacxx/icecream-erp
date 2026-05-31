import {
  AccountType,
  ApprovalLevel,
  BranchStatus,
  InventoryBatchStatus,
  ItemType,
  Prisma,
  PrismaClient,
  RecipeStatus,
  SupplierStatus,
  UserStatus,
  WarehouseType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const qty = (value: number) => new Prisma.Decimal(value.toFixed(3));
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const hashPassword = async (plain: string) => bcrypt.hash(plain, 12);

type RecipeLine = { item: string; qty: number; uom: string; wastage?: number };

async function truncateAll(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      rec RECORD;
    BEGIN
      FOR rec IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      )
      LOOP
        EXECUTE 'TRUNCATE TABLE "' || rec.tablename || '" RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
}

function moduleFromPermission(code: string): string {
  const [module] = code.split('.');
  return module || 'general';
}

async function main(): Promise<void> {
  await truncateAll();

  const organization = await prisma.organization.create({
    data: {
      name: 'Absolute Quality Icecream',
      currency: 'USD',
      financialYearStart: 1,
    },
  });

  await prisma.numberSeries.createMany({
    data: [
      { organizationId: organization.id, seriesType: 'PO', prefix: 'PO-', lastNumber: 1, padding: 4 },
      { organizationId: organization.id, seriesType: 'PR', prefix: 'PR-', lastNumber: 1, padding: 4 },
      { organizationId: organization.id, seriesType: 'GRN', prefix: 'GRN-', lastNumber: 1, padding: 4 },
      { organizationId: organization.id, seriesType: 'BATCH', prefix: 'BATCH-', lastNumber: 1, padding: 4 },
      { organizationId: organization.id, seriesType: 'INV', prefix: 'INV-', lastNumber: 1, padding: 4 },
      { organizationId: organization.id, seriesType: 'SO', prefix: 'SO-', lastNumber: 1, padding: 4 },
      { organizationId: organization.id, seriesType: 'JE', prefix: 'JE-', lastNumber: 1, padding: 4 },
      { organizationId: organization.id, seriesType: 'RFQ', prefix: 'RFQ-', lastNumber: 1, padding: 4 },
      { organizationId: organization.id, seriesType: 'PAY', prefix: 'PAY-', lastNumber: 1, padding: 4 },
      { organizationId: organization.id, seriesType: 'BRS', prefix: 'BRS-', lastNumber: 1, padding: 4 },
    ],
  });

  const uomSeeds = [
    ['KG', 'kg'],
    ['Litres', 'l'],
    ['Units', 'unit'],
    ['Bags (25kg)', 'bag25'],
    ['Boxes', 'box'],
    ['Cartons', 'ctn'],
    ['Pieces', 'pcs'],
    ['Grams', 'g'],
    ['Millilitres', 'ml'],
  ] as const;

  await prisma.unitOfMeasure.createMany({
    data: uomSeeds.map(([name, abbreviation]) => ({
      organizationId: organization.id,
      name,
      abbreviation,
    })),
  });

  const itemCategories = [
    'Raw Materials',
    'Dairy',
    'Flavourings',
    'Sweeteners',
    'Stabilisers',
    'Chocolates',
    'Packaging',
    'Finished Goods',
    'Spare Parts',
    'Consumables',
  ];

  await prisma.itemCategory.createMany({
    data: itemCategories.map((name) => ({
      organizationId: organization.id,
      name,
      description: `${name} category`,
    })),
  });

  await prisma.department.createMany({
    data: [
      { organizationId: organization.id, code: 'PROD', name: 'Production', description: 'Production department' },
      { organizationId: organization.id, code: 'PROC', name: 'Procurement', description: 'Procurement department' },
      { organizationId: organization.id, code: 'STOR', name: 'Stores', description: 'Stores department' },
      { organizationId: organization.id, code: 'SALE', name: 'Sales', description: 'Sales department' },
      { organizationId: organization.id, code: 'FIN', name: 'Finance', description: 'Finance department' },
      { organizationId: organization.id, code: 'ADMIN', name: 'Administration', description: 'Administration department' },
      { organizationId: organization.id, code: 'HR', name: 'HR', description: 'Human resources department' },
    ],
  });

  await prisma.branch.createMany({
    data: [
      { organizationId: organization.id, code: 'HAR-CBD', name: 'Harare CBD Branch', address: 'First Street, Harare', phone: '+263-242-700101', status: BranchStatus.ACTIVE },
      { organizationId: organization.id, code: 'MAS-BR', name: 'Masvingo Branch', address: 'Simon Mazorodze Road, Masvingo', phone: '+263-239-500203', status: BranchStatus.ACTIVE },
      { organizationId: organization.id, code: 'MUT-BR', name: 'Mutare Branch', address: 'Aerodrome Road, Mutare', phone: '+263-20-600321', status: BranchStatus.ACTIVE },
    ],
  });

  const branches = await prisma.branch.findMany({ where: { organizationId: organization.id } });
  const branchByName = new Map(branches.map((branch) => [branch.name, branch] as const));

  await prisma.warehouse.createMany({
    data: [
      { organizationId: organization.id, code: 'WH-RM-MAIN', name: 'Main Raw Materials Warehouse', type: WarehouseType.MAIN, address: 'Workington, Harare' },
      { organizationId: organization.id, code: 'WH-FG-COLD', name: 'Finished Goods Cold Room', type: WarehouseType.COLD_ROOM, address: 'Workington, Harare' },
      { organizationId: organization.id, branchId: branchByName.get('Harare CBD Branch')?.id, code: 'WH-HAR-BR', name: 'Harare Branch Warehouse', type: WarehouseType.BRANCH, address: 'Harare CBD' },
      { organizationId: organization.id, branchId: branchByName.get('Masvingo Branch')?.id, code: 'WH-MAS-BR', name: 'Masvingo Branch Warehouse', type: WarehouseType.BRANCH, address: 'Masvingo' },
      { organizationId: organization.id, branchId: branchByName.get('Mutare Branch')?.id, code: 'WH-MUT-BR', name: 'Mutare Branch Warehouse', type: WarehouseType.BRANCH, address: 'Mutare' },
    ],
  });

  const supplierCategories = [
    'Dairy Suppliers',
    'Flavour Suppliers',
    'Packaging Suppliers',
    'Chemical Suppliers',
    'Equipment Suppliers',
  ];
  await prisma.supplierCategory.createMany({
    data: supplierCategories.map((name) => ({
      organizationId: organization.id,
      name,
      description: `${name} partners`,
    })),
  });

  const supplierCategoryRows = await prisma.supplierCategory.findMany({ where: { organizationId: organization.id } });
  const supplierCategoryByName = new Map(supplierCategoryRows.map((row) => [row.name, row] as const));

  const supplierSeeds = [
    ['Mhofu Dairy Traders', 'Dairy Suppliers'],
    ['Nyathi Fresh Milk Co', 'Dairy Suppliers'],
    ['Kanyemba Cream Supply', 'Dairy Suppliers'],
    ['Mutasa Flavours Pvt Ltd', 'Flavour Suppliers'],
    ['Zim Essence Blends', 'Flavour Suppliers'],
    ['Savanna Aroma Labs', 'Flavour Suppliers'],
    ['Alpha Pack Zimbabwe', 'Packaging Suppliers'],
    ['Cartonlink Manufacturing', 'Packaging Suppliers'],
    ['Packright Containers', 'Packaging Suppliers'],
    ['Chemwise Africa', 'Chemical Suppliers'],
    ['Safeguard Food Chemicals', 'Chemical Suppliers'],
    ['PureMix Ingredients', 'Chemical Suppliers'],
    ['Matopo Engineering Supplies', 'Equipment Suppliers'],
    ['Nyaradzo Industrial Tools', 'Equipment Suppliers'],
    ['Great Dyke Mechanicals', 'Equipment Suppliers'],
  ] as const;

  await prisma.supplier.createMany({
    data: supplierSeeds.map(([name, category], index) => ({
      organizationId: organization.id,
      code: `SUP-${String(index + 1).padStart(3, '0')}`,
      name,
      categoryId: supplierCategoryByName.get(category)!.id,
      contactPerson: 'Accounts Department',
      phone: `+263-77${String(100000 + index)}`,
      email: `procurement${index + 1}@${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.zw`,
      address: 'Harare, Zimbabwe',
      paymentTerms: '30 days',
      creditLimit: money(25000 + index * 1500),
      currentBalance: money(0),
      status: SupplierStatus.ACTIVE,
    })),
  });

  const uomRows = await prisma.unitOfMeasure.findMany({ where: { organizationId: organization.id } });
  const uomByName = new Map(uomRows.map((row) => [row.name, row] as const));

  const categoryRows = await prisma.itemCategory.findMany({ where: { organizationId: organization.id } });
  const categoryByName = new Map(categoryRows.map((row) => [row.name, row] as const));

  const itemSeeds = [
    ['RM-001', 'UHT Full Cream Milk', ItemType.RAW_MATERIAL, 'Dairy', 'Litres', 1.25, 2.2],
    ['RM-002', 'Fresh Milk', ItemType.RAW_MATERIAL, 'Dairy', 'Litres', 1.05, 2.0],
    ['RM-003', 'Milk Powder', ItemType.RAW_MATERIAL, 'Dairy', 'KG', 4.2, 6.5],
    ['RM-004', 'Cream', ItemType.RAW_MATERIAL, 'Dairy', 'Litres', 3.8, 5.5],
    ['RM-005', 'Sugar (50kg bags)', ItemType.RAW_MATERIAL, 'Sweeteners', 'Bags (25kg)', 21.5, 30.0],
    ['RM-006', 'Glucose Syrup', ItemType.RAW_MATERIAL, 'Sweeteners', 'KG', 2.9, 4.5],
    ['RM-007', 'Vanilla Flavour', ItemType.RAW_MATERIAL, 'Flavourings', 'Millilitres', 0.08, 0.15],
    ['RM-008', 'Strawberry Flavour', ItemType.RAW_MATERIAL, 'Flavourings', 'Millilitres', 0.09, 0.16],
    ['RM-009', 'Chocolate Type A (Dark)', ItemType.RAW_MATERIAL, 'Chocolates', 'KG', 5.1, 7.2],
    ['RM-010', 'Chocolate Type B (Milk)', ItemType.RAW_MATERIAL, 'Chocolates', 'KG', 4.8, 6.9],
    ['RM-011', 'Chocolate Type C (White)', ItemType.RAW_MATERIAL, 'Chocolates', 'KG', 5.4, 7.8],
    ['RM-012', 'Stabilizer', ItemType.RAW_MATERIAL, 'Stabilisers', 'KG', 6.2, 9.0],
    ['RM-013', 'Emulsifier', ItemType.RAW_MATERIAL, 'Stabilisers', 'KG', 5.7, 8.4],
    ['RM-014', 'Food Colouring (Red)', ItemType.RAW_MATERIAL, 'Flavourings', 'Millilitres', 0.12, 0.2],
    ['RM-015', 'Food Colouring (Brown)', ItemType.RAW_MATERIAL, 'Flavourings', 'Millilitres', 0.11, 0.19],
    ['RM-016', 'Ice Cream Mix (base)', ItemType.RAW_MATERIAL, 'Raw Materials', 'KG', 3.9, 6.0],
    ['PK-001', 'Cone Shells', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Pieces', 0.05, 0.1],
    ['PK-002', '2L Tub Containers', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Units', 0.18, 0.35],
    ['PK-003', '5L Tub Containers', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Units', 0.33, 0.55],
    ['PK-004', '2L Lids', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Units', 0.07, 0.15],
    ['PK-005', '5L Lids', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Units', 0.11, 0.2],
    ['PK-006', 'Wrappers (cone)', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Pieces', 0.02, 0.05],
    ['PK-007', 'Carton Boxes (2L x12)', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Cartons', 1.1, 1.9],
    ['PK-008', 'Carton Boxes (5L x6)', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Cartons', 1.35, 2.2],
    ['PK-009', 'Labels (2L Vanilla)', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Pieces', 0.01, 0.03],
    ['PK-010', 'Labels (2L Chocolate)', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Pieces', 0.01, 0.03],
    ['PK-011', 'Labels (2L Strawberry)', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Pieces', 0.01, 0.03],
    ['PK-012', 'Labels (5L Vanilla)', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Pieces', 0.015, 0.035],
    ['PK-013', 'Labels (5L Chocolate)', ItemType.PACKAGING_MATERIAL, 'Packaging', 'Pieces', 0.015, 0.035],
    ['FG-001', 'Vanilla Cone', ItemType.FINISHED_GOOD, 'Finished Goods', 'Units', 0.42, 0.9],
    ['FG-002', 'Chocolate Cone', ItemType.FINISHED_GOOD, 'Finished Goods', 'Units', 0.47, 1.0],
    ['FG-003', 'Strawberry Cone', ItemType.FINISHED_GOOD, 'Finished Goods', 'Units', 0.45, 0.95],
    ['FG-004', 'Vanilla 2L Tub', ItemType.FINISHED_GOOD, 'Finished Goods', 'Units', 1.85, 3.8],
    ['FG-005', 'Chocolate 2L Tub', ItemType.FINISHED_GOOD, 'Finished Goods', 'Units', 1.95, 4.0],
    ['FG-006', 'Strawberry 2L Tub', ItemType.FINISHED_GOOD, 'Finished Goods', 'Units', 1.92, 3.95],
    ['FG-007', 'Vanilla 5L Tub', ItemType.FINISHED_GOOD, 'Finished Goods', 'Units', 3.8, 7.5],
    ['FG-008', 'Chocolate 5L Tub', ItemType.FINISHED_GOOD, 'Finished Goods', 'Units', 4.1, 7.9],
    ['FG-009', 'Bulk Vanilla (20L)', ItemType.FINISHED_GOOD, 'Finished Goods', 'Units', 12.4, 24.0],
    ['FG-010', 'Mixed Cone Pack (x12)', ItemType.FINISHED_GOOD, 'Finished Goods', 'Boxes', 5.4, 10.5],
    ['SP-001', 'Conveyor Belt (Freezer Line)', ItemType.SPARE_PART, 'Spare Parts', 'Units', 150.0, 225.0],
    ['CS-001', 'Food Grade Sanitizer', ItemType.CONSUMABLE, 'Consumables', 'Litres', 3.4, 5.2],
  ] as const;

  await prisma.item.createMany({
    data: itemSeeds.map(([code, name, type, category, uom, cost, price]) => ({
      organizationId: organization.id,
      code,
      name,
      itemType: type,
      categoryId: categoryByName.get(category)!.id,
      unitOfMeasureId: uomByName.get(uom)!.id,
      reorderLevel: qty(50),
      reorderQuantity: qty(200),
      unitCost: money(cost),
      sellingPrice: money(price),
      trackExpiry: type !== ItemType.SPARE_PART,
    })),
  });

  const itemRows = await prisma.item.findMany({ where: { organizationId: organization.id } });
  const itemByName = new Map(itemRows.map((row) => [row.name, row] as const));

  const recipeSeeds: Array<{
    code: string;
    name: string;
    finishedItem: string;
    outputQty: number;
    outputUom: string;
    materials: RecipeLine[];
    packaging: RecipeLine[];
  }> = [
    {
      code: 'RCP-001',
      name: 'Vanilla Cone Recipe',
      finishedItem: 'Vanilla Cone',
      outputQty: 1000,
      outputUom: 'Units',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 80, uom: 'KG', wastage: 2 },
        { item: 'UHT Full Cream Milk', qty: 220, uom: 'Litres', wastage: 1.5 },
        { item: 'Sugar (50kg bags)', qty: 6, uom: 'Bags (25kg)', wastage: 1 },
        { item: 'Vanilla Flavour', qty: 1800, uom: 'Millilitres', wastage: 1.2 },
        { item: 'Stabilizer', qty: 3.5, uom: 'KG', wastage: 1.5 },
        { item: 'Emulsifier', qty: 2.2, uom: 'KG', wastage: 1.5 },
      ],
      packaging: [
        { item: 'Cone Shells', qty: 1000, uom: 'Pieces' },
        { item: 'Wrappers (cone)', qty: 1000, uom: 'Pieces' },
      ],
    },
    {
      code: 'RCP-002',
      name: 'Chocolate Cone Recipe',
      finishedItem: 'Chocolate Cone',
      outputQty: 1000,
      outputUom: 'Units',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 82, uom: 'KG', wastage: 2 },
        { item: 'UHT Full Cream Milk', qty: 215, uom: 'Litres', wastage: 1.5 },
        { item: 'Sugar (50kg bags)', qty: 6.2, uom: 'Bags (25kg)', wastage: 1 },
        { item: 'Chocolate Type A (Dark)', qty: 8.5, uom: 'KG', wastage: 1.8 },
        { item: 'Chocolate Type B (Milk)', qty: 6.7, uom: 'KG', wastage: 1.8 },
        { item: 'Chocolate Type C (White)', qty: 5.4, uom: 'KG', wastage: 1.8 },
        { item: 'Stabilizer', qty: 3.7, uom: 'KG', wastage: 1.5 },
      ],
      packaging: [
        { item: 'Cone Shells', qty: 1000, uom: 'Pieces' },
        { item: 'Wrappers (cone)', qty: 1000, uom: 'Pieces' },
      ],
    },
    {
      code: 'RCP-003',
      name: 'Strawberry Cone Recipe',
      finishedItem: 'Strawberry Cone',
      outputQty: 1000,
      outputUom: 'Units',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 80, uom: 'KG', wastage: 2 },
        { item: 'Fresh Milk', qty: 230, uom: 'Litres', wastage: 1.5 },
        { item: 'Sugar (50kg bags)', qty: 6, uom: 'Bags (25kg)', wastage: 1 },
        { item: 'Strawberry Flavour', qty: 2000, uom: 'Millilitres', wastage: 1.2 },
        { item: 'Food Colouring (Red)', qty: 350, uom: 'Millilitres', wastage: 1 },
      ],
      packaging: [
        { item: 'Cone Shells', qty: 1000, uom: 'Pieces' },
        { item: 'Wrappers (cone)', qty: 1000, uom: 'Pieces' },
      ],
    },
    {
      code: 'RCP-004',
      name: 'Vanilla 2L Tub Recipe',
      finishedItem: 'Vanilla 2L Tub',
      outputQty: 240,
      outputUom: 'Units',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 110, uom: 'KG', wastage: 1.5 },
        { item: 'UHT Full Cream Milk', qty: 380, uom: 'Litres', wastage: 1.2 },
        { item: 'Vanilla Flavour', qty: 2800, uom: 'Millilitres', wastage: 1.1 },
      ],
      packaging: [
        { item: '2L Tub Containers', qty: 240, uom: 'Units' },
        { item: '2L Lids', qty: 240, uom: 'Units' },
        { item: 'Labels (2L Vanilla)', qty: 240, uom: 'Pieces' },
        { item: 'Carton Boxes (2L x12)', qty: 20, uom: 'Cartons' },
      ],
    },
    {
      code: 'RCP-005',
      name: 'Chocolate 2L Tub Recipe',
      finishedItem: 'Chocolate 2L Tub',
      outputQty: 240,
      outputUom: 'Units',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 115, uom: 'KG', wastage: 1.5 },
        { item: 'Fresh Milk', qty: 360, uom: 'Litres', wastage: 1.2 },
        { item: 'Chocolate Type A (Dark)', qty: 12, uom: 'KG', wastage: 1.5 },
        { item: 'Chocolate Type B (Milk)', qty: 9, uom: 'KG', wastage: 1.5 },
      ],
      packaging: [
        { item: '2L Tub Containers', qty: 240, uom: 'Units' },
        { item: '2L Lids', qty: 240, uom: 'Units' },
        { item: 'Labels (2L Chocolate)', qty: 240, uom: 'Pieces' },
        { item: 'Carton Boxes (2L x12)', qty: 20, uom: 'Cartons' },
      ],
    },
    {
      code: 'RCP-006',
      name: 'Strawberry 2L Tub Recipe',
      finishedItem: 'Strawberry 2L Tub',
      outputQty: 240,
      outputUom: 'Units',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 112, uom: 'KG', wastage: 1.5 },
        { item: 'Fresh Milk', qty: 365, uom: 'Litres', wastage: 1.2 },
        { item: 'Strawberry Flavour', qty: 3200, uom: 'Millilitres', wastage: 1.1 },
      ],
      packaging: [
        { item: '2L Tub Containers', qty: 240, uom: 'Units' },
        { item: '2L Lids', qty: 240, uom: 'Units' },
        { item: 'Labels (2L Strawberry)', qty: 240, uom: 'Pieces' },
        { item: 'Carton Boxes (2L x12)', qty: 20, uom: 'Cartons' },
      ],
    },
    {
      code: 'RCP-007',
      name: 'Vanilla 5L Tub Recipe',
      finishedItem: 'Vanilla 5L Tub',
      outputQty: 120,
      outputUom: 'Units',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 95, uom: 'KG', wastage: 1.5 },
        { item: 'UHT Full Cream Milk', qty: 300, uom: 'Litres', wastage: 1.2 },
        { item: 'Vanilla Flavour', qty: 2400, uom: 'Millilitres', wastage: 1.1 },
      ],
      packaging: [
        { item: '5L Tub Containers', qty: 120, uom: 'Units' },
        { item: '5L Lids', qty: 120, uom: 'Units' },
        { item: 'Labels (5L Vanilla)', qty: 120, uom: 'Pieces' },
        { item: 'Carton Boxes (5L x6)', qty: 20, uom: 'Cartons' },
      ],
    },
    {
      code: 'RCP-008',
      name: 'Chocolate 5L Tub Recipe',
      finishedItem: 'Chocolate 5L Tub',
      outputQty: 120,
      outputUom: 'Units',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 97, uom: 'KG', wastage: 1.5 },
        { item: 'Fresh Milk', qty: 290, uom: 'Litres', wastage: 1.2 },
        { item: 'Chocolate Type A (Dark)', qty: 11, uom: 'KG', wastage: 1.3 },
        { item: 'Chocolate Type B (Milk)', qty: 8.5, uom: 'KG', wastage: 1.3 },
      ],
      packaging: [
        { item: '5L Tub Containers', qty: 120, uom: 'Units' },
        { item: '5L Lids', qty: 120, uom: 'Units' },
        { item: 'Labels (5L Chocolate)', qty: 120, uom: 'Pieces' },
        { item: 'Carton Boxes (5L x6)', qty: 20, uom: 'Cartons' },
      ],
    },
    {
      code: 'RCP-009',
      name: 'Bulk Vanilla 20L Recipe',
      finishedItem: 'Bulk Vanilla (20L)',
      outputQty: 50,
      outputUom: 'Units',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 130, uom: 'KG', wastage: 1.4 },
        { item: 'UHT Full Cream Milk', qty: 410, uom: 'Litres', wastage: 1.1 },
        { item: 'Vanilla Flavour', qty: 3800, uom: 'Millilitres', wastage: 1.0 },
      ],
      packaging: [
        { item: '5L Tub Containers', qty: 200, uom: 'Units' },
        { item: '5L Lids', qty: 200, uom: 'Units' },
      ],
    },
    {
      code: 'RCP-010',
      name: 'Mixed Cone Pack Recipe',
      finishedItem: 'Mixed Cone Pack (x12)',
      outputQty: 200,
      outputUom: 'Boxes',
      materials: [
        { item: 'Ice Cream Mix (base)', qty: 72, uom: 'KG', wastage: 2.0 },
        { item: 'Fresh Milk', qty: 180, uom: 'Litres', wastage: 1.5 },
        { item: 'Vanilla Flavour', qty: 600, uom: 'Millilitres', wastage: 1.0 },
        { item: 'Strawberry Flavour', qty: 600, uom: 'Millilitres', wastage: 1.0 },
        { item: 'Chocolate Type A (Dark)', qty: 5, uom: 'KG', wastage: 1.5 },
      ],
      packaging: [
        { item: 'Cone Shells', qty: 2400, uom: 'Pieces' },
        { item: 'Wrappers (cone)', qty: 2400, uom: 'Pieces' },
        { item: 'Carton Boxes (2L x12)', qty: 200, uom: 'Cartons' },
      ],
    },
  ];

  for (const recipeSeed of recipeSeeds) {
    const recipe = await prisma.recipe.create({
      data: {
        organizationId: organization.id,
        code: recipeSeed.code,
        name: recipeSeed.name,
        finishedItemId: itemByName.get(recipeSeed.finishedItem)!.id,
        expectedOutputQuantity: qty(recipeSeed.outputQty),
        outputUnitId: uomByName.get(recipeSeed.outputUom)!.id,
        status: RecipeStatus.ACTIVE,
        instructions: `Standard process for ${recipeSeed.finishedItem}`,
      },
    });

    await prisma.recipeItem.createMany({
      data: recipeSeed.materials.map((line) => ({
        recipeId: recipe.id,
        itemId: itemByName.get(line.item)!.id,
        quantityRequired: qty(line.qty),
        unitId: uomByName.get(line.uom)!.id,
        wastageAllowancePercent: line.wastage ? new Prisma.Decimal(line.wastage.toFixed(2)) : null,
      })),
    });

    await prisma.recipePackaging.createMany({
      data: recipeSeed.packaging.map((line) => ({
        recipeId: recipe.id,
        itemId: itemByName.get(line.item)!.id,
        quantityRequired: qty(line.qty),
        unitId: uomByName.get(line.uom)!.id,
      })),
    });
  }

  await prisma.machine.createMany({
    data: [
      { organizationId: organization.id, code: 'MCH-001', name: 'Ice Cream Freezer Line 1', machineType: 'Freezer', status: 'ACTIVE', location: 'Production Bay A' },
      { organizationId: organization.id, code: 'MCH-002', name: 'Ice Cream Freezer Line 2', machineType: 'Freezer', status: 'ACTIVE', location: 'Production Bay B' },
      { organizationId: organization.id, code: 'MCH-003', name: 'Cone Production Machine', machineType: 'Coning', status: 'ACTIVE', location: 'Coning Area' },
      { organizationId: organization.id, code: 'MCH-004', name: 'Packaging Machine 1', machineType: 'Packaging', status: 'ACTIVE', location: 'Packing Line 1' },
      { organizationId: organization.id, code: 'MCH-005', name: 'Packaging Machine 2', machineType: 'Packaging', status: 'ACTIVE', location: 'Packing Line 2' },
      { organizationId: organization.id, code: 'MCH-006', name: 'Blast Freezer', machineType: 'Freezer', status: 'ACTIVE', location: 'Cold Utility Zone' },
      { organizationId: organization.id, code: 'MCH-007', name: 'Cold Room Unit 1', machineType: 'Cold Room', status: 'ACTIVE', location: 'Finished Goods Cold Room' },
      { organizationId: organization.id, code: 'MCH-008', name: 'Cold Room Unit 2', machineType: 'Cold Room', status: 'ACTIVE', location: 'Finished Goods Cold Room' },
    ],
  });

  const chartOfAccounts = [
    ['1000', 'Current Assets', AccountType.ASSET, null],
    ['1010', 'Cash at Hand - HQ', AccountType.ASSET, '1000'],
    ['1011', 'Cash at Hand - Harare Branch', AccountType.ASSET, '1000'],
    ['1012', 'Cash at Hand - Masvingo Branch', AccountType.ASSET, '1000'],
    ['1013', 'Cash at Hand - Mutare Branch', AccountType.ASSET, '1000'],
    ['1020', 'Petty Cash', AccountType.ASSET, '1000'],
    ['1030', 'Bank - Main Account', AccountType.ASSET, '1000'],
    ['1040', 'Accounts Receivable', AccountType.ASSET, '1000'],
    ['1050', 'Inventory - Raw Materials', AccountType.ASSET, '1000'],
    ['1060', 'Inventory - WIP', AccountType.ASSET, '1000'],
    ['1070', 'Inventory - Finished Goods', AccountType.ASSET, '1000'],
    ['1080', 'Prepaid Expenses', AccountType.ASSET, '1000'],
    ['1100', 'Fixed Assets', AccountType.ASSET, null],
    ['1110', 'Production Equipment', AccountType.ASSET, '1100'],
    ['1120', 'Accumulated Depreciation', AccountType.ASSET, '1100'],
    ['2000', 'Current Liabilities', AccountType.LIABILITY, null],
    ['2010', 'Accounts Payable', AccountType.LIABILITY, '2000'],
    ['2020', 'VAT Payable', AccountType.LIABILITY, '2000'],
    ['2030', 'PAYE Payable', AccountType.LIABILITY, '2000'],
    ['2040', 'Accrued Expenses', AccountType.LIABILITY, '2000'],
    ['3000', 'Share Capital', AccountType.EQUITY, null],
    ['3010', 'Retained Earnings', AccountType.EQUITY, '3000'],
    ['4000', 'Sales Revenue', AccountType.REVENUE, null],
    ['4010', 'Sales - Vanilla Products', AccountType.REVENUE, '4000'],
    ['4020', 'Sales - Chocolate Products', AccountType.REVENUE, '4000'],
    ['4030', 'Sales - Strawberry Products', AccountType.REVENUE, '4000'],
    ['4040', 'Sales - Bulk Products', AccountType.REVENUE, '4000'],
    ['5000', 'Cost of Goods Sold', AccountType.COST_OF_SALES, null],
    ['5010', 'Raw Material Costs', AccountType.COST_OF_SALES, '5000'],
    ['5020', 'Packaging Costs', AccountType.COST_OF_SALES, '5000'],
    ['5030', 'Direct Labour', AccountType.COST_OF_SALES, '5000'],
    ['5040', 'Production Overhead', AccountType.COST_OF_SALES, '5000'],
    ['6000', 'Operating Expenses', AccountType.EXPENSE, null],
    ['6010', 'Salaries and Wages', AccountType.EXPENSE, '6000'],
    ['6020', 'Electricity', AccountType.EXPENSE, '6000'],
    ['6030', 'Water', AccountType.EXPENSE, '6000'],
    ['6040', 'Fuel', AccountType.EXPENSE, '6000'],
    ['6050', 'Maintenance and Repairs', AccountType.EXPENSE, '6000'],
    ['6060', 'Rent', AccountType.EXPENSE, '6000'],
    ['6070', 'Administration Expenses', AccountType.EXPENSE, '6000'],
    ['6080', 'Marketing Expenses', AccountType.EXPENSE, '6000'],
    ['6090', 'Depreciation', AccountType.EXPENSE, '6000'],
  ] as const;

  const accountByCode = new Map<string, string>();
  for (const [code, name, type, parentCode] of chartOfAccounts) {
    const account = await prisma.account.create({
      data: {
        organizationId: organization.id,
        accountCode: code,
        accountName: name,
        accountType: type,
        parentAccountId: parentCode ? accountByCode.get(parentCode) ?? null : null,
      },
    });
    accountByCode.set(code, account.id);
  }

  await prisma.taxRate.createMany({
    data: [
      { organizationId: organization.id, name: 'VAT', code: 'VAT', rate: new Prisma.Decimal('0.15'), accountId: accountByCode.get('2020') ?? null },
      { organizationId: organization.id, name: 'No Tax', code: 'NO_TAX', rate: new Prisma.Decimal('0.00') },
    ],
  });

  await prisma.adminKey.create({
    data: {
      keyValue: process.env.ADMIN_KEY ?? 'AQI-ADMIN-2026',
      description: 'Absolute Quality Icecream ERP bootstrap admin key',
      isActive: true,
    },
  });

  const permissionCodes = [
    'inventory.read', 'inventory.create', 'inventory.adjust', 'inventory.write_off',
    'stock_transfer.read', 'stock_transfer.create', 'stock_transfer.approve',
    'supplier.read', 'supplier.create', 'supplier.update', 'supplier.approve',
    'purchase_requisition.read', 'purchase_requisition.create', 'purchase_requisition.approve',
    'purchase_order.read', 'purchase_order.create', 'purchase_order.approve',
    'grn.read', 'grn.create', 'grn.approve', 'rfq.read', 'rfq.create',
    'production_batch.read', 'production_batch.create', 'production_batch.close', 'production_batch.cancel',
    'production_material.request', 'production_material.approve', 'production_material.issue',
    'recipe.read', 'recipe.create', 'recipe.update', 'production_costing.read',
    'shift_report.read', 'shift_report.create', 'wastage.record', 'quality.read', 'quality.record',
    'branch_sales.read', 'branch_sales.create', 'branch_shift.read', 'branch_shift.close', 'branch_shift.approve',
    'branch_expense.create', 'branch_expense.approve',
    'customer.read', 'customer.create', 'customer.update', 'customer.credit_approve',
    'sales_order.read', 'sales_order.create', 'sales_order.approve',
    'invoice.read', 'invoice.create', 'invoice.post',
    'delivery.read', 'delivery.create',
    'payment.read', 'payment.create', 'payment.approve',
    'quotation.read', 'quotation.create',
    'finance.read', 'finance.manage',
    'journal.read', 'journal.create', 'journal.post', 'journal.approve',
    'bank.read', 'bank.reconcile',
    'cash.read', 'cash.manage',
    'petty_cash.request', 'petty_cash.approve', 'petty_cash.disburse',
    'accounts_payable.read', 'accounts_payable.manage',
    'accounts_receivable.read', 'accounts_receivable.manage',
    'budget.read', 'budget.create', 'budget.approve',
    'fixed_assets.read', 'fixed_assets.manage',
    'tax.read', 'tax.manage',
    'employee.read', 'employee.create', 'employee.update',
    'attendance.read', 'attendance.record',
    'leave.read', 'leave.approve',
    'payroll.read', 'payroll.create', 'payroll.approve',
    'maintenance.read', 'maintenance.create', 'maintenance.update',
    'machine.read', 'machine.create', 'breakdown.record',
    'reports.read', 'reports.export', 'reports.financial', 'reports.production', 'reports.inventory', 'reports.sales', 'reports.hr', 'reports.costing',
    'settings.manage', 'user.manage', 'roles.manage', 'audit_log.read', 'approval_workflow.manage', 'number_series.manage',
  ];

  await prisma.permission.createMany({
    data: permissionCodes.map((code) => ({
      code,
      name: code,
      description: `Permission for ${code}`,
      module: moduleFromPermission(code),
    })),
  });

  const coreRoles = [
    'Super Admin',
    'Procurement Officer',
    'Store Keeper',
    'Production Manager',
    'Production Worker',
    'Sales Representative',
    'Branch Manager',
    'Accountant',
    'Auditor',
  ];
  const workflowRoles = [
    'Supervisor',
    'Department Manager',
    'Finance Manager',
    'Managing Director',
    'Procurement Manager',
    'Store Keeper Supervisor',
    'Stores Officer',
    'Production Supervisor',
    'Sales Manager',
    'HR Manager',
  ];

  await prisma.role.createMany({
    data: [...new Set([...coreRoles, ...workflowRoles])].map((name) => ({
      organizationId: organization.id,
      name,
      description: `${name} role`,
      isSystemRole: name === 'Super Admin',
    })),
  });

  const roles = await prisma.role.findMany({ where: { organizationId: organization.id } });
  const roleByName = new Map(roles.map((role) => [role.name, role] as const));

  const permissions = await prisma.permission.findMany();
  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission] as const));

  const rolePermissionMap: Record<string, string[]> = {
    'Super Admin': permissionCodes,
    'Procurement Officer': ['supplier.read', 'supplier.create', 'supplier.update', 'purchase_requisition.read', 'purchase_requisition.create', 'purchase_order.read', 'purchase_order.create', 'grn.read', 'grn.create', 'rfq.read', 'rfq.create', 'inventory.read', 'reports.read', 'reports.inventory'],
    'Store Keeper': ['inventory.read', 'inventory.create', 'inventory.adjust', 'stock_transfer.read', 'stock_transfer.create', 'grn.read', 'grn.approve', 'production_material.issue', 'reports.read', 'reports.inventory'],
    'Production Manager': ['production_batch.read', 'production_batch.create', 'production_batch.close', 'production_batch.cancel', 'production_material.request', 'production_material.approve', 'recipe.read', 'recipe.create', 'recipe.update', 'production_costing.read', 'shift_report.read', 'shift_report.create', 'wastage.record', 'quality.read', 'quality.record', 'inventory.read', 'reports.read', 'reports.production'],
    'Production Worker': ['production_batch.read', 'production_material.request', 'shift_report.create', 'wastage.record', 'quality.record', 'attendance.record'],
    'Sales Representative': ['customer.read', 'customer.create', 'sales_order.read', 'sales_order.create', 'quotation.read', 'quotation.create', 'invoice.read', 'delivery.read', 'delivery.create', 'payment.read', 'payment.create', 'inventory.read', 'branch_sales.read', 'branch_sales.create', 'reports.read', 'reports.sales'],
    'Branch Manager': ['branch_sales.read', 'branch_sales.create', 'branch_shift.read', 'branch_shift.close', 'branch_expense.create', 'customer.read', 'inventory.read', 'stock_transfer.read', 'reports.read', 'reports.sales', 'employee.read', 'attendance.read'],
    Accountant: ['finance.read', 'finance.manage', 'journal.read', 'journal.create', 'journal.post', 'bank.read', 'bank.reconcile', 'cash.read', 'cash.manage', 'petty_cash.approve', 'petty_cash.disburse', 'accounts_payable.read', 'accounts_payable.manage', 'accounts_receivable.read', 'accounts_receivable.manage', 'budget.read', 'budget.create', 'invoice.read', 'invoice.post', 'payment.read', 'payment.create', 'payment.approve', 'branch_shift.approve', 'fixed_assets.read', 'fixed_assets.manage', 'tax.read', 'tax.manage', 'reports.read', 'reports.financial', 'reports.costing'],
    Auditor: ['reports.read', 'reports.export', 'reports.financial', 'reports.production', 'reports.inventory', 'reports.sales', 'reports.hr', 'reports.costing', 'audit_log.read', 'finance.read', 'inventory.read', 'journal.read', 'accounts_payable.read', 'accounts_receivable.read', 'budget.read'],
  };

  for (const [roleName, codes] of Object.entries(rolePermissionMap)) {
    const role = roleByName.get(roleName);
    if (!role) continue;
    await prisma.rolePermission.createMany({
      data: codes
        .map((code) => permissionByCode.get(code))
        .filter((permission): permission is NonNullable<typeof permission> => Boolean(permission))
        .map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
  }

  const workflows = [
    ['Purchase Requisition', 'PURCHASE_REQUISITION', ['Supervisor', 'Department Manager', 'Finance Manager'], [ApprovalLevel.LEVEL1_SUPERVISOR, ApprovalLevel.LEVEL2_MANAGER, ApprovalLevel.LEVEL3_FINANCE_MANAGER]],
    ['Purchase Order (above threshold)', 'PURCHASE_ORDER', ['Procurement Manager', 'Finance Manager', 'Managing Director'], [ApprovalLevel.LEVEL1_SUPERVISOR, ApprovalLevel.LEVEL3_FINANCE_MANAGER, ApprovalLevel.LEVEL4_MANAGING_DIRECTOR]],
    ['Stock Adjustment', 'STOCK_ADJUSTMENT', ['Store Keeper Supervisor', 'Finance Manager'], [ApprovalLevel.LEVEL1_SUPERVISOR, ApprovalLevel.LEVEL3_FINANCE_MANAGER]],
    ['Stock Transfer', 'STOCK_TRANSFER', ['Stores Officer', 'Department Manager'], [ApprovalLevel.LEVEL1_SUPERVISOR, ApprovalLevel.LEVEL2_MANAGER]],
    ['Production Material Request', 'PRODUCTION_MATERIAL_REQUEST', ['Production Supervisor', 'Stores Officer'], [ApprovalLevel.LEVEL1_SUPERVISOR, ApprovalLevel.LEVEL2_MANAGER]],
    ['Credit Sales Authorization', 'CREDIT_SALES_AUTHORIZATION', ['Sales Manager', 'Finance Manager'], [ApprovalLevel.LEVEL1_SUPERVISOR, ApprovalLevel.LEVEL3_FINANCE_MANAGER]],
    ['Branch Expense', 'BRANCH_EXPENSE', ['Branch Manager', 'Finance Manager'], [ApprovalLevel.LEVEL1_SUPERVISOR, ApprovalLevel.LEVEL3_FINANCE_MANAGER]],
    ['Payment', 'PAYMENT', ['Department Manager', 'Finance Manager', 'Managing Director'], [ApprovalLevel.LEVEL2_MANAGER, ApprovalLevel.LEVEL3_FINANCE_MANAGER, ApprovalLevel.LEVEL4_MANAGING_DIRECTOR]],
    ['Payroll', 'PAYROLL', ['HR Manager', 'Finance Manager', 'Managing Director'], [ApprovalLevel.LEVEL2_MANAGER, ApprovalLevel.LEVEL3_FINANCE_MANAGER, ApprovalLevel.LEVEL4_MANAGING_DIRECTOR]],
    ['Budget', 'BUDGET', ['Department Manager', 'Finance Manager', 'Managing Director'], [ApprovalLevel.LEVEL2_MANAGER, ApprovalLevel.LEVEL3_FINANCE_MANAGER, ApprovalLevel.LEVEL4_MANAGING_DIRECTOR]],
    ['Journal Entry', 'JOURNAL_ENTRY', ['Accountant', 'Finance Manager'], [ApprovalLevel.LEVEL1_SUPERVISOR, ApprovalLevel.LEVEL3_FINANCE_MANAGER]],
  ] as const;

  for (const [name, entityType, stepRoles, stepLevels] of workflows) {
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        organizationId: organization.id,
        name,
        entityType,
        description: `${name} workflow`,
        isActive: true,
      },
    });

    await prisma.approvalWorkflowStep.createMany({
      data: stepRoles.map((roleName, index) => ({
        workflowId: workflow.id,
        stepNumber: index + 1,
        level: stepLevels[index]!,
        roleId: roleByName.get(roleName)!.id,
        isRequired: true,
      })),
    });
  }

  const superAdminRole = roleByName.get('Super Admin')!;
  const adminBranch = branchByName.get('Harare CBD Branch');

  const adminProfile = await prisma.userProfile.create({
    data: {
      clerkUserId: 'aqi-system-admin-clerk',
      organizationId: organization.id,
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@absoluteicecream.co.zw',
      phone: '+263-772-900000',
      status: UserStatus.ACTIVE,
      branchId: adminBranch?.id ?? null,
    },
  });

  const adminPasswordHash = await hashPassword('Admin@2026!');

  await prisma.userAccount.create({
    data: {
      workId: 'AQI-20260001',
      firstName: 'System',
      lastName: 'Administrator',
      idNumber: '63-000000-A00',
      email: 'admin@absoluteicecream.co.zw',
      passwordHash: adminPasswordHash,
      roleId: superAdminRole.id,
      organizationId: organization.id,
      userProfileId: adminProfile.id,
      isActive: true,
    },
  });

  await prisma.userRole.create({
    data: {
      userProfileId: adminProfile.id,
      roleId: superAdminRole.id,
      assignedBy: adminProfile.id,
    },
  });

  const warehouseRows = await prisma.warehouse.findMany({ where: { organizationId: organization.id } });
  const warehouseByName = new Map(warehouseRows.map((row) => [row.name, row] as const));
  const rawWarehouse = warehouseByName.get('Main Raw Materials Warehouse');
  const finishedWarehouse = warehouseByName.get('Finished Goods Cold Room');

  const rawOpening = [
    ['UHT Full Cream Milk', 6000, 1.25],
    ['Fresh Milk', 4200, 1.05],
    ['Milk Powder', 1300, 4.2],
    ['Cream', 900, 3.8],
    ['Sugar (50kg bags)', 540, 21.5],
    ['Glucose Syrup', 1600, 2.9],
    ['Vanilla Flavour', 42000, 0.08],
    ['Strawberry Flavour', 36000, 0.09],
    ['Chocolate Type A (Dark)', 780, 5.1],
    ['Chocolate Type B (Milk)', 640, 4.8],
    ['Chocolate Type C (White)', 520, 5.4],
    ['Stabilizer', 410, 6.2],
    ['Emulsifier', 350, 5.7],
    ['Food Colouring (Red)', 18000, 0.12],
    ['Food Colouring (Brown)', 15000, 0.11],
    ['Ice Cream Mix (base)', 2100, 3.9],
  ] as const;

  for (const [i, row] of rawOpening.entries()) {
    const [itemName, quantity, cost] = row;
    const item = itemByName.get(itemName);
    if (!item || !rawWarehouse) continue;

    await prisma.stockBalance.create({
      data: {
        organizationId: organization.id,
        itemId: item.id,
        warehouseId: rawWarehouse.id,
        quantityOnHand: qty(quantity),
        quantityReserved: qty(0),
        quantityAvailable: qty(quantity),
      },
    });

    await prisma.inventoryBatch.create({
      data: {
        organizationId: organization.id,
        itemId: item.id,
        warehouseId: rawWarehouse.id,
        batchNumber: `BATCH-RM-${String(i + 1).padStart(4, '0')}`,
        quantityReceived: qty(quantity),
        quantityRemaining: qty(quantity),
        unitCost: money(cost),
        status: InventoryBatchStatus.ACTIVE,
      },
    });
  }

  const finishedQtyByCode: Record<string, number> = {
    'FG-001': 1800,
    'FG-002': 1700,
    'FG-003': 1600,
    'FG-004': 520,
    'FG-005': 480,
    'FG-006': 460,
    'FG-007': 250,
    'FG-008': 220,
    'FG-009': 90,
    'FG-010': 260,
  };

  const finishedGoods = itemRows.filter((row) => row.itemType === ItemType.FINISHED_GOOD);
  for (const [i, item] of finishedGoods.entries()) {
    const quantity = finishedQtyByCode[item.code] ?? 100;
    if (!finishedWarehouse) continue;

    await prisma.stockBalance.create({
      data: {
        organizationId: organization.id,
        itemId: item.id,
        warehouseId: finishedWarehouse.id,
        quantityOnHand: qty(quantity),
        quantityReserved: qty(0),
        quantityAvailable: qty(quantity),
      },
    });

    await prisma.inventoryBatch.create({
      data: {
        organizationId: organization.id,
        itemId: item.id,
        warehouseId: finishedWarehouse.id,
        batchNumber: `BATCH-FG-${String(i + 1).padStart(4, '0')}`,
        quantityReceived: qty(quantity),
        quantityRemaining: qty(quantity),
        unitCost: item.unitCost ?? money(1),
        status: InventoryBatchStatus.ACTIVE,
      },
    });
  }

  console.log('Seed completed for Absolute Quality Icecream ERP');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
