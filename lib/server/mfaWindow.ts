import "server-only";
import crypto from "crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

/**
 * ReqGen v4.0.0 — shared server helpers for the 12-hour two-factor window
 * (see app/api/auth/mfa-trust/route.ts) and for fingerprint / passcode sign-in.
 */

export const WINDOW_SECONDS = 12 * 60 * 60;
export const WINDOW_COOKIE_PATH = "/api/auth/mfa-trust";

export function serverSecret() {
  const value = process.env.MFA_TRUST_SECRET || process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("The 2FA window secret is not configured.");
  return value;
}

export function windowCookieName(userId: string) {
  return `rg_mfa_${userId.replace(/[^a-f0-9]/gi, "").slice(0, 12)}`;
}

export function hmac(payload: string) {
  return crypto.createHmac("sha256", serverSecret()).update(payload).digest("base64url");
}

export function sameText(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1] || "";
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function verifiedTotpIds(user: User) {
  return (user.factors || []).filter((f) => f.factor_type === "totp" && f.status === "verified").map((f) => f.id);
}

export function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anon, service, ok: !!(url && anon && service) };
}

export function adminClient(): SupabaseClient {
  const { url, service } = env();
  return createClient(url!, service!, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The signed-in caller (Bearer token), or null. */
export async function callerFrom(req: NextRequest) {
  const { url, anon } = env();
  if (!url || !anon) return null;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token, claims: decodeJwt(token) };
}

/** Does this request carry a valid 12-hour window cookie for the user? */
export function windowValid(req: NextRequest, user: User) {
  const raw = req.cookies.get(windowCookieName(user.id))?.value || "";
  const [userId, factorId, exp, mac] = raw.split(".");
  if (!userId || !factorId || !exp || !mac) return null;
  if (!sameText(mac, hmac(`${userId}.${factorId}.${exp}`))) return null;
  if (userId !== user.id) return null;
  if (!verifiedTotpIds(user).includes(factorId)) return null;
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) return null;
  return { factorId, expiresAt };
}

/**
 * Starts a fresh 12-hour window from now. Used after a fingerprint check,
 * which counts as the second factor (Build Reference §10).
 */
export function setWindowCookie(res: NextResponse, user: User) {
  const factors = verifiedTotpIds(user);
  if (!factors.length) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + WINDOW_SECONDS;
  const payload = `${user.id}.${factors[0]}.${expiresAt}`;
  res.cookies.set(windowCookieName(user.id), `${payload}.${hmac(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: WINDOW_COOKIE_PATH,
    maxAge: WINDOW_SECONDS,
  });
  return new Date(expiresAt * 1000).toISOString();
}

/** Short-lived signed value in an httpOnly cookie (WebAuthn challenges). */
export function signedValue(value: string, ttlSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${value}.${exp}`;
  return `${payload}.${hmac(payload)}`;
}

export function readSignedValue(raw: string | undefined | null) {
  const parts = String(raw || "").split(".");
  if (parts.length !== 3) return null;
  const [value, exp, mac] = parts;
  if (!sameText(mac, hmac(`${value}.${exp}`))) return null;
  if (Number(exp) * 1000 <= Date.now()) return null;
  return value;
}

/** Mints a one-time sign-in token for a user (no email is sent). */
export async function oneTimeSignIn(admin: SupabaseClient, userId: string) {
  const who = await admin.auth.admin.getUserById(userId);
  const email = who.data.user?.email;
  if (who.error || !email) return { error: "This account cannot be found." };
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return { error: "Could not start the session. Use your password instead." };
  return { tokenHash, email, user: who.data.user! };
}

export function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

/** Very small in-memory rate limit (per server instance) as a first guard. */
const hits = new Map<string, { n: number; until: number }>();
export function rateLimited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.until < now) { hits.set(key, { n: 1, until: now + windowMs }); return false; }
  cur.n += 1;
  return cur.n > max;
}
