'use client';

import { Button } from '@/components/ui/button';
import type { SalesMetaItem } from '@/hooks/sales/useSalesMeta';

export interface SalesLineDraft {
  discountPercent: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
}

export function createSalesLineDraft(): SalesLineDraft {
  return {
    discountPercent: '0',
    itemId: '',
    quantity: '1',
    unitPrice: '0',
  };
}

export function salesLineTotal(line: SalesLineDraft) {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  const discountPercent = Number(line.discountPercent || 0);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !Number.isFinite(discountPercent)) return 0;
  return quantity * unitPrice * (1 - discountPercent / 100);
}

export function normalizeSalesLines(lines: SalesLineDraft[]) {
  return lines
    .filter((line) => line.itemId)
    .map((line) => ({
      discountPercent: Number(line.discountPercent || 0),
      itemId: line.itemId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
    }));
}

interface SalesLineItemsEditorProps {
  items: SalesMetaItem[];
  lines: SalesLineDraft[];
  onChange: (lines: SalesLineDraft[]) => void;
}

export function SalesLineItemsEditor({ items, lines, onChange }: SalesLineItemsEditorProps) {
  function updateLine(index: number, updates: Partial<SalesLineDraft>) {
    onChange(lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...updates } : line)));
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-cream/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Customer ordered items</p>
          <p className="mt-1 text-sm text-muted">Select the products, quantities, prices, and discounts for this sale.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...lines, createSalesLineDraft()])}>
          Add Item
        </Button>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={`${index}-${line.itemId}`} className="grid gap-3 md:grid-cols-[1fr_110px_130px_110px_auto]">
            <select
              className="surface-input-soft"
              value={line.itemId}
              onChange={(event) => {
                const item = items.find((row) => row.id === event.target.value);
                updateLine(index, {
                  itemId: event.target.value,
                  unitPrice: item ? String(item.defaultPrice ?? 0) : line.unitPrice,
                });
              }}
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code ? `${item.code} - ` : ''}
                  {item.name} ({item.availableQuantity} available)
                </option>
              ))}
            </select>
            <input
              className="surface-input-soft"
              min="0.001"
              step="0.001"
              type="number"
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: event.target.value })}
            />
            <input
              className="surface-input-soft"
              min="0"
              step="0.01"
              type="number"
              value={line.unitPrice}
              onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
            />
            <input
              className="surface-input-soft"
              max="100"
              min="0"
              step="0.01"
              type="number"
              value={line.discountPercent}
              onChange={(event) => updateLine(index, { discountPercent: event.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(lines.length === 1 ? lines : lines.filter((_, lineIndex) => lineIndex !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
