import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildOtpEmailText,
  buildOtpSmsMessage,
  normalizeEmail,
  normalizeNigerianPhone,
  sendSendchampEmail,
  sendSendchampSms,
} from "@/lib/sendchamp";

export const runtime = "nodejs";

type OtpChannel = "sms" | "email" | "sms_email";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function hashOtp(code: string) {
  const secret =
    process.env.OTP_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "reqgen";

  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function smsEnabled() {
  return String(process.env.SENDCHAMP_SMS_ENABLED || "false").toLowerCase() === "true";
}

function emailEnabled() {
  return String(process.env.SENDCHAMP_EMAIL_ENABLED || "false").toLowerCase() === "true";
}

function requestedOtpChannel(): OtpChannel {
  const raw = String(process.env.NEXT_PUBLIC_REQGEN_REQUEST_OTP_CHANNEL || "sms_email")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (raw === "sms") return "sms";
  if (raw === "email") return "email";

  /*
    Accept both names for compatibility:
    - sms_email
    - email_sms
  */
  if (raw === "email_sms" || raw === "sms_email") return "sms_email";

  return "sms_email";
}

function safeName(value: unknown) {
  return String(value || "").trim() || "Staff";
}

async function insertSmsLog(
  adminClient: ReturnType<typeof createClient>,
  input: {
    recipientUserId: string;
    phone: string | null;
    email: string | null;
    channel: "sms" | "email";
    message: string;
    provider: string;
    route?: string | null;
    status: "sent" | "failed";
    error?: string | null;
    providerResponse?: unknown;
    sentBy: string;
  }
) {
  await adminClient.from("sms_logs").insert({
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

  const { data: profile, error: profErr } = await adminClient
    .from("profiles")
    .select("id,full_name,email,phone")
    .eq("id", user.id)
    .single();

  if (profErr || !profile) return jsonError("Profile not found.", 404);

  const channel = requestedOtpChannel();

  const recipientName = safeName(profile.full_name);
  const recipientEmail = normalizeEmail(profile.email || user.email);
  const phone = normalizeNigerianPhone(profile.phone);

  const canSendSms = smsEnabled() && !!phone;
  const canSendEmail = emailEnabled() && !!recipientEmail;

  if (channel === "sms" && !canSendSms) {
    return jsonError(
      "SMS OTP is enabled, but your registered phone number is missing or invalid. Update Profile first."
    );
  }

  if (channel === "email" && !canSendEmail) {
    return jsonError(
      "Email OTP is enabled, but email sending is disabled or your registered email is invalid."
    );
  }

  if (channel === "sms_email" && !canSendSms && !canSendEmail) {
    return jsonError(
      "No valid OTP delivery channel is available. Update your phone/email or contact Admin."
    );
  }

  const { data: recent } = await adminClient
    .from("sms_otps")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("purpose", "request_submission")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.created_at) {
    const secondsAgo = (Date.now() - new Date(recent.created_at).getTime()) / 1000;

    if (secondsAgo < 60) {
      return jsonError("Please wait at least 60 seconds before requesting another OTP.");
    }
  }

  const otp = makeOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const otpChannelToStore: OtpChannel =
    channel === "sms_email"
      ? canSendSms && canSendEmail
        ? "sms_email"
        : canSendSms
        ? "sms"
        : "email"
      : channel;

  const { data: insertedOtp, error: insertErr } = await adminClient
    .from("sms_otps")
    .insert({
      user_id: user.id,
      purpose: "request_submission",
      phone,
      email: recipientEmail || null,
      channel: otpChannelToStore,
      otp_hash: hashOtp(otp),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (insertErr) {
    return jsonError("Could not create OTP: " + insertErr.message, 500);
  }

  const smsMessage = buildOtpSmsMessage(otp);

  const emailSubject = "IET ReqGen Verification Code";
  const emailText = buildOtpEmailText({
    code: otp,
    name: recipientName,
    appName: "IET ReqGen",
  });

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto">
      <h2 style="margin:0 0 12px;color:#1d4ed8">IET ReqGen Verification Code</h2>
      <p>Dear ${recipientName},</p>
      <p>Your IET ReqGen verification code is:</p>
      <div style="font-size:30px;font-weight:800;letter-spacing:6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 18px;text-align:center;color:#1e3a8a">
        ${otp}
      </div>
      <p>This code expires shortly. Do not share it with anyone.</p>
      <p style="margin-top:18px;color:#475569">Thank you.<br />Islamic Education Trust</p>
    </div>
  `;

  let smsResult: unknown = null;
  let emailResult: unknown = null;

  let smsSent = false;
  let emailSent = false;

  let smsError: string | null = null;
  let emailError: string | null = null;

  if ((channel === "sms" || channel === "sms_email") && canSendSms && phone) {
    try {
      smsResult = await sendSendchampSms({
        to: phone,
        message: smsMessage,
        route: (process.env.SENDCHAMP_ROUTE as any) || "dnd",
      });

      smsSent = true;

      await insertSmsLog(adminClient, {
        recipientUserId: user.id,
        phone,
        email: recipientEmail,
        channel: "sms",
        message: smsMessage,
        provider: "sendchamp-sms",
        route: process.env.SENDCHAMP_ROUTE || "dnd",
        status: "sent",
        providerResponse: smsResult,
        sentBy: user.id,
      });
    } catch (e: any) {
      smsError = e?.message || "SMS OTP failed.";

      await insertSmsLog(adminClient, {
        recipientUserId: user.id,
        phone,
        email: recipientEmail,
        channel: "sms",
        message: smsMessage,
        provider: "sendchamp-sms",
        route: process.env.SENDCHAMP_ROUTE || "dnd",
        status: "failed",
        error: smsError,
        providerResponse: smsResult,
        sentBy: user.id,
      });
    }
  }

  if ((channel === "email" || channel === "sms_email") && canSendEmail && recipientEmail) {
    try {
      emailResult = await sendSendchampEmail({
        to: {
          email: recipientEmail,
          name: recipientName,
        },
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      });

      emailSent = true;

      await insertSmsLog(adminClient, {
        recipientUserId: user.id,
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
    } catch (e: any) {
      emailError = e?.message || "Email OTP failed.";

      await insertSmsLog(adminClient, {
        recipientUserId: user.id,
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
  }

  const delivered = smsSent || emailSent;

  if (!delivered) {
    if (insertedOtp?.id) {
      await adminClient.from("sms_otps").delete().eq("id", insertedOtp.id);
    }

    return jsonError(
      smsError || emailError || "OTP could not be delivered through the selected channel.",
      500
    );
  }

  const deliveryLabel =
    smsSent && emailSent ? "SMS and email" : smsSent ? "SMS" : "email";

  return NextResponse.json({
    ok: true,
    message: `OTP sent successfully by ${deliveryLabel}.`,
    channel: smsSent && emailSent ? "sms_email" : smsSent ? "sms" : "email",
    phone: smsSent ? phone : null,
    email: emailSent ? recipientEmail : null,
    smsWarning: !smsSent && smsError ? smsError : null,
    emailWarning: !emailSent && emailError ? emailError : null,
    expiresInMinutes: 5,
  });
}