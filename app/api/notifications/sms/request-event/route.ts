import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeNigerianPhone, sendSendchampSms } from "@/lib/sendchamp";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
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
  let message = "";

  if (event === "submission_success") {
    recipientUserId = requestRow.created_by;
    message = `Assalamu Alaikum. Your ReqGen request ${requestRow.request_no} was submitted successfully. Jazakumullahu Khairan.`;
  } else if (event === "approval_pending") {
    recipientUserId = requestRow.current_owner;
    message = `Assalamu Alaikum. A ReqGen request ${requestRow.request_no} awaits your approval. Kindly log in. Jazakumullahu Khairan.`;
  } else {
    return jsonError("Invalid SMS event.");
  }

  if (!recipientUserId) return jsonError("No recipient found for this SMS event.");

  const { data: recipient, error: recErr } = await adminClient
    .from("profiles")
    .select("id,full_name,phone")
    .eq("id", recipientUserId)
    .single();

  if (recErr || !recipient) return jsonError("Recipient profile not found.", 404);

  const phone = normalizeNigerianPhone(recipient.phone);

  if (!phone) return jsonError("Recipient phone number is missing or invalid.");

  let smsResult: any = null;

  try {
    smsResult = await sendSendchampSms({
      to: phone,
      message,
      route: "dnd",
    });

    await adminClient.from("sms_logs").insert({
      request_id: requestRow.id,
      recipient_user_id: recipient.id,
      phone,
      message,
      provider: "sendchamp",
      route: "dnd",
      status: "sent",
      provider_response: smsResult,
      sent_by: user.id,
    });

    return NextResponse.json({
      ok: true,
      message: "SMS sent successfully.",
      event,
      recipient: recipient.full_name,
    });
  } catch (e: any) {
    await adminClient.from("sms_logs").insert({
      request_id: requestRow.id,
      recipient_user_id: recipient.id,
      phone,
      message,
      provider: "sendchamp",
      route: "dnd",
      status: "failed",
      error: e?.message || "SMS failed.",
      provider_response: smsResult,
      sent_by: user.id,
    });

    return jsonError("SMS failed: " + (e?.message || "Unknown SMS error."), 500);
  }
}