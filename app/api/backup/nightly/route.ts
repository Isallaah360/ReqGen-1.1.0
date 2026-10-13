import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pruneNightly, storeBackup } from "@/lib/server/backupStore";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ReqGen v4.5 — the nightly job (Vercel Cron, 01:00 UTC = 02:00 Lagos; see vercel.json).
 * Vercel sends "Authorization: Bearer <CRON_SECRET>". It:
 *   1. keeps a full copy of the current financial year in the private backups store;
 *   2. sends the automatic request reminders (after 1 day; Registry + DG's office after 3);
 *   3. removes nightly copies older than 90 days (year-end copies stay).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return NextResponse.json({ ok: false, error: "Server environment variables are incomplete." }, { status: 500 });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const result: Record<string, unknown> = {};
  try { result.backup = await storeBackup(admin, { mode: "nightly", actorId: null, actorName: "ReqGen nightly backup" }); } catch (e) { result.backup = { error: e instanceof Error ? e.message : "failed" }; }
  const rem = await admin.rpc("reqgen_send_due_reminders");
  result.reminders = rem.error ? { error: rem.error.message } : rem.data;
  try { result.pruned = await pruneNightly(admin); } catch (e) { result.pruned = { error: e instanceof Error ? e.message : "failed" }; }
  return NextResponse.json({ ok: true, ...result });
}
