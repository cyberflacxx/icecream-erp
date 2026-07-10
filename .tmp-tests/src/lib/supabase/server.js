"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = createClient;
exports.createServiceRoleClient = createServiceRoleClient;
const ssr_1 = require("@supabase/ssr");
const supabase_js_1 = require("@supabase/supabase-js");
const headers_1 = require("next/headers");
const fetch_1 = require("./fetch");
async function createClient() {
    const cookieStore = await (0, headers_1.cookies)();
    return (0, ssr_1.createServerClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        db: { schema: 'icecream_erp' },
        global: { fetch: (0, fetch_1.createSupabaseFetch)() },
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                }
                catch {
                    // Called from Server Component — cookies are read-only, ignore
                }
            },
        },
    });
}
function createServiceRoleClient() {
    return (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        db: { schema: 'icecream_erp' },
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (0, fetch_1.createSupabaseFetch)() },
    });
}
