import { NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  adminClient, callerFrom, clientIp, env, oneTimeSignIn, rateLimited, readSignedValue, setWindowCookie, signedValue,
} from "@/lib/server/mfaWindow";

export const runtime = "nodejs";

/**
 * ReqGen v4.0.0 — fingerprint (WebAuthn / passkey) sign-in.
 *
 *  register-options / register-verify   add this device's fingerprint (signed in, 2FA done)
 *  login-options / login-verify         sign in with a fingerprint (no password); counts as 2FA
 *  stepup-options / stepup-verify       confirm it is you after the password (instead of the code)
 *  remove                                remove one of your fingerprints
 *
 * The private key never leaves the device; ReqGen keeps only the public key.
 * Challenges live for five minutes in a signed, httpOnly cookie.
 */

const CHALLENGE_COOKIE = "rg_wa_chal";
const RP_NAME = "ReqGen — Islamic Education Trust";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function rp(req: NextRequest) {
  const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;
  const rpID = new URL(origin).hostname;
  return { origin, rpID };
}

function withChallenge(res: NextResponse, challenge: string, purpose: string, userId = "") {
  res.cookies.set(CHALLENGE_COOKIE, signedValue(`${purpose}~${userId}~${challenge}`, 300), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/auth/webauthn", maxAge: 300,
  });
  return res;
}

function readChallenge(req: NextRequest, purpose: string) {
  const raw = readSignedValue(req.cookies.get(CHALLENGE_COOKIE)?.value);
  if (!raw) return null;
  const [p, userId, challenge] = raw.split("~");
  if (p !== purpose || !challenge) return null;
  return { userId, challenge };
}

function clearChallenge(res: NextResponse) {
  res.cookies.set(CHALLENGE_COOKIE, "", { path: "/api/auth/webauthn", maxAge: 0 });
  return res;
}

function deviceLabel(req: NextRequest, given?: string) {
  if (given && given.trim()) return given.trim().slice(0, 80);
  const ua = req.headers.get("user-agent") || "";
  const os = /Android/i.test(ua) ? "Android phone" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Windows/i.test(ua) ? "Windows laptop" : /Mac OS/i.test(ua) ? "Mac" : "This device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "browser";
  return `${os} · ${browser}`;
}

