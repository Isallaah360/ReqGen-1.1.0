import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeNigerianPhone, sendSendchampSms } from "@/lib/sendchamp";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function hashOtp(code: string) {
  const secret = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "reqgen";
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
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
    .select("id,full_name,phone")
    .eq("id", user.id)
    .single();

  if (profErr || !profile) return jsonError("Profile not found.", 404);

  const phone = normalizeNigerianPhone(profile.phone);

  if (!phone) {
    return jsonError("Your profile phone number is missing or invalid. Update Profile first.");
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
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error: insertErr } = await adminClient.from("sms_otps").insert({
    user_id: user.id,
    purpose: "request_submission",
    phone,
    otp_hash: otpHash,
    expires_at: expiresAt,
  });

  if (insertErr) return jsonError("Could not create OTP: " + insertErr.message, 500);

  const message = `Assalamu Alaikum. Your ReqGen request submission OTP is ${otp}. It expires in 5 minutes. Do not share it.`;

  let smsResult: any = null;

  try {
    smsResult = await sendSendchampSms({
      to: phone,
      message,
      route: "dnd",
    });

    await adminClient.from("sms_logs").insert({
      recipient_user_id: user.id,
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
      message: "OTP sent successfully.",
      phone,
      expiresInMinutes: 5,
    });
  } catch (e: any) {
    await adminClient.from("sms_logs").insert({
      recipient_user_id: user.id,
      phone,
      message,
      provider: "sendchamp",
      route: "dnd",
      status: "failed",
      error: e?.message || "SMS failed.",
      provider_response: smsResult,
      sent_by: user.id,
    });

    return jsonError("OTP SMS failed: " + (e?.message || "Unknown SMS error."), 500);
  }
}