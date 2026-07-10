"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupabaseNetworkTimeout = isSupabaseNetworkTimeout;
exports.createSupabaseFetch = createSupabaseFetch;
const DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS = 12000;
function readTimeoutMs() {
    const raw = process.env.SUPABASE_REQUEST_TIMEOUT_MS ??
        process.env.NEXT_PUBLIC_SUPABASE_REQUEST_TIMEOUT_MS;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
        return Math.max(1000, parsed);
    }
    return DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS;
}
function isSupabaseNetworkTimeout(error) {
    if (!(error instanceof Error))
        return false;
    return (error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        error.message.toLowerCase().includes('supabase request timed out'));
}
function createSupabaseFetch(timeoutMs = readTimeoutMs()) {
    return async (input, init = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort(new DOMException(`Supabase request timed out after ${timeoutMs}ms.`, 'TimeoutError'));
        }, timeoutMs);
        const upstreamSignal = init.signal;
        const abortFromUpstream = () => {
            controller.abort(upstreamSignal?.reason ?? new DOMException('Request aborted.', 'AbortError'));
        };
        if (upstreamSignal?.aborted) {
            clearTimeout(timeoutId);
            abortFromUpstream();
        }
        else {
            upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
        }
        try {
            return await fetch(input, { ...init, signal: controller.signal });
        }
        catch (error) {
            if (isSupabaseNetworkTimeout(error)) {
                throw new Error(`Supabase request timed out after ${timeoutMs}ms.`);
            }
            throw error;
        }
        finally {
            clearTimeout(timeoutId);
            upstreamSignal?.removeEventListener('abort', abortFromUpstream);
        }
    };
}
