import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { accountProblem } from "@/lib/server/staffAuth";
import { normalizeEmail, normalizeNigerianPhone, sendSendchampEmail, sendSendchampSms } from "@/lib/sendchamp";

export const runtime = "nodejs";

/**
 * ReqGen v4.5 — remind the officer a request is waiting for (Request Tracking).
 * POST { requestId } with the caller's Bearer token.
 * The database decides who may remind and keeps one reminder an hour
 * (reqgen_request_remind: in-app alert + reminder log). This route then adds
 * the SMS and email. Messages carry the request NUMBER only — never its title
 * or amount, because Registry may send them.
 */

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
const flag = (name: string) => String(process.env[name] || "false").toLowerCase() === "true";

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return fail("Server environment variables are incomplete.", 500);
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("Unauthorized.", 401);

  let requestId = "";
  try { requestId = String(((await req.json()) as { requestId?: string }).requestId || "").trim(); } catch { return fail("Invalid request body."); }
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return fail("Request is required.");

  // 1. in-app reminder through the database (role check and one-an-hour rule live there)
  const user = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth, error: authError } = await user.auth.getUser(token);
  if (authError || !auth.user) return fail("Unauthorized.", 401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const problem = await accountProblem(admin, auth.user.id);
  if (problem) return fail(problem, 403);
  const { error: remindError } = await user.rpc("reqgen_request_remind", { p_request_id: requestId, p_automatic: false });
  if (remindError) return fail(remindError.message, /an hour/i.test(remindError.message) ? 429 : 403);

  // 2. SMS and email to whoever holds it now
  const { data: reqRow } = await admin.from("requests").select("id,request_no,current_stage,current_owner,assigned_account_officer_user_id").eq("id", requestId).maybeSingle();
  const r = reqRow as { id: string; request_no: string | null; current_stage: string | null; current_owner: string | null; assigned_account_officer_user_id: string | null } | null;
  const ownerId = r?.current_owner || r?.assigned_account_officer_user_id;
  if (!r || !ownerId) return NextResponse.json({ ok: true, recipient: null, sms: "skipped", email: "skipped" });
  const { data: person } = await admin.from("profiles").select("id,full_name,email,phone").eq("id", ownerId).maybeSingle();
  const p = person as { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const link = `${appUrl}/requests/${r.id}`;
  const text = `IET REQGEN: Reminder - request ${r.request_no || ""} is waiting for you at ${r.current_stage || "your step"}. Please log in: ${link}`;
  let sms = "skipped", email = "skipped";
  const phone = normalizeNigerianPhone(p?.phone);
  if (flag("SENDCHAMP_SMS_ENABLED") && phone) {
    try { await sendSendchampSms({ to: phone, message: text }); sms = "sent"; } catch (e) { sms = e instanceof Error ? `failed: ${e.message}` : "failed"; }
  } else if (!phone) sms = "no phone";
  const mail = normalizeEmail(p?.email);
  if (flag("SENDCHAMP_EMAIL_ENABLED") && mail) {
    try {
      await sendSendchampEmail({ to: { email: mail, name: p?.full_name }, subject: `IET REQGEN | Reminder - ${r.request_no || "a request"} is waiting for you`, text: `ISLAMIC EDUCATION TRUST\nIET REQGEN\n\nAssalamu Alaikum ${p?.full_name || ""},\n\nRequest ${r.request_no || ""} is waiting for you at ${r.current_stage || "your step"}.\n\nPlease log in:\n${link}\n\nThank you.\nIET REQGEN Notification` });
      email = "sent";
    } catch (e) { email = e instanceof Error ? `failed: ${e.message}` : "failed"; }
  } else if (!mail) email = "no email";
  return NextResponse.json({ ok: true, recipient: p?.full_name || "Officer", sms, email });
}
