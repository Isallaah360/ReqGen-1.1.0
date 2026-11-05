import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { accountProblem } from "@/lib/server/staffAuth";
import { normalizeEmail, normalizeNigerianPhone, sendSendchampEmail, sendSendchampSms } from "@/lib/sendchamp";

export const runtime = "nodejs";

/**
 * SMS + email after an officer acts on a request (approve, return, reject, pay, file).
 *
 * v4.6.9 fix: before, only the requester or the CURRENT owner could call this. After an
 * approval the request has already moved to the next officer, so the officer who just
 * approved was neither, the call was refused (403) and nobody was told. Now the officer who
 * acted on the request in the last 30 minutes may also call it.
 *
 * Who is told depends on where the request is now:
 *   waiting with an officer  → that officer ("awaits your approval")
 *   returned for correction  → the requester ("returned to you")
 *   completed / paid         → the requester ("completed")
 *   rejected / cancelled     → the requester ("not approved")
 */

type RequestRow = {
  id: string; request_no: string | null; title: string | null; current_owner: string | null; created_by: string | null;
  current_stage: string | null; status: string | null; assigned_account_officer_id: string | null;
};
type RecipientRow = { id: string; full_name: string | null; email: string | null; phone: string | null };
type Kind = "approval" | "returned" | "completed" | "rejected";

// On unless set to "false", and only when the Sendchamp key is present (v4.6.9: an unset switch no longer
// silently turns alerts off).
const flag = (name: string) => String(process.env[name] || "").toLowerCase() !== "false" && !!process.env.SENDCHAMP_API_KEY;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "https://req-gen-1-1-0.vercel.app";
const text = (v: string | null | undefined, fallback = "—") => String(v || "").trim() || fallback;
const key = (v: string | null | undefined) => String(v || "").toLowerCase().replace(/[\s_-]+/g, "");

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function kindOf(r: RequestRow): Kind {
  const stage = key(r.current_stage);
  const status = String(r.status || "").toLowerCase();
  if (/returned for correction/.test(status)) return "returned";
  if (["rejected", "cancelled", "deleted"].includes(stage) || /^rejected|^cancelled|^withdrawn/.test(status)) return "rejected";
  if (["completed", "closed", "paid"].includes(stage)) return "completed";
  return "approval";
}

function messages(kind: Kind, name: string, no: string, title: string, stage: string, link: string) {
  const head = `ISLAMIC EDUCATION TRUST\nIET REQGEN WORKFLOW SYSTEM\n\nAssalamu Alaikum ${name},\n\n`;
  const details = `REQUEST DETAILS\nRequest No: ${no}\nTitle: ${title}\nCurrent Stage: ${stage}\n\nRequest Link:\n${link}\n\nThis is an automated notification from IET REQGEN.\n\nThank you.\n\nISLAMIC EDUCATION TRUST\nIET REQGEN Notification`;
  switch (kind) {
    case "returned":
      return {
        subject: `IET REQGEN | Request Returned - ${no}`,
        email: `${head}Your request has been returned to you for correction on IET REQGEN. Please open it, read the reason, correct it and send it again.\n\n${details}`,
        sms: `IET REQGEN: Request ${no} was returned to you for correction. Please log in: ${link}`,
      };
    case "completed":
      return {
        subject: `IET REQGEN | Request Completed - ${no}`,
        email: `${head}Your request has been completed on IET REQGEN.\n\n${details}`,
        sms: `IET REQGEN: Request ${no} has been completed. Details: ${link}`,
      };
    case "rejected":
      return {
        subject: `IET REQGEN | Request Not Approved - ${no}`,
        email: `${head}Your request was not approved on IET REQGEN. Please open it to read the reason.\n\n${details}`,
        sms: `IET REQGEN: Request ${no} was not approved. Please log in to read the reason: ${link}`,
      };
    default:
      return {
        subject: `IET REQGEN | Approval Required - ${no}`,
        email: `${head}A request is awaiting your review and approval on IET REQGEN.\n\nACTION REQUIRED\nPlease log in to IET REQGEN and take the required action.\n\n${details}`,
        sms: `IET REQGEN: Request ${no} awaits your approval. Stage: ${stage}. Please log in: ${link}`,
      };
  }
}

