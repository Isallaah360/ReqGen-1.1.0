import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeNigerianPhone, sendSendchampSms } from "@/lib/sendchamp";
import { sendSendchampEmail } from "@/lib/sendchampEmail";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function smsEnabled() {
  return String(process.env.SENDCHAMP_SMS_ENABLED || "false").toLowerCase() === "true";
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonError("Server environment variables are incomplete.", 500);
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) return jsonError("Unauthorized.", 401);

  const userClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(token);

  if (userErr || !user) return jsonError("Invalid session.", 401);

  const body = await req.json().catch(() => null);
  const requestId = body?.requestId as string | undefined;
  const event = String(body?.event || "");

  if (!requestId) return jsonError("requestId is required.");

  const { data: requestRow, error: reqErr } = await adminClient
    .from("requests")
    .select("id,request_no,title,current_owner,created_by,current_stage")
    .eq("id", requestId)
    .single();

  if (reqErr || !requestRow) return jsonError("Request not found.", 404);

  let recipientUserId: string | null = null;
  let subject = "";
  let text = "";

  if (event === "submission_success") {
    recipientUserId = requestRow.created_by;
    subject = `ReqGen Request Submitted - ${requestRow.request_no}`;
    text = `Assalamu Alaikum,

Your ReqGen request ${requestRow.request_no} has been submitted successfully.

Title: ${requestRow.title || "Request"}
Current Stage: ${requestRow.current_stage || "Submitted"}

IET REQGEN Notification`;
  } else if (event === "approval_pending") {
    recipientUserId = requestRow.current_owner;
    subject = `ReqGen Approval Required - ${requestRow.request_no}`;
    text = `Assalamu Alaikum,

A ReqGen request ${requestRow.request_no} is awaiting your review and approval.

Title: ${requestRow.title || "Request"}
Current Stage: ${requestRow.current_stage || "Pending Review"}

Kindly log in and take the required action.

IET REQGEN Notification`;
  } else {
    return jsonError("Invalid notification event.");
  }

  if (!recipientUserId) return jsonError("No recipient found for this notification event.");

  const { data: recipient, error: recErr } = await adminClient
    .from("profiles")
    .select("id,full_name,email,phone")
    .eq("id", recipientUserId)
    .single();

  if (recErr || !recipient) return jsonError("Recipient profile not found.", 404);

  const recipientEmail = String(recipient.email || "").trim().toLowerCase();
  const phone = normalizeNigerianPhone(recipient.phone);

  if (!recipientEmail || !recipientEmail.includes("@")) {
    return jsonError("Recipient email is missing or invalid.");
  }

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px;color:#1d4ed8">${subject}</h2>
      <pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${text}</pre>
    </div>
  `;

  let emailResult: any = null;
  let smsResult: any = null;

  try {
    emailResult = await sendSendchampEmail({
      toEmail: recipientEmail,
      toName: recipient.full_name,
      subject,
      text,
      html,
    });

    await adminClient.from("sms_logs").insert({
      request_id: requestRow.id,
      recipient_user_id: recipient.id,
      phone,
      email: recipientEmail,
      channel: "email",
      message: text,
      provider: "sendchamp-email",
      route: null,
      status: "sent",
      provider_response: emailResult,
      sent_by: user.id,
    });
  } catch (e: any) {
    await adminClient.from("sms_logs").insert({
      request_id: requestRow.id,
      recipient_user_id: recipient.id,
      phone,
      email: recipientEmail,
      channel: "email",
      message: text,
      provider: "sendchamp-email",
      route: null,
      status: "failed",
      error: e?.message || "Email notification failed.",
      provider_response: emailResult,
      sent_by: user.id,
    });

    return jsonError("Email notification failed: " + (e?.message || "Unknown email error."), 500);
  }

  if (smsEnabled() && phone) {
    const smsMessage =
      event === "submission_success"
        ? `Your ReqGen request ${requestRow.request_no} was submitted successfully.`
        : `A ReqGen request ${requestRow.request_no} awaits your approval. Kindly log in.`;

    try {
      smsResult = await sendSendchampSms({
        to: phone,
        message: smsMessage,
        route: (process.env.SENDCHAMP_ROUTE as any) || "dnd",
      });

      await adminClient.from("sms_logs").insert({
        request_id: requestRow.id,
        recipient_user_id: recipient.id,
        phone,
        email: recipientEmail,
        channel: "sms",
        message: smsMessage,
        provider: "sendchamp-sms",
        route: process.env.SENDCHAMP_ROUTE || "dnd",
        status: "sent",
        provider_response: smsResult,
        sent_by: user.id,
      });
    } catch (e: any) {
      await adminClient.from("sms_logs").insert({
        request_id: requestRow.id,
        recipient_user_id: recipient.id,
        phone,
        email: recipientEmail,
        channel: "sms",
        message: smsMessage,
        provider: "sendchamp-sms",
        route: process.env.SENDCHAMP_ROUTE || "dnd",
        status: "failed",
        error: e?.message || "SMS notification failed.",
        provider_response: smsResult,
        sent_by: user.id,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    message: smsEnabled() && phone ? "Email notification sent. SMS attempted." : "Email notification sent.",
    event,
    recipient: recipient.full_name,
  });
}