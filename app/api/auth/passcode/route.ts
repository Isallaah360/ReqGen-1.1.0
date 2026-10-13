import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { easyPasscode } from "@/lib/v4/passcodeRules";
import { adminClient, callerFrom, securityRules, clientIp, env, hmac, oneTimeSignIn, rateLimited, sameText, windowValid } from "@/lib/server/mfaWindow";

export const runtime = "nodejs";

/**
 * ReqGen v4.0.0 — 6-digit passcode on a trusted device (Build Reference §10).
 *
 *  setup    signed in with 2FA done: joins a passcode to THIS device
 *  signin   device key + passcode → a session (2FA is still asked every 12 hours)
 *  remove   remove one of your trusted devices
 *
 * The device keeps a random 256-bit key that never leaves it except to this
 * server. ReqGen stores only a keyed hash of that key and a slow, salted hash
 * of passcode + device key — so the passcode is useless on any other device
 * and the database never holds the passcode itself. Five wrong tries remove
 * the passcode from the device.
 */


function hashPasscode(passcode: string, deviceKey: string, salt = crypto.randomBytes(16).toString("base64url")) {
  const derived = crypto.scryptSync(`${passcode}:${deviceKey}`, `${salt}:${hmac("passcode-pepper")}`, 32, { N: 16384, r: 8, p: 1 }).toString("base64url");
  return `scrypt$${salt}$${derived}`;
}

function checkPasscode(stored: string, passcode: string, deviceKey: string) {
  const [kind, salt] = stored.split("$");
  if (kind !== "scrypt" || !salt) return false;
  return sameText(hashPasscode(passcode, deviceKey, salt), stored);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  if (!env().ok) return json({ ok: false, error: "Server environment variables are incomplete." }, 500);
  const body = (await req.json().catch(() => ({}))) as { action?: string; deviceId?: string; deviceKey?: string; passcode?: string; deviceName?: string; id?: string };
  const action = String(body.action || "");
  const admin = adminClient();

  if (action === "setup") {
    const who = await callerFrom(req);
    if (!who) return json({ ok: false, error: "Sign in first." }, 401);
    if (who.claims.aal !== "aal2" && !windowValid(req, who.user)) return json({ ok: false, error: "Confirm it is you with your fingerprint or 2FA code first.", needCode: true }, 403);
    const passcode = String(body.passcode || "");
    const deviceKey = String(body.deviceKey || "");
    const problem = easyPasscode(passcode);
    if (problem) return json({ ok: false, error: problem }, 400);
    if (!/^[A-Za-z0-9_-]{40,}$/.test(deviceKey)) return json({ ok: false, error: "This browser could not create a device key." }, 400);
    const keyHash = hmac(`device:${deviceKey}`);
    // Save the replacement first: a failed insert must not invalidate the existing passcode.
    const ins = await admin.from("reqgen_trusted_devices").insert({
      user_id: who.user.id,
      device_name: String(body.deviceName || "This device").slice(0, 80),
      device_key_hash: keyHash,
      passcode_hash: hashPasscode(passcode, deviceKey),
    }).select("id").single();
    if (ins.error) return json({ ok: false, error: /relation|does not exist/i.test(ins.error.message) ? "Passcode sign-in is not switched on yet. Ask the Super Admin to run the v4.0.0 database step." : ins.error.message }, 500);
    // Retire previous registrations only after the replacement is safely persisted.
    const previous = await admin.from("reqgen_trusted_devices")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: "Passcode changed" })
      .eq("user_id", who.user.id).eq("device_key_hash", keyHash)
      .neq("id", (ins.data as { id: string }).id).is("revoked_at", null);
    if (previous.error) return json({ ok: false, error: "New passcode saved, but previous device registration could not be retired. Contact the administrator." }, 500);
    // Changing the passcode signs out every other device (Build Reference §10).
    await admin.auth.admin.signOut(who.token, "others").catch(() => undefined);
    return json({ ok: true, deviceId: (ins.data as { id: string }).id });
  }

  if (action === "signin") {
    const deviceId = String(body.deviceId || "");
    const deviceKey = String(body.deviceKey || "");
    const passcode = String(body.passcode || "");
    if (rateLimited(`pc:${clientIp(req)}`, 20, 10 * 60_000) || rateLimited(`pc-dev:${deviceId}`, 8, 10 * 60_000)) {
      return json({ ok: false, error: "Too many attempts. Wait ten minutes, or use your password." }, 429);
    }
    if (!/^[0-9a-f-]{36}$/i.test(deviceId) || !/^\d{6}$/.test(passcode)) return json({ ok: false, error: "Enter your 6-digit passcode." }, 400);
    const found = await admin.from("reqgen_trusted_devices").select("id,user_id,device_key_hash,passcode_hash,failed_attempts,revoked_at").eq("id", deviceId).maybeSingle();
    const dev = found.data as { id: string; user_id: string; device_key_hash: string; passcode_hash: string; failed_attempts: number; revoked_at: string | null } | null;
    if (!dev || dev.revoked_at || !sameText(dev.device_key_hash, hmac(`device:${deviceKey}`))) {
      return json({ ok: false, error: "The passcode on this device was removed. Sign in with your password.", forget: true }, 410);
    }
    if (!checkPasscode(dev.passcode_hash, passcode, deviceKey)) {
      const maxTries = (await securityRules()).passcodeTries; // v4.6: set in Security Centre (3 or 5)
      const tries = Number(dev.failed_attempts || 0) + 1;
      const gone = tries >= maxTries;
      const words = maxTries === 3 ? "Three" : "Five";
      await admin.from("reqgen_trusted_devices").update(gone ? { failed_attempts: tries, revoked_at: new Date().toISOString(), revoked_reason: `${maxTries} wrong passcode tries` } : { failed_attempts: tries }).eq("id", dev.id);
      return json(gone
        ? { ok: false, forget: true, error: `${words} wrong tries. The passcode was removed from this device. Sign in with your password and 2FA.` }
        : { ok: false, error: `Wrong passcode. ${maxTries - tries} ${maxTries - tries === 1 ? "try" : "tries"} left.` }, 401);
    }
    const session = await oneTimeSignIn(admin, dev.user_id);
    if ("error" in session) return json({ ok: false, error: session.error }, 400);
    await admin.from("reqgen_trusted_devices").update({ failed_attempts: 0, last_used_at: new Date().toISOString() }).eq("id", dev.id);
    return json({ ok: true, tokenHash: session.tokenHash, email: session.email });
  }

  if (action === "remove") {
    const who = await callerFrom(req);
    if (!who) return json({ ok: false, error: "Sign in first." }, 401);
    const upd = await admin.from("reqgen_trusted_devices").update({ revoked_at: new Date().toISOString(), revoked_reason: "Removed by the owner" }).eq("id", String(body.id || "")).eq("user_id", who.user.id).is("revoked_at", null);
    if (upd.error) return json({ ok: false, error: upd.error.message }, 500);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown request." }, 400);
}
