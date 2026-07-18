'use client';

import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useProcurementRequest } from '@/hooks/procurement';

type WarehousePickerOption = {
  id: string;
  code?: string | null;
  name: string;
  label: string;
  warehouseType?: string | null;
  warehouse_type?: string | null;
  branchId?: string | null;
  branch_id?: string | null;
  status?: string | null;
};

interface WarehouseSelectProps {
  value?: string | null;
  onChange: (warehouseId: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

export function WarehouseSelect({
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Select warehouse',
}: WarehouseSelectProps) {
  const request = useProcurementRequest();
  const warehousesQuery = useQuery({
    queryKey: ['inventory', 'warehouse-picker'],
    queryFn: async () => {
      const response = await request<{ success?: boolean; data?: WarehousePickerOption[] }>(
        '/api/inventory/warehouses?picker=true',
      );
      return response.data ?? [];
    },
  });

  const warehouses = warehousesQuery.data ?? [];

  return (
    <div className="space-y-2">
      <select
        required={required}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || warehousesQuery.isLoading}
        className="surface-input-soft"
      >
        <option value="">
          {warehousesQuery.isLoading ? 'Loading warehouses...' : placeholder}
        </option>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.label}
          </option>
        ))}
      </select>

      {warehousesQuery.isError ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-rose-600">
          <span>Unable to load warehouses right now.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void warehousesQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!warehousesQuery.isLoading && !warehousesQuery.isError && warehouses.length === 0 ? (
        <p className="text-xs text-muted">No warehouses found. Create a warehouse first.</p>
      ) : null}
    </div>
  );
}
