'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import type { ItemSelectorOption } from '@/hooks/useItemSelectorOptions';

function formatQuantity(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(3);
}

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(2);
}

function optionDisplayValue(option: ItemSelectorOption) {
  return option.label;
}

export function ItemSelectorField({
  disabled = false,
  emptyMessage = 'No items available.',
  errorMessage,
  loading = false,
  onChange,
  options,
  placeholder = 'Search item',
  value,
}: {
  disabled?: boolean;
  emptyMessage?: string;
  errorMessage?: string | null;
  loading?: boolean;
  onChange: (value: string) => void;
  options: ItemSelectorOption[];
  placeholder?: string;
  value: string;
}) {
  const datalistId = useId();
  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );
  const [inputValue, setInputValue] = useState(selectedOption ? optionDisplayValue(selectedOption) : '');

  useEffect(() => {
    setInputValue(selectedOption ? optionDisplayValue(selectedOption) : '');
  }, [selectedOption]);

  const labelToId = useMemo(
    () => new Map(options.map((option) => [optionDisplayValue(option), option.id])),
    [options],
  );

  const detailText = selectedOption
    ? `${selectedOption.code} | ${selectedOption.unitAbbreviation ?? selectedOption.unitName ?? 'Unit'} | Stock ${formatQuantity(selectedOption.warehouseQuantity ?? selectedOption.branchQuantity)} | Cost ${formatMoney(selectedOption.currentInventoryCost)} | Price ${formatMoney(selectedOption.sellingPrice)}`
    : null;

  return (
    <div className="space-y-2">
      <input
        className="surface-input-soft"
        disabled={disabled || loading || options.length === 0}
        list={datalistId}
        placeholder={
          loading
            ? 'Loading items...'
            : errorMessage
              ? 'Items unavailable'
              : options.length === 0
                ? emptyMessage
                : placeholder
        }
        value={inputValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputValue(nextValue);
          const selectedId = labelToId.get(nextValue);
          if (selectedId) {
            onChange(selectedId);
            return;
          }

          if (!nextValue) {
            onChange('');
          }
        }}
      />
      <datalist id={datalistId}>
        {options.map((option) => (
          <option key={option.id} value={optionDisplayValue(option)} />
        ))}
      </datalist>
      {errorMessage ? (
        <p className="text-xs text-rose-700">{errorMessage}</p>
      ) : !loading && options.length === 0 ? (
        <p className="text-xs text-muted">{emptyMessage}</p>
      ) : detailText ? (
        <p className="text-xs text-muted">{detailText}</p>
      ) : null}
    </div>
  );
}
