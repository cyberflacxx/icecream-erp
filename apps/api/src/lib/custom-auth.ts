import { randomBytes, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import type { Request } from 'express';

import { env } from '../config/env';

export interface AuthTokenPayload {
  userId: string;
  workId: string;
  roleId: string;
  organizationId: string;
  sessionId: string;
}

const permissionAliases: Record<string, string[]> = {
  'procurement.supplier.view': ['supplier.read'],
  'procurement.supplier.manage': ['supplier.create', 'supplier.update'],
  'procurement.purchase_order.view': ['purchase_order.read'],
  'procurement.purchase_order.create': ['purchase_order.create'],
  'procurement.purchase_order.approve': ['purchase_order.approve'],
  'inventory.stock.view': ['inventory.read'],
  'inventory.stock.adjust': ['inventory.adjust'],
  'inventory.transfer.create': ['stock_transfer.create'],
  'inventory.transfer.approve': ['stock_transfer.approve'],
  'production.batch.view': ['production_batch.read'],
  'production.batch.start': ['production_batch.create'],
  'production.batch.close': ['production_batch.close'],
  'branch.sales.view': ['branch_sales.read'],
  'branch.sales.create': ['branch_sales.create'],
  'branch.shift_close.view': ['branch_shift.read', 'branch_shift.close'],
  'branch.shift_close.approve': ['branch_shift.approve', 'branch_shift.close'],
  'sales.customer.view': ['customer.read'],
  'sales.customer.manage': ['customer.manage'],
  'sales.invoice.view': ['invoice.read'],
  'sales.payment.view': ['payment.read'],
  'system.audit.view': ['audit_log.read'],
  'finance.account.view': ['finance.read'],
  'finance.account.manage': ['finance.manage', 'finance.read']
};

export function normalizePermissionCodes(codes: string[]) {
  return [...new Set(codes.flatMap((code) => [code, ...(permissionAliases[code] ?? [])]))];
}

export function getRequestToken(req: Request) {
  const authorization = req.header('authorization');

  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const cookieHeader = req.header('cookie');

  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookie(cookieHeader);
  return cookies.auth_token ?? null;
}

function parseDurationToMs(duration: string) {
  const normalized = duration.trim().toLowerCase();
  const match = normalized.match(/^(\d+)(ms|s|m|h|d)$/);

  if (!match) {
    return 8 * 60 * 60 * 1000;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === 'ms') {
    return value;
  }
  if (unit === 's') {
    return value * 1000;
  }
  if (unit === 'm') {
    return value * 60 * 1000;
  }
  if (unit === 'h') {
    return value * 60 * 60 * 1000;
  }

  return value * 24 * 60 * 60 * 1000;
}

export function getSessionMaxAgeMs() {
  return parseDurationToMs(env.JWT_EXPIRY);
}

export function createSessionToken() {
  return randomBytes(32).toString('hex');
}

export function createSessionId() {
  return randomUUID();
}

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRY as jwt.SignOptions['expiresIn']
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256']
  }) as AuthTokenPayload & { exp: number; iat: number };
}
