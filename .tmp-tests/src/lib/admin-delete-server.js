"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_DELETE_ENV_KEYS = void 0;
exports.resolveAdminActionKeyValidation = resolveAdminActionKeyValidation;
exports.requireAdminDeleteKey = requireAdminDeleteKey;
exports.recordProtectedActionAudit = recordProtectedActionAudit;
const server_1 = require("next/server");
const ADMIN_DELETE_ENV_KEYS = ['SYSTEM_ADMIN_DELETE_KEY', 'ADMIN_DELETE_KEY', 'ADMIN_KEY'];
exports.ADMIN_DELETE_ENV_KEYS = ADMIN_DELETE_ENV_KEYS;
function getConfiguredAdminDeleteKey() {
    for (const key of ADMIN_DELETE_ENV_KEYS) {
        const value = String(process.env[key] ?? '').trim();
        if (value)
            return value;
    }
    return null;
}
function extractAdminKey(request, body) {
    const bodyKey = String(body?.adminKey ?? body?.admin_key ?? '').trim();
    if (bodyKey)
        return bodyKey;
    const headerKey = request.headers.get('x-admin-delete-key') ?? request.headers.get('x-admin-key');
    return String(headerKey ?? '').trim();
}
function resolveAdminActionKeyValidation(input) {
    const configuredKey = getConfiguredAdminDeleteKey();
    const suppliedKey = extractAdminKey(input.request, input.body);
    const notConfiguredMessage = input.messages?.notConfigured ?? 'Admin action key is not configured.';
    const requiredMessage = input.messages?.required ?? 'Admin key is required.';
    const invalidMessage = input.messages?.invalid ?? 'Invalid admin key.';
    if (!configuredKey) {
        return { configuredKey: null, error: notConfiguredMessage, suppliedKey };
    }
    if (!suppliedKey) {
        return { configuredKey, error: requiredMessage, suppliedKey };
    }
    if (suppliedKey !== configuredKey) {
        return { configuredKey, error: invalidMessage, suppliedKey };
    }
    return { configuredKey, error: null, suppliedKey };
}
async function requireAdminDeleteKey(input) {
    const validation = resolveAdminActionKeyValidation({
        body: input.body,
        messages: input.messages,
        request: input.request,
    });
    const notConfiguredMessage = input.messages?.notConfigured ?? 'Admin action key is not configured.';
    const requiredMessage = input.messages?.required ?? 'Admin key is required.';
    const invalidMessage = input.messages?.invalid ?? 'Invalid admin key.';
    if (!validation.configuredKey) {
        return server_1.NextResponse.json({ error: notConfiguredMessage }, { status: 500 });
    }
    if (!validation.suppliedKey) {
        return server_1.NextResponse.json({ error: requiredMessage }, { status: 400 });
    }
    if (validation.error === invalidMessage) {
        const { recordSecurityEvent } = await Promise.resolve().then(() => __importStar(require('./security-server')));
        await recordSecurityEvent({
            organizationId: input.ctx.organizationId,
            userProfileId: input.ctx.userId,
            eventType: 'ADMIN_DELETE_KEY_FAILED',
            status: 'FAILED',
            details: {
                action: input.action,
                entityId: input.entityId,
                entityType: input.entityType,
            },
            ipAddress: input.request.headers.get('x-forwarded-for'),
            userAgent: input.request.headers.get('user-agent'),
        });
        return server_1.NextResponse.json({ error: invalidMessage }, { status: 403 });
    }
    return null;
}
async function recordProtectedActionAudit(input) {
    const { recordAuditLog } = await Promise.resolve().then(() => __importStar(require('./security-server')));
    await recordAuditLog({
        action: input.action,
        entityId: input.entityId,
        entityType: input.entityType,
        newValues: input.newValues ?? null,
        oldValues: input.oldValues ?? null,
        organizationId: input.ctx.organizationId,
        userProfileId: input.ctx.userId,
        ipAddress: input.request.headers.get('x-forwarded-for'),
        userAgent: input.request.headers.get('user-agent'),
    });
}
