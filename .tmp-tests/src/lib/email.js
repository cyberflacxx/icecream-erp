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
exports.OTP_EMAIL_FAILURE_MESSAGE = void 0;
exports.getSmtpConfig = getSmtpConfig;
exports.getSmtpReadiness = getSmtpReadiness;
exports.sendTransactionalEmail = sendTransactionalEmail;
exports.OTP_EMAIL_FAILURE_MESSAGE = 'OTP could not be sent. Please contact the system administrator.';
function firstConfiguredEnv(keys, normalizer) {
    for (const key of keys) {
        const rawValue = String(process.env[key] ?? '').trim();
        const value = normalizer ? normalizer(rawValue) : rawValue;
        if (value)
            return value;
    }
    return '';
}
function normalizeSecretValue(value) {
    return value.replace(/\s+/g, '');
}
function getSmtpConfig() {
    return {
        from: firstConfiguredEnv(['SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM']),
        host: firstConfiguredEnv(['SMTP_HOST', 'EMAIL_HOST']),
        pass: firstConfiguredEnv(['SMTP_PASS', 'EMAIL_PASS', 'EMAIL_APP_PASSWORD'], normalizeSecretValue),
        port: firstConfiguredEnv(['SMTP_PORT', 'EMAIL_PORT']),
        secure: firstConfiguredEnv(['SMTP_SECURE', 'EMAIL_SECURE']),
        user: firstConfiguredEnv(['SMTP_USER', 'EMAIL_USER']),
    };
}
function getEmailFromAddress() {
    return getSmtpConfig().from || 'Absolute Ice Cream ERP <no-reply@absoluteicecream.local>';
}
function getSmtpReadiness() {
    const smtp = getSmtpConfig();
    if (!smtp.host) {
        return { ok: false, reason: 'SMTP host is not configured.' };
    }
    if (!smtp.user) {
        return { ok: false, reason: 'SMTP user is not configured.' };
    }
    if (!smtp.pass) {
        return { ok: false, reason: 'SMTP password is not configured.' };
    }
    if (!smtp.port) {
        return { ok: false, reason: 'SMTP port is not configured.' };
    }
    return { ok: true, reason: null };
}
function safeEmailErrorMessage(value) {
    if (!(value instanceof Error) || !value.message) {
        return 'Unknown email delivery error';
    }
    return value.message.slice(0, 300);
}
function safeEmailErrorCode(value) {
    if (typeof value === 'object' && value !== null && 'code' in value) {
        const code = String(value.code ?? '').trim();
        return code || 'UNKNOWN';
    }
    return 'UNKNOWN';
}
function logMissingSmtpRequirement(reason) {
    if (reason === 'SMTP host is not configured.') {
        console.error('OTP email config missing SMTP host.');
        return;
    }
    if (reason === 'SMTP user is not configured.') {
        console.error('OTP email config missing SMTP user.');
        return;
    }
    if (reason === 'SMTP password is not configured.') {
        console.error('OTP email config missing SMTP password.');
        return;
    }
    if (reason) {
        console.error('OTP email send failed with safe error code/message.', {
            code: 'SMTP_CONFIG_MISSING',
            message: reason,
        });
    }
}
function logSafeEmailSendFailure(error) {
    console.error('OTP email send failed with safe error code/message.', {
        code: safeEmailErrorCode(error),
        message: safeEmailErrorMessage(error),
    });
}
async function sendViaSmtp(message) {
    const smtp = getSmtpConfig();
    const nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer')));
    const transporter = nodemailer.createTransport({
        auth: {
            pass: smtp.pass,
            user: smtp.user,
        },
        host: smtp.host,
        port: Number(smtp.port),
        secure: String(smtp.secure).toLowerCase() === 'true',
    });
    return transporter.sendMail({
        from: getEmailFromAddress(),
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
    });
}
async function sendTransactionalEmail(message) {
    const readiness = getSmtpReadiness();
    if (!readiness.ok) {
        logMissingSmtpRequirement(readiness.reason);
    }
    else {
        try {
            return await sendViaSmtp(message);
        }
        catch (error) {
            logSafeEmailSendFailure(error);
        }
    }
    const apiKey = String(process.env.RESEND_API_KEY ?? '').trim();
    if (apiKey) {
        const to = Array.isArray(message.to) ? message.to : [message.to];
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: getEmailFromAddress(),
                    to,
                    subject: message.subject,
                    html: message.html,
                    text: message.text,
                }),
            });
            if (response.ok) {
                return response.json().catch(() => null);
            }
            const errorText = await response.text();
            logSafeEmailSendFailure({
                code: `RESEND_${response.status}`,
                message: errorText || response.statusText || 'Resend delivery failed',
            });
        }
        catch (error) {
            logSafeEmailSendFailure(error);
        }
    }
    throw new Error(exports.OTP_EMAIL_FAILURE_MESSAGE);
}
