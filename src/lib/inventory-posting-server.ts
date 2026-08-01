type ServiceClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function buildInventoryPostingIdempotencyKey(input: {
  actorUserId: string;
  documentId: string;
  operation: string;
  suffix?: string | null;
}) {
  const suffix = input.suffix ? `:${input.suffix}` : '';
  return `${input.operation}:${input.documentId}:${input.actorUserId}${suffix}`;
}

export async function invokeInventoryPostingRpc<T>(
  service: ServiceClient,
  fn: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await service.rpc(fn, args);

  if (error) {
    throw new Error(error.message ?? `Failed to execute ${fn}.`);
  }

  return data as T;
}

export async function loadWarehouseBranchId(
  service: ServiceClient,
  warehouseId: string,
) {
  const { data, error } = await service
    .from('warehouses')
    .select('id, branch_id')
    .eq('id', warehouseId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? 'Warehouse was not found.');
  }

  return data.branch_id ? String(data.branch_id) : null;
}
