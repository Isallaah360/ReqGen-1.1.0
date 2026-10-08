import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * ReqGen v3.1.14 — 12-hour two-factor window.
 *
 * One authenticator code is valid for 12 hours on the device where it was
 * entered. Inside the window a person who signs in again (for example after
 * the 15-minute inactivity sign-out) is not asked for a new code. When the
 * window ends the person is signed out completely and must use a new code.
 *
 * The window is recorded in an httpOnly, signed cookie that only this server
 * can create:  <userId>.<factorId>.<expiresAtSeconds>.<hmac>
 *   - It starts at the moment Supabase recorded the TOTP verification (the
 *     "totp" entry of the token's amr claim), so it can never be stretched.
 *   - It is tied to the authenticator (factor). Replacing the authenticator
 *     ends every window at once, so a person who stole a password and a
 *     window loses it the moment the real owner changes their 2FA.
 *
 *  POST   (Bearer token at aal2)  start / confirm the window → { trusted, expiresAt }
 *  GET    (Bearer token)          is this device inside a valid window?
 *  DELETE                          end the window on this device
 */

const WINDOW_SECONDS = 12 * 60 * 60;

type Amr = { method?: string; timestamp?: number };

function secret() {
  const value = process.env.MFA_TRUST_SECRET || process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("The 2FA window secret is not configured.");
  return value;
}

function cookieName(userId: string) {
  return `rg_mfa_${userId.replace(/[^a-f0-9]/gi, "").slice(0, 12)}`;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1] || "";
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function verifiedFactorIds(user: User) {
  return (user.factors || []).filter((f) => f.factor_type === "totp" && f.status === "verified").map((f) => f.id);
}

async function caller(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { error: NextResponse.json({ ok: false, error: "Server environment variables are incomplete." }, { status: 500 }) };
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }) };
  // getUser also rejects a session that was signed out elsewhere.
  const { data, error } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  if (error || !data.user) {
    // Only a definite "this session is gone" answer signs the person out.
    // A network hiccup to Supabase must never sign anybody out.
    const status = Number((error as { status?: number } | null)?.status || 0);
    const definite = !error || status === 401 || status === 403 || status === 404;
    return definite
      ? { error: NextResponse.json({ ok: false, error: "Unauthorized.", signedOut: true }, { status: 401 }) }
      : { error: NextResponse.json({ ok: false, error: "Could not reach the sign-in service." }, { status: 503 }) };
  }
  return { user: data.user, claims: decodeJwt(token) };
}

function readWindow(req: NextRequest, user: User) {
  const raw = req.cookies.get(cookieName(user.id))?.value || "";
  const [userId, factorId, exp, mac] = raw.split(".");
  if (!userId || !factorId || !exp || !mac) return null;
  if (!same(mac, sign(`${userId}.${factorId}.${exp}`))) return null;
  if (userId !== user.id) return null;
  if (!verifiedFactorIds(user).includes(factorId)) return null; // authenticator replaced
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) return null;
  return { factorId, expiresAt };
}

export async function GET(req: NextRequest) {
  const who = await caller(req);
  if ("error" in who) return who.error;
  const window = readWindow(req, who.user);
  return NextResponse.json({ ok: true, trusted: !!window, expiresAt: window ? new Date(window.expiresAt * 1000).toISOString() : null });
}

export async function POST(req: NextRequest) {
  const who = await caller(req);
  if ("error" in who) return who.error;
  const { user, claims } = who;
  if (claims.aal !== "aal2") {
    return NextResponse.json({ ok: false, error: "Enter your authenticator code first." }, { status: 403 });
  }
  const factors = verifiedFactorIds(user);
  if (!factors.length) return NextResponse.json({ ok: false, error: "No authenticator is connected." }, { status: 403 });

  const existing = readWindow(req, user);
  const totpAt = ((claims.amr as Amr[] | undefined) || [])
    .filter((a) => a.method === "totp" && Number.isFinite(Number(a.timestamp)))
    .reduce((latest, a) => Math.max(latest, Number(a.timestamp)), 0);
  // The window runs from the moment the code was entered — never from "now".
  const fromCode = totpAt ? totpAt + WINDOW_SECONDS : 0;
  const expiresAt = Math.max(existing?.expiresAt || 0, fromCode);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!expiresAt || expiresAt <= nowSeconds) {
    return NextResponse.json({ ok: true, trusted: false, expired: true, expiresAt: null });
  }

  const factorId = existing?.factorId && factors.includes(existing.factorId) ? existing.factorId : factors[0];
  const payload = `${user.id}.${factorId}.${expiresAt}`;
  const res = NextResponse.json({ ok: true, trusted: true, expiresAt: new Date(expiresAt * 1000).toISOString() });
  res.cookies.set(cookieName(user.id), `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/mfa-trust",
    maxAge: Math.max(60, expiresAt - nowSeconds),
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("rg_mfa_")) res.cookies.set(cookie.name, "", { path: "/api/auth/mfa-trust", maxAge: 0 });
  }
  return res;
}
