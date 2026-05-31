'use client';

import type { ChangeEvent } from 'react';

export interface FilterConfig {
  key: string;
  label: string;
  type: 'search' | 'select' | 'date-range' | 'date' | 'checkbox';
  value?: string;
  checked?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

interface FilterBarProps {
  filters: FilterConfig[];
  onFilterChange: (key: string, value: string) => void;
}

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap dark:border-darkBorder dark:bg-darkCard">
      {filters.map((filter) => {
        if (filter.type === 'select') {
          return (
            <label key={filter.key} className="flex min-w-[180px] flex-1 flex-col gap-2 text-sm text-muted dark:text-darkMuted">
              <span>{filter.label}</span>
              <select
                className="h-11 rounded-2xl border border-border bg-cream px-4 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
                value={filter.value ?? ''}
                onChange={(event) => onFilterChange(filter.key, event.target.value)}
              >
                <option value="">All</option>
                {filter.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (filter.type === 'date-range') {
          return (
            <label key={filter.key} className="flex min-w-[180px] flex-1 flex-col gap-2 text-sm text-muted dark:text-darkMuted">
              <span>{filter.label}</span>
              <input
                type="text"
                placeholder={filter.placeholder ?? 'Date range'}
                value={filter.value ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onFilterChange(filter.key, event.target.value)
                }
                className="h-11 rounded-2xl border border-border bg-cream px-4 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
              />
            </label>
          );
        }

        if (filter.type === 'date') {
          return (
            <label key={filter.key} className="flex min-w-[180px] flex-1 flex-col gap-2 text-sm text-muted dark:text-darkMuted">
              <span>{filter.label}</span>
              <input
                type="date"
                value={filter.value ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onFilterChange(filter.key, event.target.value)
                }
                className="h-11 rounded-2xl border border-border bg-cream px-4 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
              />
            </label>
          );
        }

        if (filter.type === 'checkbox') {
          return (
            <label
              key={filter.key}
              className="flex min-w-[180px] flex-1 items-end text-sm text-muted dark:text-darkMuted"
            >
              <span className="flex h-11 items-center gap-3 rounded-2xl border border-border bg-cream px-4 dark:border-darkBorder dark:bg-darkCard">
                <input
                  type="checkbox"
                  checked={filter.checked ?? false}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    onFilterChange(filter.key, String(event.target.checked))
                  }
                  className="h-4 w-4 rounded border-border text-orange focus:ring-orange dark:border-darkBorder"
                />
                {filter.label}
              </span>
            </label>
          );
        }

        return (
          <label key={filter.key} className="flex min-w-[220px] flex-[1.4] flex-col gap-2 text-sm text-muted dark:text-darkMuted">
            <span>{filter.label}</span>
            <input
              type="search"
              placeholder={filter.placeholder ?? 'Search'}
              value={filter.value ?? ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onFilterChange(filter.key, event.target.value)
              }
              className="h-11 rounded-2xl border border-border bg-cream px-4 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
            />
          </label>
        );
      })}
    </div>
  );
}
