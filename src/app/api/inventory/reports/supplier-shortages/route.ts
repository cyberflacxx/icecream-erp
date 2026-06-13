import { NextRequest } from 'next/server';

export { GET } from '@/app/api/inventory/supplier-shortages/route';

export function POST(_request: NextRequest) {
  return new Response('Method Not Allowed', { status: 405 });
}
