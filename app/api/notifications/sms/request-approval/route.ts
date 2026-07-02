import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeEmail,
  normalizeNigerianPhone,
  sendSendchampEmail,
  sendSendchampSms,
} from "@/lib/sendchamp";

export const runtime = "nodejs";

type RequestRow = {
  id: string;
  request_no: string | null;
  title: string | null;
  current_owner: string | null;
  created_by: string | null;
  current_stage: string | null;
};

type RecipientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type LogChannel = "sms" | "email";
type LogStatus = "sent" | "failed";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function smsEnabled() {
  return String(process.env.SENDCHAMP_SMS_ENABLED || "false").toLowerCase() === "true";
}

function emailEnabled() {
  return String(process.env.SENDCHAMP_EMAIL_ENABLED || "false").toLowerCase() === "true";
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://req-gen-1-1-0.vercel.app";
}

function safeText(value: string | null | undefined, fallback = "—") {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function safeName(value: string | null | undefined) {
  return safeText(value, "Staff");
}

function requestLink(requestId: string) {
  return `${appUrl()}/requests/${requestId}`;
}

function buildApprovalSubject(requestNo: string) {
  return `IET REQGEN | Approval Required - ${requestNo}`;
}

function buildApprovalEmailText(input: {
  recipientName: string;
  requestNo: string;
  title: string;
  stage: string;
  link: string;
}) {
  return `ISLAMIC EDUCATION TRUST
IET REQGEN WORKFLOW SYSTEM

Assalamu Alaikum ${input.recipientName},

A request is awaiting your review and approval on IET REQGEN.

REQUEST DETAILS
Request No: ${input.requestNo}
Title: ${input.title}
Current Stage: ${input.stage}

ACTION REQUIRED
Please log in to IET REQGEN and take the required action.

Request Link:
${input.link}

This is an automated approval notification from IET REQGEN.

Thank you.

ISLAMIC EDUCATION TRUST
IET REQGEN Notification`;
}

function buildApprovalSmsText(input: {
  requestNo: string;
  stage: string;
  link: string;
}) {
  return `IET REQGEN: Request ${input.requestNo} awaits your approval. Stage: ${input.stage}. Please log in: ${input.link}`;
}

async function insertLog(
  adminClient: any,
  input: {
    requestId: string;
    recipientUserId: string;
    phone: string | null;
    email: string | null;
    channel: LogChannel;
    message: string;
    provider: string;
    route?: string | null;
    status: LogStatus;
    error?: string | null;
    providerResponse?: unknown;
    sentBy: string;
  }
) {
  const { error } = await adminClient.from("sms_logs").insert({
    request_id: input.requestId,
    recipient_user_id: input.recipientUserId,
    phone: input.phone,
    email: input.email,
    channel: input.channel,
    message: input.message,
    provider: input.provider,
    route: input.route || null,
    status: input.status,
    error: input.error || null,
    provider_response: input.providerResponse || null,
    sent_by: input.sentBy,
  });

  if (error) {
    console.error("ReqGen approval notification log insert failed:", {
      channel: input.channel,
      status: input.status,
      error: error.message,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return jsonError("Unauthorized.", 401);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonError("Server environment variables are incomplete.", 500);
    }

    const userClient = createClient(supabaseUrl, anonKey);
    const adminClient = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser(token);

    if (userErr || !user) {
      return jsonError("Invalid session.", 401);
    }

    const body = await req.json().catch(() => null);
    const requestId = String(body?.requestId || "").trim();

    if (!requestId) {
      return jsonError("requestId is required.");
    }

    const { data: requestRow, error: requestErr } = await adminClient
      .from("requests")
      .select("id,request_no,title,current_owner,created_by,current_stage")
      .eq("id", requestId)
      .single();

    if (requestErr || !requestRow) {
      return jsonError("Request not found.", 404);
    }

    const requestData = requestRow as RequestRow;

    if (requestData.created_by !== user.id && requestData.current_owner !== user.id) {
      return jsonError("You are not allowed to send notifications for this request.", 403);
    }

    if (!requestData.current_owner) {
      return jsonError("This request has no current approval officer.");
    }

    const { data: recipientRow, error: recipientErr } = await adminClient
      .from("profiles")
      .select("id,full_name,email,phone")
      .eq("id", requestData.current_owner)
      .single();

    if (recipientErr || !recipientRow) {
      return jsonError("Recipient profile not found.", 404);
    }

    const recipient = recipientRow as RecipientRow;

    const recipientName = safeName(recipient.full_name);
    const recipientEmail = normalizeEmail(recipient.email);
    const phone = normalizeNigerianPhone(recipient.phone);

    const requestNo = safeText(requestData.request_no, "Request");
    const title = safeText(requestData.title, "Request");
    const stage = safeText(requestData.current_stage, "Pending Review");
    const link = requestLink(requestData.id);

    const subject = buildApprovalSubject(requestNo);

    const emailText = buildApprovalEmailText({
      recipientName,
      requestNo,
      title,
      stage,
      link,
    });

    const smsText = buildApprovalSmsText({
      requestNo,
      stage,
      link,
    });

    let emailResult: unknown = null;
    let smsResult: unknown = null;

    let emailSent = false;
    let smsSent = false;

    let emailError: string | null = null;
    let smsError: string | null = null;

    if (emailEnabled() && recipientEmail) {
      try {
        emailResult = await sendSendchampEmail({
          to: {
            email: recipientEmail,
            name: recipientName,
          },
          subject,
          text: emailText,
        });

        emailSent = true;

        await insertLog(adminClient as any, {
          requestId: requestData.id,
          recipientUserId: recipient.id,
          phone,
          email: recipientEmail,
          channel: "email",
          message: emailText,
          provider: "sendchamp-email",
          route: null,
          status: "sent",
          providerResponse: emailResult,
          sentBy: user.id,
        });
      } catch (emailErr: any) {
        emailError = emailErr?.message || "Email notification failed.";

        await insertLog(adminClient as any, {
          requestId: requestData.id,
          recipientUserId: recipient.id,
          phone,
          email: recipientEmail,
          channel: "email",
          message: emailText,
          provider: "sendchamp-email",
          route: null,
          status: "failed",
          error: emailError,
          providerResponse: emailResult,
          sentBy: user.id,
        });
      }
    } else if (emailEnabled() && !recipientEmail) {
      emailError = "Recipient email is missing or invalid.";

      await insertLog(adminClient as any, {
        requestId: requestData.id,
        recipientUserId: recipient.id,
        phone,
        email: recipient.email || null,
        channel: "email",
        message: emailText,
        provider: "sendchamp-email",
        route: null,
        status: "failed",
        error: emailError,
        providerResponse: null,
        sentBy: user.id,
      });
    }

    if (smsEnabled() && phone) {
      try {
        smsResult = await sendSendchampSms({
          to: phone,
          message: smsText,
          route: (process.env.SENDCHAMP_ROUTE as any) || "dnd",
        });

        smsSent = true;

        await insertLog(adminClient as any, {
          requestId: requestData.id,
          recipientUserId: recipient.id,
          phone,
          email: recipientEmail,
          channel: "sms",
          message: smsText,
          provider: "sendchamp-sms",
          route: process.env.SENDCHAMP_ROUTE || "dnd",
          status: "sent",
          providerResponse: smsResult,
          sentBy: user.id,
        });
      } catch (smsErr: any) {
        smsError = smsErr?.message || "SMS notification failed.";

        await insertLog(adminClient as any, {
          requestId: requestData.id,
          recipientUserId: recipient.id,
          phone,
          email: recipientEmail,
          channel: "sms",
          message: smsText,
          provider: "sendchamp-sms",
          route: process.env.SENDCHAMP_ROUTE || "dnd",
          status: "failed",
          error: smsError,
          providerResponse: smsResult,
          sentBy: user.id,
        });
      }
    } else if (smsEnabled() && !phone) {
      smsError = "Recipient phone number is missing or invalid.";

      await insertLog(adminClient as any, {
        requestId: requestData.id,
        recipientUserId: recipient.id,
        phone: recipient.phone || null,
        email: recipientEmail,
        channel: "sms",
        message: smsText,
        provider: "sendchamp-sms",
        route: process.env.SENDCHAMP_ROUTE || "dnd",
        status: "failed",
        error: smsError,
        providerResponse: null,
        sentBy: user.id,
      });
    }

    if (!emailSent && !smsSent) {
      return jsonError(
        emailError || smsError || "Approval notification could not be delivered through SMS or Email.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        emailSent && smsSent
          ? "Email and SMS approval notifications sent."
          : emailSent
          ? "Email approval notification sent."
          : "SMS approval notification sent.",
      recipient: recipientName,
      emailSent,
      smsSent,
      emailError,
      smsError,
    });
  } catch (e: any) {
    return jsonError(e?.message || "Unexpected server error.", 500);
  }
}