export async function POST(req: NextRequest) {
  if (!env().ok) return json({ ok: false, error: "Server environment variables are incomplete." }, 500);
  const body = (await req.json().catch(() => ({}))) as { action?: string; response?: unknown; deviceName?: string; id?: string };
  const action = String(body.action || "");
  const admin = adminClient();
  const { origin, rpID } = rp(req);

  if (rateLimited(`wa:${clientIp(req)}`, 30, 60_000)) return json({ ok: false, error: "Too many attempts. Wait a minute and try again." }, 429);

  // ---------------- add a fingerprint ----------------
  if (action === "register-options") {
    const who = await callerFrom(req);
    if (!who) return json({ ok: false, error: "Sign in first." }, 401);
    if (who.claims.aal !== "aal2") return json({ ok: false, error: "Enter your 2FA code first, then add the fingerprint.", needCode: true }, 403);
    const existing = await admin.from("reqgen_webauthn_credentials").select("credential_id,transports").eq("user_id", who.user.id);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userName: who.user.email || who.user.id,
      userDisplayName: String(who.user.user_metadata?.full_name || who.user.email || "ReqGen user"),
      userID: new TextEncoder().encode(who.user.id),
      attestationType: "none",
      excludeCredentials: ((existing.data || []) as Array<{ credential_id: string; transports: string[] | null }>).map((c) => ({ id: c.credential_id, transports: (c.transports || undefined) as AuthenticatorTransportFuture[] | undefined })),
      authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
    });
    return withChallenge(json({ ok: true, options }), options.challenge, "reg", who.user.id);
  }

  if (action === "register-verify") {
    const who = await callerFrom(req);
    if (!who) return json({ ok: false, error: "Sign in first." }, 401);
    const saved = readChallenge(req, "reg");
    if (!saved || saved.userId !== who.user.id) return json({ ok: false, error: "The fingerprint request expired. Try again." }, 400);
    try {
      const result = await verifyRegistrationResponse({
        response: body.response as RegistrationResponseJSON,
        expectedChallenge: saved.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!result.verified || !result.registrationInfo) return clearChallenge(json({ ok: false, error: "The fingerprint could not be confirmed." }, 400));
      const cred = result.registrationInfo.credential;
      const insert = await admin.from("reqgen_webauthn_credentials").insert({
        user_id: who.user.id,
        credential_id: cred.id,
        public_key: Buffer.from(cred.publicKey).toString("base64url"),
        counter: cred.counter,
        transports: cred.transports || null,
        device_name: deviceLabel(req, body.deviceName),
      });
      if (insert.error) return clearChallenge(json({ ok: false, error: /relation|does not exist/i.test(insert.error.message) ? "Fingerprint sign-in is not switched on yet. Ask the Super Admin to run the v4.0.0 database step." : insert.error.message }, 500));
      return clearChallenge(json({ ok: true }));
    } catch (e) {
      return clearChallenge(json({ ok: false, error: e instanceof Error ? e.message : "The fingerprint could not be confirmed." }, 400));
    }
  }

  // ---------------- sign in / confirm with a fingerprint ----------------
  if (action === "login-options" || action === "stepup-options") {
    let allow: Array<{ id: string; transports?: AuthenticatorTransportFuture[] }> | undefined;
    let userId = "";
    if (action === "stepup-options") {
      const who = await callerFrom(req);
      if (!who) return json({ ok: false, error: "Sign in first." }, 401);
      userId = who.user.id;
      const mine = await admin.from("reqgen_webauthn_credentials").select("credential_id,transports").eq("user_id", userId);
      const rows = (mine.data || []) as Array<{ credential_id: string; transports: string[] | null }>;
      if (!rows.length) return json({ ok: false, error: "No fingerprint is set up for this account yet.", none: true }, 404);
      allow = rows.map((c) => ({ id: c.credential_id, transports: (c.transports || undefined) as AuthenticatorTransportFuture[] | undefined }));
    }
    const options = await generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: allow });
    return withChallenge(json({ ok: true, options }), options.challenge, action === "login-options" ? "login" : "stepup", userId);
  }

  if (action === "login-verify" || action === "stepup-verify") {
    const purpose = action === "login-verify" ? "login" : "stepup";
    const saved = readChallenge(req, purpose);
    if (!saved) return json({ ok: false, error: "The fingerprint request expired. Try again." }, 400);
    const response = body.response as AuthenticationResponseJSON;
    const found = await admin.from("reqgen_webauthn_credentials").select("id,user_id,credential_id,public_key,counter,transports").eq("credential_id", String(response?.id || "")).maybeSingle();
    const cred = found.data as { id: string; user_id: string; credential_id: string; public_key: string; counter: number; transports: string[] | null } | null;
    if (!cred) return clearChallenge(json({ ok: false, error: "This fingerprint is not registered in ReqGen. Sign in with your password." }, 404));
    let stepUser = null as Awaited<ReturnType<typeof callerFrom>>;
    if (purpose === "stepup") {
      stepUser = await callerFrom(req);
      if (!stepUser || stepUser.user.id !== cred.user_id || saved.userId !== cred.user_id) return clearChallenge(json({ ok: false, error: "This fingerprint belongs to another account." }, 403));
    }
    try {
      const result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: saved.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: { id: cred.credential_id, publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64url")), counter: Number(cred.counter || 0), transports: (cred.transports || undefined) as AuthenticatorTransportFuture[] | undefined },
      });
      if (!result.verified) return clearChallenge(json({ ok: false, error: "The fingerprint did not match." }, 401));
      await admin.from("reqgen_webauthn_credentials").update({ counter: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", cred.id);
    } catch (e) {
      return clearChallenge(json({ ok: false, error: e instanceof Error ? e.message : "The fingerprint did not match." }, 401));
    }

    if (purpose === "stepup") {
      const res = json({ ok: true, expiresAt: new Date(Date.now() + 12 * 3600_000).toISOString() });
      const until = setWindowCookie(res, stepUser!.user);
      if (!until) return clearChallenge(json({ ok: false, error: "Connect your authenticator app first." }, 403));
      return clearChallenge(res);
    }

    const session = await oneTimeSignIn(admin, cred.user_id);
    if ("error" in session) return clearChallenge(json({ ok: false, error: session.error }, 400));
    const res = json({ ok: true, tokenHash: session.tokenHash, email: session.email });
    setWindowCookie(res, session.user);
    return clearChallenge(res);
  }

  if (action === "remove") {
    const who = await callerFrom(req);
    if (!who) return json({ ok: false, error: "Sign in first." }, 401);
    const del = await admin.from("reqgen_webauthn_credentials").delete().eq("id", String(body.id || "")).eq("user_id", who.user.id);
    if (del.error) return json({ ok: false, error: del.error.message }, 500);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown request." }, 400);
}
