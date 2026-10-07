import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail, normalizeNigerianPhone, sendSendchampEmail, sendSendchampSms } from "@/lib/sendchamp";

export const runtime = "nodejs";

/**
 * ReqGen v3.1.7 — remind the officer a payment voucher is waiting for.
 * POST { voucherId } with the caller's Bearer token. Only Account Officers,
 * the Auditor and Admin may send. Sends an in-app notification, an SMS and an
 * email (where enabled and the recipient has a phone / email), logs the
 * delivery, and records "Reminder" in the voucher history. One reminder per
 * voucher every 30 minutes.
 */

type Voucher = {
  id: string;
  voucher_no: string | null;
  request_id: string | null;
  payee_name: string | null;
  amount: number | null;
  total_amount: number | null;
  status: string | null;
  cheque_signed_by: string | null;
  cheque_counter_signed_by: string | null;
};

type Person = { id: string; full_name: string | null; email: string | null; phone: string | null; role: string | null };

const COOLDOWN_MINUTES = 30;

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function flag(name: string) {
  return String(process.env[name] || "false").toLowerCase() === "true";
}

function roleKey(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function holdersOf(admin: SupabaseClient, keys: string[]): Promise<Person[]> {
  const [profiles, extra] = await Promise.all([
    admin.from("profiles").select("id,full_name,email,phone,role"),
    admin.from("profile_roles").select("profile_id,role_key,is_active"),
  ]);
  const ids = new Set<string>();
  for (const p of (profiles.data || []) as Person[]) if (keys.includes(roleKey(p.role))) ids.add(p.id);
  for (const r of (extra.data || []) as Array<{ profile_id: string; role_key: string | null; is_active: boolean | null }>) {
    if (r.is_active !== false && keys.includes(roleKey(r.role_key))) ids.add(r.profile_id);
  }
  return ((profiles.data || []) as Person[]).filter((p) => ids.has(p.id));
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return fail("Server environment variables are incomplete.", 500);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("Unauthorized.", 401);

  const userClient = createClient(url, anon);
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth.user) return fail("Unauthorized.", 401);

  const admin = createClient(url, service);
  const senderKeys = ["admin", "auditor", "account", "accounts", "accountofficer"];
  const senders = await holdersOf(admin, senderKeys);
  const sender = senders.find((p) => p.id === auth.user.id);
  if (!sender) return fail("Only Account Officers, the Auditor and Admin can send voucher reminders.", 403);

  let voucherId = "";
  try {
    const body = (await req.json()) as { voucherId?: string };
    voucherId = String(body.voucherId || "").trim();
  } catch {
    return fail("Invalid request body.");
  }
  if (!voucherId) return fail("Voucher is required.");

  const { data: voucherData, error: voucherError } = await admin
    .from("payment_vouchers")
    .select("id,voucher_no,request_id,payee_name,amount,total_amount,status,cheque_signed_by,cheque_counter_signed_by")
    .eq("id", voucherId)
    .maybeSingle();
  if (voucherError) return fail(voucherError.message, 500);
  const voucher = voucherData as Voucher | null;
  if (!voucher) return fail("Payment voucher not found.", 404);
  const status = voucher.status || "";
  if (!status.startsWith("Pending")) return fail("This voucher is not waiting for a signature.");

  const { data: lastReminder } = await admin
    .from("payment_voucher_history")
    .select("created_at")
    .eq("voucher_id", voucher.id)
    .eq("action_type", "Reminder")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastReminder?.created_at) {
    const minutes = (Date.now() - new Date(lastReminder.created_at as string).getTime()) / 60000;
    if (minutes < COOLDOWN_MINUTES) {
      return fail(`A reminder was sent ${Math.max(1, Math.floor(minutes))} minute(s) ago. Please wait ${Math.ceil(COOLDOWN_MINUTES - minutes)} more minute(s).`, 429);
    }
  }

  // Who the voucher is waiting for.
  let recipients: Person[] = [];
  let stepLabel = "";
  const byIds = async (ids: Array<string | null>) => {
    const clean = ids.filter(Boolean) as string[];
    if (!clean.length) return [] as Person[];
    const { data } = await admin.from("profiles").select("id,full_name,email,phone,role").in("id", clean);
    return (data || []) as Person[];
  };
  if (status === "Pending Check") {
    if (!voucher.cheque_signed_by || !voucher.cheque_counter_signed_by) {
      return fail("Assign the Cheque Signer and Counter Signer first. The voucher is waiting for the Account Officer.");
    }
    recipients = await holdersOf(admin, ["auditor"]);
    stepLabel = "check (Auditor)";
  } else if (status === "Pending Cheque Signature") {
    recipients = await byIds([voucher.cheque_signed_by]);
    stepLabel = "signature (Cheque Signer)";
  } else if (status === "Pending Counter Signature") {
    recipients = await byIds([voucher.cheque_counter_signed_by]);
    stepLabel = "counter signature (Counter Signer)";
  } else if (status === "Pending DG Authorisation") {
    recipients = await holdersOf(admin, ["dg", "directorgeneral"]);
    stepLabel = "authorisation (Director General)";
  }
  if (!recipients.length) return fail("Nobody currently holds this signing step. Ask the Administrator to check the roles.");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://req-gen-1-1-0.vercel.app";
  const link = `/approvals/vouchers/${voucher.id}`;
  const amount = `N${Math.round(Number(voucher.total_amount ?? voucher.amount ?? 0)).toLocaleString("en-NG")}`;
  const pvNo = voucher.voucher_no || "Payment voucher";
  const senderName = sender.full_name || "Account Office";
  const smsText = `IET REQGEN: Reminder - PV ${pvNo} (${amount}, ${voucher.payee_name || "payee"}) is waiting for your ${stepLabel}. Please log in: ${appUrl}${link}`;

  const results: Array<{ name: string; inApp: boolean; sms: string; email: string }> = [];
  for (const person of recipients) {
    const entry = { name: person.full_name || "Officer", inApp: false, sms: "skipped", email: "skipped" };

    const { error: notifyError } = await admin.from("notifications").insert({
      user_id: person.id,
      title: `Reminder: PV ${pvNo} is waiting for your ${stepLabel}`,
      link,
      is_read: false,
    });
    entry.inApp = !notifyError;

    const phone = normalizeNigerianPhone(person.phone);
    if (flag("SENDCHAMP_SMS_ENABLED") && phone) {
      try {
        await sendSendchampSms({ to: phone, message: smsText });
        entry.sms = "sent";
      } catch (error) {
        entry.sms = error instanceof Error ? `failed: ${error.message}` : "failed";
      }
    } else if (!phone) {
      entry.sms = "no phone";
    }

    const email = normalizeEmail(person.email);
    if (flag("SENDCHAMP_EMAIL_ENABLED") && email) {
      try {
        await sendSendchampEmail({
          to: { email, name: person.full_name },
          subject: `IET REQGEN | Reminder - PV ${pvNo} awaits your ${stepLabel}`,
          text: `ISLAMIC EDUCATION TRUST\nIET REQGEN\n\nAssalamu Alaikum ${person.full_name || ""},\n\nThis is a reminder from ${senderName} that payment voucher ${pvNo} (${amount}, payee ${voucher.payee_name || "—"}) is waiting for your ${stepLabel}.\n\nPlease log in and sign:\n${appUrl}${link}\n\nThank you.\nIET REQGEN Notification`,
        });
        entry.email = "sent";
      } catch (error) {
        entry.email = error instanceof Error ? `failed: ${error.message}` : "failed";
      }
    } else if (!email) {
      entry.email = "no email";
    }

    if (voucher.request_id) {
      for (const channel of ["sms", "email"] as const) {
        const outcome = channel === "sms" ? entry.sms : entry.email;
        if (outcome === "skipped" || outcome.startsWith("no ")) continue;
        await admin.from("sms_logs").insert({
          request_id: voucher.request_id,
          recipient_user_id: person.id,
          phone: channel === "sms" ? phone : null,
          email: channel === "email" ? email : null,
          channel,
          message: channel === "sms" ? smsText : `PV ${pvNo} reminder email`,
          provider: "sendchamp",
          status: outcome === "sent" ? "sent" : "failed",
          error: outcome === "sent" ? null : outcome,
          sent_by: auth.user.id,
        });
      }
    }
    results.push(entry);
  }

  await admin.from("payment_voucher_history").insert({
    voucher_id: voucher.id,
    request_id: voucher.request_id,
    action_by: auth.user.id,
    actor_id: auth.user.id,
    actor_name: senderName,
    actor_role: sender.role,
    action_type: "Reminder",
    from_status: status,
    to_status: status,
    comment: `Reminder sent to ${results.map((r) => r.name).join(", ")}.`,
  });

  return NextResponse.json({ ok: true, voucherNo: pvNo, step: stepLabel, recipients: results });
}
