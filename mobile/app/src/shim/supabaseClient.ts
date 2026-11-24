import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "../lib/core";

/**
 * 3.0.2: the website's data helpers (lib/v4/*) import `supabase` from "@/lib/supabaseClient".
 * In the app that name points here: the same signed-in database client the app already uses,
 * with the same rules (RLS) and the same code-check retry. It is ready before any office opens.
 */
let client: SupabaseClient | null = null;
export async function readyClient() { client = await db(); return client; }
void readyClient();
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, key) {
    if (!client) throw new Error("ReqGen is still connecting. Please try again in a moment.");
    const v = (client as unknown as Record<string | symbol, unknown>)[key];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(client) : v;
  },
});
