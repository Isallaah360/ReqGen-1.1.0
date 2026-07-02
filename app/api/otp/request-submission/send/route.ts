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
type LogChannel = "sms" | "email";
type LogStatus = "sent" | "failed";

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra || {}) }, { status });
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

function boolEnv(name: string) {
  return String(process.env[name] || "false").trim().toLowerCase() === "true";
}

function smsEnabled() {
  return boolEnv("SENDCHAMP_SMS_ENABLED");
}

function emailEnabled() {
  return boolEnv("SENDCHAMP_EMAIL_ENABLED");
}

function normalizeOtpChannel(value: unknown): OtpChannel {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  if (raw === "sms") return "sms";
  if (raw === "email") return "email";

  if (
    raw === "sms_email" ||
    raw === "email_sms" ||
    raw === "smsemail" ||
    raw === "emailsms"
  ) {
    return "sms_email";
  }

  return "sms_email";
}

function requestedOtpChannel(): OtpChannel {
  return normalizeOtpChannel(process.env.NEXT_PUBLIC_REQGEN_REQUEST_OTP_CHANNEL || "sms_email");
}

function wantsSms(channel: OtpChannel) {
  return channel === "sms" || channel === "sms_email";
}

function wantsEmail(channel: OtpChannel) {
  return channel === "email" || channel === "sms_email";
}

function safeName(value: unknown) {
  return String(value || "").trim() || "Staff";
}

async function insertLog(
  adminClient: any,
  input: {
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
    console.error("ReqGen OTP log insert failed:", {
      channel: input.channel,
      status: input.status,
      error: error.message,
    });
  }
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

  if (!token) {
    return jsonError("Unauthorized.", 401);
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

  const { data: profile, error: profErr } = await adminClient
    .from("profiles")
    .select("id,full_name,email,phone")
    .eq("id", user.id)
    .single();

  if (profErr || !profile) {
    return jsonError("Profile not found.", 404);
  }

  const channel = requestedOtpChannel();

  const recipientName = safeName(profile.full_name);
  const recipientEmail = normalizeEmail(profile.email || user.email);
  const phone = normalizeNigerianPhone(profile.phone);

  const smsIsEnabled = smsEnabled();
  const emailIsEnabled = emailEnabled();

  const shouldSendSms = wantsSms(channel);
  const shouldSendEmail = wantsEmail(channel);

  const canSendSms = shouldSendSms && smsIsEnabled && !!phone;
  const canSendEmail = shouldSendEmail && emailIsEnabled && !!recipientEmail;

  const debug = {
    rawConfiguredChannel: process.env.NEXT_PUBLIC_REQGEN_REQUEST_OTP_CHANNEL || null,
    normalizedChannel: channel,
    shouldSendSms,
    shouldSendEmail,
    smsEnabled: smsIsEnabled,
    emailEnabled: emailIsEnabled,
    hasValidPhone: !!phone,
    hasValidEmail: !!recipientEmail,
    canSendSms,
    canSendEmail,
  };

  if (shouldSendSms && !canSendSms && !shouldSendEmail) {
    return jsonError(
      "SMS OTP is enabled, but your registered phone number is missing or invalid. Update Profile first.",
      400,
      { debug }
    );
  }

  if (shouldSendEmail && !canSendEmail && !shouldSendSms) {
    return jsonError(
      "Email OTP is enabled, but email sending is disabled or your registered email is invalid.",
      400,
      { debug }
    );
  }

  if (shouldSendSms && shouldSendEmail && !canSendSms && !canSendEmail) {
    return jsonError(
      "No valid OTP delivery channel is available. Update your phone/email or contact Admin.",
      400,
      { debug }
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
      return jsonError("Please wait at least 60 seconds before requesting another OTP.", 400, {
        debug,
      });
    }
  }

  const otp = makeOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const otpChannelToStore: OtpChannel =
    shouldSendSms && shouldSendEmail
      ? "sms_email"
      : shouldSendSms
      ? "sms"
      : "email";

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
    return jsonError("Could not create OTP: " + insertErr.message, 500, { debug });
  }

  const smsMessage = buildOtpSmsMessage(otp);

  const emailSubject = "IET ReqGen OTP Verification Code";
  const emailText = buildOtpEmailText({
    code: otp,
    name: recipientName,
    appName: "IET ReqGen",
  });

  let smsResult: unknown = null;
  let emailResult: unknown = null;

  let smsSent = false;
  let emailSent = false;

  let smsError: string | null = null;
  let emailError: string | null = null;

  if (shouldSendSms) {
    if (!canSendSms || !phone) {
      smsError = !smsIsEnabled
        ? "SENDCHAMP_SMS_ENABLED is not true."
        : "No valid recipient phone number.";

      await insertLog(adminClient as any, {
        recipientUserId: user.id,
        phone,
        email: recipientEmail,
        channel: "sms",
        message: smsMessage,
        provider: "sendchamp-sms",
        route: process.env.SENDCHAMP_ROUTE || "dnd",
        status: "failed",
        error: smsError,
        providerResponse: debug,
        sentBy: user.id,
      });
    } else {
      try {
        smsResult = await sendSendchampSms({
          to: phone,
          message: smsMessage,
          route: (process.env.SENDCHAMP_ROUTE as any) || "dnd",
        });

        smsSent = true;

        await insertLog(adminClient as any, {
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

        await insertLog(adminClient as any, {
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
  }

  if (shouldSendEmail) {
    if (!canSendEmail || !recipientEmail) {
      emailError = !emailIsEnabled
        ? "SENDCHAMP_EMAIL_ENABLED is not true."
        : "No valid recipient email address.";

      await insertLog(adminClient as any, {
        recipientUserId: user.id,
        phone,
        email: recipientEmail,
        channel: "email",
        message: emailText,
        provider: "sendchamp-email",
        route: null,
        status: "failed",
        error: emailError,
        providerResponse: debug,
        sentBy: user.id,
      });
    } else {
      try {
        emailResult = await sendSendchampEmail({
          to: {
            email: recipientEmail,
            name: recipientName,
          },
          subject: emailSubject,
          text: emailText,
        });

        emailSent = true;

        await insertLog(adminClient as any, {
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

        await insertLog(adminClient as any, {
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
  }

  const delivered = smsSent || emailSent;

  if (!delivered) {
    if (insertedOtp?.id) {
      await adminClient.from("sms_otps").delete().eq("id", insertedOtp.id);
    }

    return jsonError(
      smsError || emailError || "OTP could not be delivered through the selected channel.",
      500,
      {
        debug: {
          ...debug,
          smsSent,
          emailSent,
          smsError,
          emailError,
        },
      }
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
    debug: {
      ...debug,
      smsSent,
      emailSent,
      smsError,
      emailError,
    },
  });
}