import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { normalizeTransferStatus, toNumber } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

type IntegrityIssue = {
  description: string;
  issueType: string;
  item: string | null;
  recommendedAction: string;
  reference: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  warehouse: string | null;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    const service = createServiceRoleClient();
    const issues: IntegrityIssue[] = [];

    const [balancesResult, transfersResult, movementsResult, grnsResult] = await Promise.all([
      service
        .from('stock_balances')
        .select('id, item_id, warehouse_id, quantity_on_hand, quantity_available, items!item_id(name, code), warehouses!warehouse_id(name, code)')
        .eq('organization_id', auth.ctx.organizationId),
      service
        .from('stock_transfers')
        .select('id, transfer_number, status, from_warehouse_id, to_warehouse_id')
        .eq('organization_id', auth.ctx.organizationId),
      service
        .from('stock_movements')
        .select('id, item_id, warehouse_id, movement_type, reference_id, reference_type')
        .eq('organization_id', auth.ctx.organizationId)
        .in('reference_type', ['stock_transfer', 'goods_received_note']),
      service
        .from('goods_received_notes')
        .select('id, grn_number, status, warehouse_id')
        .eq('organization_id', auth.ctx.organizationId),
    ]);

    if (balancesResult.error) throw balancesResult.error;
    if (transfersResult.error) throw transfersResult.error;
    if (movementsResult.error) throw movementsResult.error;
    if (grnsResult.error) throw grnsResult.error;

    for (const row of balancesResult.data ?? []) {
      const quantityOnHand = toNumber(row.quantity_on_hand);
      const quantityAvailable = toNumber(row.quantity_available);
      if (quantityOnHand >= 0 && quantityAvailable >= 0) continue;

      const item = Array.isArray(row.items) ? row.items[0] : row.items;
      const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;

      issues.push({
        description: `Negative stock detected. On hand: ${quantityOnHand}, available: ${quantityAvailable}.`,
        issueType: 'NEGATIVE_STOCK',
        item: item ? `${item.code ?? ''} ${item.name ?? ''}`.trim() : null,
        recommendedAction: 'Review recent inventory postings and correct the stock balance.',
        reference: String(row.id),
        severity: 'HIGH',
        warehouse: warehouse ? `${warehouse.code ?? ''} ${warehouse.name ?? ''}`.trim() : null,
      });
    }

    const movementRows = movementsResult.data ?? [];
    const transferMovements = movementRows.filter((row) => row.reference_type === 'stock_transfer');
    const transferMovementKeys = new Set(
      transferMovements.map(
        (row) =>
          `${row.reference_id}:${row.movement_type}:${row.warehouse_id}:${row.item_id}`,
      ),
    );

    const completedTransfers = (transfersResult.data ?? []).filter(
      (transfer) => normalizeTransferStatus(String(transfer.status ?? '')) === 'COMPLETED',
    );

    const completedTransferNumbers = new Map<string, number>();
    for (const transfer of completedTransfers) {
      const key = String(transfer.transfer_number ?? '');
      completedTransferNumbers.set(key, (completedTransferNumbers.get(key) ?? 0) + 1);
    }

    for (const transfer of completedTransfers) {
      const duplicateCount = completedTransferNumbers.get(String(transfer.transfer_number ?? '')) ?? 0;
      if (duplicateCount > 1) {
        issues.push({
          description: `Completed transfer reference ${transfer.transfer_number} appears ${duplicateCount} times.`,
          issueType: 'DUPLICATE_COMPLETED_TRANSFER',
          item: null,
          recommendedAction: 'Void duplicate transfers and keep a single authoritative transfer record.',
          reference: String(transfer.transfer_number ?? transfer.id),
          severity: 'HIGH',
          warehouse: null,
        });
      }

      const { data: transferItems, error: transferItemsError } = await service
        .from('stock_transfer_items')
        .select('item_id')
        .eq('transfer_id', transfer.id);
      if (transferItemsError) throw transferItemsError;

      for (const item of transferItems ?? []) {
        const outKey = `${transfer.id}:TRANSFER_OUT:${transfer.from_warehouse_id}:${item.item_id}`;
        const inKey = `${transfer.id}:TRANSFER_IN:${transfer.to_warehouse_id}:${item.item_id}`;

        if (!transferMovementKeys.has(outKey)) {
          issues.push({
            description: 'Completed transfer is missing its source TRANSFER_OUT ledger entry.',
            issueType: 'TRANSFER_MISSING_OUT_LEDGER',
            item: String(item.item_id),
            recommendedAction: 'Rebuild the missing source movement or reverse and repost the transfer.',
            reference: String(transfer.transfer_number ?? transfer.id),
            severity: 'HIGH',
            warehouse: String(transfer.from_warehouse_id),
          });
        }

        if (!transferMovementKeys.has(inKey)) {
          issues.push({
            description: 'Completed transfer is missing its destination TRANSFER_IN ledger entry.',
            issueType: 'TRANSFER_MISSING_IN_LEDGER',
            item: String(item.item_id),
            recommendedAction: 'Rebuild the missing destination movement or reverse and repost the transfer.',
            reference: String(transfer.transfer_number ?? transfer.id),
            severity: 'HIGH',
            warehouse: String(transfer.to_warehouse_id),
          });
        }
      }
    }

    for (const movement of transferMovements) {
      const duplicates = transferMovements.filter(
        (row) =>
          row.reference_id === movement.reference_id &&
          row.movement_type === movement.movement_type &&
          row.warehouse_id === movement.warehouse_id &&
          row.item_id === movement.item_id,
      );

      if (duplicates.length > 1) {
        issues.push({
          description: 'Transfer appears to have been posted more than once for the same item and warehouse.',
          issueType: 'TRANSFER_POSTED_TWICE',
          item: String(movement.item_id),
          recommendedAction: 'Investigate duplicate transfer ledger rows and reverse the duplicate posting.',
          reference: String(movement.reference_id),
          severity: 'HIGH',
          warehouse: String(movement.warehouse_id),
        });
      }
    }

    const grnMovements = new Set(
      movementRows
        .filter((row) => row.reference_type === 'goods_received_note')
        .map((row) => String(row.reference_id)),
    );

    for (const grn of (grnsResult.data ?? []).filter((row) => String(row.status ?? '').toUpperCase() === 'POSTED')) {
      if (grnMovements.has(String(grn.id))) continue;

      issues.push({
        description: 'GRN is marked POSTED but no inventory ledger entry exists.',
        issueType: 'GRN_POSTED_WITHOUT_LEDGER',
        item: null,
        recommendedAction: 'Repost the GRN or repair its inventory movement record.',
        reference: String(grn.grn_number ?? grn.id),
        severity: 'HIGH',
        warehouse: String(grn.warehouse_id ?? ''),
      });
    }

    return adminResponse(issues);
  } catch (error) {
    return adminError(error);
  }
}
