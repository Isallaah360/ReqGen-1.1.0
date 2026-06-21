import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

function cleanOtp(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
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
    return jsonError("Unauthorized. Please log in again.", 401);
  }

  const userClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(token);

  if (userErr || !user) {
    return jsonError("Invalid session. Please log in again.", 401);
  }

  const body = await req.json().catch(() => null);
  const code = cleanOtp(body?.code);

  if (!/^\d{6}$/.test(code)) {
    return jsonError("Enter a valid 6-digit OTP.");
  }

  const { data: row, error } = await adminClient
    .from("sms_otps")
    .select("id,otp_hash,expires_at,used_at,attempts,channel,phone,email,created_at")
    .eq("user_id", user.id)
    .eq("purpose", "request_submission")
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return jsonError("Could not verify OTP: " + error.message, 500);
  }

  if (!row) {
    return jsonError("No active OTP found. Request a new OTP.");
  }

  if (row.used_at) {
    return jsonError("This OTP has already been used. Request a new OTP.");
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return jsonError("OTP has expired. Request a new OTP.");
  }

  const attempts = Number(row.attempts || 0);

  if (attempts >= 5) {
    return jsonError("Too many failed attempts. Request a new OTP.");
  }

  const incomingHash = hashOtp(code);

  if (incomingHash !== row.otp_hash) {
    await adminClient
      .from("sms_otps")
      .update({
        attempts: attempts + 1,
      })
      .eq("id", row.id);

    const attemptsLeft = Math.max(5 - (attempts + 1), 0);

    return jsonError(
      attemptsLeft > 0
        ? `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`
        : "Invalid OTP. Too many failed attempts. Request a new OTP."
    );
  }

  const { error: updateErr } = await adminClient
    .from("sms_otps")
    .update({
      used_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .is("used_at", null);

  if (updateErr) {
    return jsonError("OTP verified but could not be marked as used: " + updateErr.message, 500);
  }

  return NextResponse.json({
    ok: true,
    message: "OTP verified successfully.",
    channel: row.channel || null,
  });
}