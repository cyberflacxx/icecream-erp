import { NextRequest } from 'next/server';

import { POST as openBranchShift } from '../../../../branch-operations/[branchId]/shift-closes/route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return openBranchShift(request, {
    params: Promise.resolve({ branchId: id }),
  });
}
