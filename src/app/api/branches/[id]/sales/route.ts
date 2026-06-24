import { NextRequest } from 'next/server';

import {
  GET as getBranchSales,
  POST as postBranchSales,
} from '../../../branch-operations/[branchId]/sales/route';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return getBranchSales(request, { params: Promise.resolve({ branchId: id }) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return postBranchSales(request, { params: Promise.resolve({ branchId: id }) });
}