async function log(admin: SupabaseClient, row: Record<string, unknown>) {
  const { error } = await admin.from("sms_logs").insert(row);
  if (error) console.error("ReqGen notification log insert failed:", error.message);
}

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonError("Unauthorized.", 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !service) return jsonError("Server environment variables are incomplete.", 500);

    const { data: auth, error: authErr } = await createClient(url, anon).auth.getUser(token);
    if (authErr || !auth.user) return jsonError("Invalid session.", 401);
    const user = auth.user;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const inactive = await accountProblem(admin, user.id);
    if (inactive) return jsonError(inactive, 403);

    const body = await req.json().catch(() => null);
    const requestId = String(body?.requestId || "").trim();
    if (!requestId) return jsonError("requestId is required.");

    const { data: rq, error: rqErr } = await admin.from("requests")
      .select("id,request_no,title,current_owner,created_by,current_stage,status,assigned_account_officer_id")
      .eq("id", requestId).single();
    if (rqErr || !rq) return jsonError("Request not found.", 404);
    const r = rq as RequestRow;

    // The requester, the officer holding it now, or the officer who has just acted on it.
    let allowed = r.created_by === user.id || r.current_owner === user.id;
    if (!allowed) {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const acted = await admin.from("request_history").select("id", { count: "exact", head: true })
        .eq("request_id", r.id).eq("action_by", user.id).gte("created_at", since);
      allowed = (acted.count || 0) > 0;
    }
    if (!allowed) return jsonError("You are not allowed to send notifications for this request.", 403);

    const kind = kindOf(r);
    const recipientId = kind === "approval" ? (r.current_owner || (key(r.current_stage) === "account" ? r.assigned_account_officer_id : null)) : r.created_by;
    if (!recipientId) return NextResponse.json({ ok: true, skipped: true, reason: "Nobody to tell at this step." });
    if (recipientId === user.id && kind === "approval") return NextResponse.json({ ok: true, skipped: true, reason: "The next officer is the person who acted." });

    const { data: rec, error: recErr } = await admin.from("profiles").select("id,full_name,email,phone").eq("id", recipientId).single();
    if (recErr || !rec) return jsonError("Recipient profile not found.", 404);
    const recipient = rec as RecipientRow;
    const name = text(recipient.full_name, "Staff");
    const email = normalizeEmail(recipient.email);
    const phone = normalizeNigerianPhone(recipient.phone);
    const link = `${appUrl()}/requests/${r.id}`;
    const m = messages(kind, name, text(r.request_no, "Request"), text(r.title, "Request"), text(r.current_stage, "Pending Review"), link);
    const route = (process.env.SENDCHAMP_ROUTE as "dnd" | "non_dnd" | "international" | undefined) || "dnd";
    const base = { request_id: r.id, recipient_user_id: recipient.id, phone, email, sent_by: user.id };

    let emailSent = false, smsSent = false;
    let emailError: string | null = null, smsError: string | null = null;

    if (flag("SENDCHAMP_EMAIL_ENABLED")) {
      if (!email) {
        emailError = "Recipient email is missing or invalid.";
        await log(admin, { ...base, email: recipient.email || null, channel: "email", message: m.email, provider: "sendchamp-email", status: "failed", error: emailError });
      } else {
        try {
          const res = await sendSendchampEmail({ to: { email, name }, subject: m.subject, text: m.email });
          emailSent = true;
          await log(admin, { ...base, channel: "email", message: m.email, provider: "sendchamp-email", status: "sent", provider_response: res || null });
        } catch (e) {
          emailError = e instanceof Error ? e.message : "Email notification failed.";
          await log(admin, { ...base, channel: "email", message: m.email, provider: "sendchamp-email", status: "failed", error: emailError });
        }
      }
    }

    if (flag("SENDCHAMP_SMS_ENABLED")) {
      if (!phone) {
        smsError = "Recipient phone number is missing or invalid.";
        await log(admin, { ...base, phone: recipient.phone || null, channel: "sms", message: m.sms, provider: "sendchamp-sms", route, status: "failed", error: smsError });
      } else {
        try {
          const res = await sendSendchampSms({ to: phone, message: m.sms, route });
          smsSent = true;
          await log(admin, { ...base, channel: "sms", message: m.sms, provider: "sendchamp-sms", route, status: "sent", provider_response: res || null });
        } catch (e) {
          smsError = e instanceof Error ? e.message : "SMS notification failed.";
          await log(admin, { ...base, channel: "sms", message: m.sms, provider: "sendchamp-sms", route, status: "failed", error: smsError });
        }
      }
    }

    if (!flag("SENDCHAMP_EMAIL_ENABLED") && !flag("SENDCHAMP_SMS_ENABLED")) {
      return jsonError("SMS and email are switched off on the server (SENDCHAMP_API_KEY is missing, or SENDCHAMP_SMS_ENABLED / SENDCHAMP_EMAIL_ENABLED are false).", 503);
    }
    if (!emailSent && !smsSent) return jsonError(emailError || smsError || "Notification could not be delivered through SMS or email.", 500);
    return NextResponse.json({ ok: true, kind, recipient: name, emailSent, smsSent, emailError, smsError });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Notification failed.", 500);
  }
}
