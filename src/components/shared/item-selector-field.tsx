'use client';

import { AlertCircle, Check, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ItemSelectorOption } from '@/hooks/useItemSelectorOptions';

function formatQuantity(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '0.000';
  return value.toFixed(3);
}

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(2);
}

function formatStockSummary(option: ItemSelectorOption) {
  if (!option.hasStockRecord) return 'No stock record';
  return `On Hand ${formatQuantity(option.quantityOnHand)} | Reserved ${formatQuantity(option.quantityReserved)} | Available ${formatQuantity(option.quantityAvailable)}`;
}

function formatCostSummary(option: ItemSelectorOption) {
  return option.currentInventoryCost === null ? 'Cost not configured' : `Cost ${formatMoney(option.currentInventoryCost)}`;
}

function optionDisplayValue(option: ItemSelectorOption) {
  return option.label;
}

function optionSearchText(option: ItemSelectorOption) {
  return [
    option.code,
    option.name,
    option.categoryName,
    option.itemType,
    option.unitAbbreviation,
    option.unitName,
    option.taxStatus,
    optionDisplayValue(option),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function ItemSelectorField({
  disabled = false,
  emptyMessage = 'No items available.',
  errorMessage,
  loading = false,
  onChange,
  onRetry,
  options,
  placeholder = 'Search item',
  value,
}: {
  disabled?: boolean;
  emptyMessage?: string;
  errorMessage?: string | null;
  loading?: boolean;
  onChange: (value: string) => void;
  onRetry?: (() => void | Promise<void>) | null;
  options: ItemSelectorOption[];
  placeholder?: string;
  value: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );
  const [inputValue, setInputValue] = useState(selectedOption ? optionDisplayValue(selectedOption) : '');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setInputValue(selectedOption ? optionDisplayValue(selectedOption) : '');
  }, [selectedOption]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = inputValue.trim().toLowerCase();
    if (!normalizedQuery) return options.slice(0, 12);
    return options
      .filter((option) => optionSearchText(option).includes(normalizedQuery))
      .slice(0, 12);
  }, [inputValue, options]);

  const detailText = selectedOption
    ? `${selectedOption.code} | ${selectedOption.unitAbbreviation ?? selectedOption.unitName ?? 'Unit'} | ${selectedOption.warehouseName ? `Warehouse ${selectedOption.warehouseName} | ` : ''}${formatStockSummary(selectedOption)} | ${formatCostSummary(selectedOption)} | Price ${formatMoney(selectedOption.sellingPrice)}`
    : null;

  const helperContent = (() => {
    if (errorMessage) {
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-rose-700">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="min-w-0 flex-1">{errorMessage}</span>
          {onRetry ? (
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
              onClick={() => void onRetry()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          ) : null}
        </div>
      );
    }

    if (!loading && options.length === 0) {
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="min-w-0 flex-1">{emptyMessage}</span>
          {onRetry ? (
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] px-2.5 text-xs font-semibold text-[color:var(--app-accent-strong)] transition hover:border-[color:var(--app-border-strong)] hover:bg-[color:var(--app-surface)]"
              onClick={() => void onRetry()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          ) : null}
        </div>
      );
    }

    if (detailText) {
      return <p className="text-xs text-muted">{detailText}</p>;
    }

    if (loading) {
      return <p className="text-xs text-muted">Loading items...</p>;
    }

    return <p className="text-xs text-muted">Search by item code or item name, then choose from the results.</p>;
  })();

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-subtle)]" />
        <input
          className="surface-input-soft pl-10 pr-10"
          disabled={disabled}
          placeholder={loading ? 'Loading items...' : placeholder}
          value={inputValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setInputValue(nextValue);
            setIsOpen(true);
            if (!nextValue.trim()) {
              onChange('');
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
              if (!selectedOption) {
                setInputValue((current) => current.trim());
              }
            }, 120);
          }}
        />
        {selectedOption ? (
          <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
        ) : null}

        {isOpen && !disabled ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[var(--app-shadow-lg)]">
            <div className="max-h-72 overflow-y-auto p-2">
              {loading ? (
                <div className="rounded-lg px-3 py-3 text-sm text-[color:var(--app-muted)]">Loading items...</div>
              ) : filteredOptions.length > 0 ? (
                <div className="space-y-1">
                  {filteredOptions.map((option) => {
                    const isSelected = option.id === value;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`flex w-full flex-col items-start gap-1 rounded-lg px-3 py-3 text-left transition ${
                          isSelected
                            ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]'
                            : 'hover:bg-[color:var(--app-bg-subtle)]'
                        }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setInputValue(optionDisplayValue(option));
                          setIsOpen(false);
                          onChange(option.id);
                        }}
                      >
                        <div className="flex w-full items-start justify-between gap-3">
                          <span className="min-w-0 text-sm font-semibold text-[color:var(--app-text)]">
                            {option.code ? `${option.code} - ` : ''}
                            {option.name}
                          </span>
                          {isSelected ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" /> : null}
                        </div>
                        <div className="grid w-full gap-1 text-xs text-[color:var(--app-muted)] sm:grid-cols-2">
                          <span>{option.unitAbbreviation ?? option.unitName ?? 'Unit'}</span>
                          <span>{option.warehouseName ?? option.categoryName ?? 'Uncategorized'}</span>
                          <span>{formatStockSummary(option)}</span>
                          <span>{formatCostSummary(option)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg px-3 py-3 text-sm text-[color:var(--app-muted)]">
                  {options.length === 0 ? emptyMessage : 'No items found for this search. Try a different code or name.'}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {helperContent}
    </div>
  );
}
