'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { ProductionOrderPlanningForm } from '@/components/production/production-order-planning-form';
import { Button } from '@/components/ui/button';

export default function NewProductionOrderPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planned Production"
        description="Create a production order from the latest active BOM and review calculated material requirements before release."
        actions={(
          <Button asChild size="sm" variant="outline">
            <Link href="/production/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Orders
            </Link>
          </Button>
        )}
      />
      <ProductionNav />
      <ProductionOrderPlanningForm mode="create" />
    </div>
  );
}
