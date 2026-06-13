'use client';

import { Boxes, Building2, Scale, Warehouse } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SettingsResourceTable } from '@/components/settings/settings-resource-table';

export default function SettingsMasterDataPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Master Data"
        description="Review core company setup records used across inventory, production, procurement, sales, and branches."
        status="partial"
      />
      <SettingsNav />

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
          <Scale className="h-4 w-4" />
          Units of Measure
        </div>
        <SettingsResourceTable
          endpoint="/api/settings/units"
          emptyTitle="No units found"
          emptyDescription="Add units of measure and conversion rules for purchasing, production, and branch stock."
          columns={[
            { key: 'code', header: 'Code' },
            { key: 'name', header: 'Name' },
            { key: 'abbreviation', header: 'Abbreviation' },
            { key: 'unit_type', header: 'Type' },
            { key: 'is_base_unit', header: 'Base Unit' },
            { key: 'is_active', header: 'Active' },
          ]}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
          <Boxes className="h-4 w-4" />
          Stock Categories
        </div>
        <SettingsResourceTable
          endpoint="/api/settings/item-categories"
          emptyTitle="No categories found"
          emptyDescription="Add raw material, packaging, and finished goods categories before loading products."
          columns={[
            { key: 'code', header: 'Code' },
            { key: 'name', header: 'Name' },
            { key: 'stock_category', header: 'Stock Category' },
            { key: 'description', header: 'Description' },
            { key: 'is_active', header: 'Active' },
          ]}
        />
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <Building2 className="h-4 w-4" />
            Branches
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/branches"
            emptyTitle="No branches found"
            emptyDescription="Create operating branches before assigning warehouse, sales, and dispatch responsibilities."
            columns={[
              { key: 'code', header: 'Code' },
              { key: 'name', header: 'Branch' },
              { key: 'branch_type', header: 'Type' },
              { key: 'city', header: 'City' },
              { key: 'country', header: 'Country' },
              { key: 'is_active', header: 'Active' },
            ]}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <Warehouse className="h-4 w-4" />
            Warehouses
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/warehouses"
            emptyTitle="No warehouses found"
            emptyDescription="Warehouse definitions are required for receipts, transfers, production issues, and branch dispatches."
            columns={[
              { key: 'code', header: 'Code' },
              { key: 'name', header: 'Warehouse' },
              { key: 'warehouse_type', header: 'Type' },
              { key: 'branch', header: 'Branch' },
              { key: 'is_active', header: 'Active' },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
