import crypto from "crypto";

/**
 * Server-only OTP hashing shared by the send and verify routes, so both
 * always use the identical secret. Preferred secret: OTP_HASH_SECRET.
 * Falls back to SUPABASE_SERVICE_ROLE_KEY (already required by both routes).
 * v3.0.1: the old hard-coded "reqgen" last-resort fallback has been removed —
 * with no secret configured, hashing now fails loudly instead of silently
 * using a guessable key.
 */
export function hashOtp(code: string): string {
  const secret = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("OTP hashing secret is not configured (set OTP_HASH_SECRET).");
  }
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}
