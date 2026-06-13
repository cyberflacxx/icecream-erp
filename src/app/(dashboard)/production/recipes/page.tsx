'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useRecipes } from '@/hooks/production/useRecipes';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function ProductionRecipesPage() {
  const query = useRecipes();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Recipes unavailable" description={query.error?.message ?? 'No recipe data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Recipe Management" description="Track active recipe versions, flavours, chocolate types, and expected output." status="partial" />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Recipe' },
          { key: 'version', header: 'Version' },
          { key: 'status', header: 'Status' },
          { key: 'expected_output_quantity', header: 'Expected Output' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
