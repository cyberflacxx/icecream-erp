'use client';

import { Candy, Milk, Package2 } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SettingsResourceTable } from '@/components/settings/settings-resource-table';

export default function SettingsProductsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Product and Material Setup"
        description="Maintain finished goods, recipe ingredients, and packaging references used by production, procurement, costing, and branch sales."
        status="partial"
      />
      <SettingsNav />

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
          <Candy className="h-4 w-4" />
          Finished Goods
        </div>
        <SettingsResourceTable
          endpoint="/api/settings/products"
          emptyTitle="No finished goods found"
          emptyDescription="Seed or import the ice cream product catalogue before production and sales planning."
          columns={[
            { key: 'code', header: 'Code' },
            { key: 'name', header: 'Product' },
            { key: 'category', header: 'Category' },
            { key: 'unit', header: 'Unit' },
            { key: 'unit_cost', header: 'Unit Cost' },
            { key: 'selling_price', header: 'Selling Price' },
            { key: 'is_active', header: 'Active' },
          ]}
        />
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <Milk className="h-4 w-4" />
            Raw Materials
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/raw-materials"
            emptyTitle="No raw materials found"
            emptyDescription="Raw materials drive procurement, recipe costing, and physical stock reconciliations."
            columns={[
              { key: 'code', header: 'Code' },
              { key: 'name', header: 'Material' },
              { key: 'category', header: 'Category' },
              { key: 'unit', header: 'Unit' },
              { key: 'unit_cost', header: 'Unit Cost' },
              { key: 'reorder_level', header: 'Reorder Level' },
              { key: 'is_active', header: 'Active' },
            ]}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <Package2 className="h-4 w-4" />
            Packaging Materials
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/packaging-materials"
            emptyTitle="No packaging materials found"
            emptyDescription="Keep packaging items aligned with finished goods dispatch and production packing rules."
            columns={[
              { key: 'code', header: 'Code' },
              { key: 'name', header: 'Material' },
              { key: 'category', header: 'Category' },
              { key: 'unit', header: 'Unit' },
              { key: 'unit_cost', header: 'Unit Cost' },
              { key: 'reorder_level', header: 'Reorder Level' },
              { key: 'is_active', header: 'Active' },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
