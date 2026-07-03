import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const PROCUREMENT_DOCUMENT_BUCKET = 'procurement-documents';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function ensureBucketExists() {
  const service = createServiceRoleClient();
  const { data, error } = await service.storage.getBucket(PROCUREMENT_DOCUMENT_BUCKET);

  if (!error && data) {
    return service;
  }

  const message = error?.message?.toLowerCase() ?? '';
  const missingBucket =
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('no rows') ||
    message.includes('bucket');

  if (!missingBucket) {
    throw new Error(error?.message ?? 'Failed to read procurement documents bucket.');
  }

  const { error: createError } = await service.storage.createBucket(PROCUREMENT_DOCUMENT_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
  });

  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw new Error(createError.message);
  }

  return service;
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write', 'procurement.supplier.write')) return forbidden();

  try {
    const formData = await request.formData();
    const uploaded = formData.get('file');

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ error: 'A supplier document file is required.' }, { status: 400 });
    }

    if (!uploaded.size) {
      return NextResponse.json({ error: 'The selected file is empty.' }, { status: 400 });
    }

    if (uploaded.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Supplier documents must be 10MB or smaller.' }, { status: 400 });
    }

    const service = await ensureBucketExists();
    const safeFileName = sanitizeFileName(uploaded.name || 'supplier-document');
    const filePath = `icecream_erp/organizations/${ctx.organizationId}/suppliers/${ctx.userId}/${Date.now()}-${randomUUID()}-${safeFileName}`;
    const fileBuffer = Buffer.from(await uploaded.arrayBuffer());

    const { error: uploadError } = await service.storage.from(PROCUREMENT_DOCUMENT_BUCKET).upload(filePath, fileBuffer, {
      cacheControl: '3600',
      contentType: uploaded.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = service.storage.from(PROCUREMENT_DOCUMENT_BUCKET).getPublicUrl(filePath);

    return NextResponse.json({
      documentName: uploaded.name,
      documentUrl: publicUrl,
      path: filePath,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to upload supplier document.');
  }
}
