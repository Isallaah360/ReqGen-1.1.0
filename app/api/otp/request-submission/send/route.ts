import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeNigerianPhone, sendSendchampSms } from "@/lib/sendchamp";
import { sendSendchampEmail } from "@/lib/sendchampEmail";

export const runtime = "nodejs";

type OtpChannel = "sms" | "email" | "email_sms";

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
  const raw = String(
    process.env.NEXT_PUBLIC_REQGEN_REQUEST_OTP_CHANNEL || "sms"
  )
    .trim()
    .toLowerCase();

  if (raw === "email") return "email";
  if (raw === "email_sms") return "email_sms";
  return "sms";
}

function safeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
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
  const recipientEmail = safeEmail(profile.email || user.email);
  const phone = normalizeNigerianPhone(profile.phone);

  const canSendSms = smsEnabled() && !!phone;
  const canSendEmail =
    emailEnabled() && !!recipientEmail && recipientEmail.includes("@");

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

  if (channel === "email_sms" && !canSendSms && !canSendEmail) {
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
    const secondsAgo =
      (Date.now() - new Date(recent.created_at).getTime()) / 1000;

    if (secondsAgo < 60) {
      return jsonError("Please wait at least 60 seconds before requesting another OTP.");
    }
  }

  const otp = makeOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const otpChannelToStore: OtpChannel =
    channel === "email_sms"
      ? canSendSms && canSendEmail
        ? "email_sms"
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

  if (insertErr) return jsonError("Could not create OTP: " + insertErr.message, 500);

  const subject = "ReqGen Request Submission OTP";

  const text = `Assalamu Alaikum,

Your ReqGen request submission OTP is ${otp}.

This OTP expires in 5 minutes. Do not share it with anyone.

IET REQGEN Security Notification`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px;color:#1d4ed8">ReqGen Request Submission OTP</h2>
      <p>Assalamu Alaikum,</p>
      <p>Your ReqGen request submission OTP is:</p>
      <div style="font-size:28px;font-weight:800;letter-spacing:6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 18px;text-align:center;color:#1e3a8a">
        ${otp}
      </div>
      <p>This OTP expires in <b>5 minutes</b>. Do not share it with anyone.</p>
      <p style="margin-top:18px;color:#475569">IET REQGEN Security Notification</p>
    </div>
  `;

  const smsMessage = `Your ReqGen OTP is ${otp}. It expires in 5 minutes. Do not share it.`;

  let smsResult: any = null;
  let emailResult: any = null;

  let smsSent = false;
  let emailSent = false;

  let smsError: string | null = null;
  let emailError: string | null = null;

  if ((channel === "sms" || channel === "email_sms") && canSendSms) {
    try {
      smsResult = await sendSendchampSms({
        to: phone,
        message: smsMessage,
        route: (process.env.SENDCHAMP_ROUTE as any) || "dnd",
      });

      smsSent = true;

      await adminClient.from("sms_logs").insert({
        recipient_user_id: user.id,
        phone,
        email: recipientEmail || null,
        channel: "sms",
        message: smsMessage,
        provider: "sendchamp-sms",
        route: process.env.SENDCHAMP_ROUTE || "dnd",
        status: "sent",
        provider_response: smsResult,
        sent_by: user.id,
      });
    } catch (e: any) {
      smsError = e?.message || "SMS OTP failed.";

      await adminClient.from("sms_logs").insert({
        recipient_user_id: user.id,
        phone,
        email: recipientEmail || null,
        channel: "sms",
        message: smsMessage,
        provider: "sendchamp-sms",
        route: process.env.SENDCHAMP_ROUTE || "dnd",
        status: "failed",
        error: smsError,
        provider_response: smsResult,
        sent_by: user.id,
      });
    }
  }

  if ((channel === "email" || channel === "email_sms") && canSendEmail) {
    try {
      emailResult = await sendSendchampEmail({
        toEmail: recipientEmail,
        toName: profile.full_name,
        subject,
        text,
        html,
      });

      emailSent = true;

      await adminClient.from("sms_logs").insert({
        recipient_user_id: user.id,
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
      emailError = e?.message || "Email OTP failed.";

      await adminClient.from("sms_logs").insert({
        recipient_user_id: user.id,
        phone,
        email: recipientEmail,
        channel: "email",
        message: text,
        provider: "sendchamp-email",
        route: null,
        status: "failed",
        error: emailError,
        provider_response: emailResult,
        sent_by: user.id,
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
    smsSent && emailSent
      ? "SMS and email"
      : smsSent
      ? "SMS"
      : "email";

  return NextResponse.json({
    ok: true,
    message: `OTP sent successfully by ${deliveryLabel}.`,
    channel: smsSent && emailSent ? "email_sms" : smsSent ? "sms" : "email",
    phone: smsSent ? phone : null,
    email: emailSent ? recipientEmail : null,
    smsWarning: !smsSent && smsError ? smsError : null,
    emailWarning: !emailSent && emailError ? emailError : null,
    expiresInMinutes: 5,
  });
}