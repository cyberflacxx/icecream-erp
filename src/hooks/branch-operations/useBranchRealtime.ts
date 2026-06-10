'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function useBranchRealtime(
  branchId: string | undefined,
  handlers: {
    onSale?: () => void;
    onShiftClose?: () => void;
  },
) {
  useEffect(() => {
    if (!branchId || !supabaseUrl || !supabaseAnonKey) {
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const salesChannel = supabase
      .channel(`branch_sales_${branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          filter: `branch_id=eq.${branchId}`,
          schema: 'public',
          table: 'branch_sales'
        },
        () => {
          handlers.onSale?.();
        },
      )
      .subscribe();
    const shiftCloseChannel = supabase
      .channel(`branch_shift_close_${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `branch_id=eq.${branchId}`,
          schema: 'public',
          table: 'branch_shift_closes'
        },
        () => {
          handlers.onShiftClose?.();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(salesChannel);
      void supabase.removeChannel(shiftCloseChannel);
    };
  }, [branchId, handlers]);
}
