import { NextRequest } from 'next/server';

import {
  GET as getBranchExpenses,
  POST as postBranchExpenses,
} from '../../../branch-operations/[branchId]/expenses/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return getBranchExpenses(request, { params: Promise.resolve({ branchId: id }) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return postBranchExpenses(request, { params: Promise.resolve({ branchId: id }) });
}
