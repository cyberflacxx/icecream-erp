'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">
        Showing page {page} of {totalPages} across {total} records.
      </p>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
