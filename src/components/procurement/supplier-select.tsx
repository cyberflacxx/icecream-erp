'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatSupplierOptionLabel, useSupplierOptions } from '@/hooks/procurement';

interface SupplierSelectProps {
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}

export function SupplierSelect({
  className,
  disabled = false,
  onChange,
  placeholder = 'Select supplier',
  required = false,
  value,
}: SupplierSelectProps) {
  const supplierQuery = useSupplierOptions();
  const suppliers = supplierQuery.data ?? [];
  const loadFailed = supplierQuery.isError;
  const hasSuppliers = suppliers.length > 0;

  const helperMessage = loadFailed
    ? 'Unable to load suppliers right now. Please refresh and try again.'
    : !supplierQuery.isLoading && !hasSuppliers
      ? 'No suppliers found. Create a supplier first.'
      : null;

  return (
    <div className="space-y-2">
      <select
        required={required}
        disabled={disabled || supplierQuery.isLoading || loadFailed || !hasSuppliers}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn('surface-input-soft', className)}
      >
        <option value="">
          {supplierQuery.isLoading
            ? 'Loading suppliers...'
            : loadFailed
              ? 'Suppliers unavailable'
              : !hasSuppliers
                ? 'No suppliers found'
                : placeholder}
        </option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {formatSupplierOptionLabel(supplier)}
          </option>
        ))}
      </select>

      {helperMessage ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{helperMessage}</p>
          {loadFailed ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => void supplierQuery.refetch()}
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
