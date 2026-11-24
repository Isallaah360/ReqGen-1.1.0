"use client";

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { supabase } from "@/lib/supabaseClient";
import { isApp } from "@/lib/app/native";
import { checkFingerprint, fingerprintSaved, forgetFingerprint, readFingerprint, resetFingerprintAsk } from "@/lib/app/biometric";

/**
 * ReqGen v4.0.0 — fingerprint and passcode sign-in (browser side).
 * The server routes are app/api/auth/webauthn and app/api/auth/passcode.
 */

const DEVICE_KEY = "reqgen:trusted-device";

export type TrustedDevice = { deviceId: string; deviceKey: string; email: string; name: string; positions: string; userId: string };

export function readTrustedDevice(): TrustedDevice | null {
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    const d = raw ? (JSON.parse(raw) as TrustedDevice) : null;
    return d && d.deviceId && d.deviceKey ? d : null;
  } catch {
    return null;
  }
}

export function forgetTrustedDevice() {
  try { window.localStorage.removeItem(DEVICE_KEY); } catch { /* storage blocked */ }
}

function saveTrustedDevice(d: TrustedDevice) {
  try {
    window.localStorage.setItem(DEVICE_KEY, JSON.stringify(d));
    if (readTrustedDevice()?.deviceId !== d.deviceId) throw new Error("Device storage verification failed.");
  } catch {
    throw new Error("The passcode was saved on the server, but this browser could not remember the device. Allow site storage and try again.");
  }
}

function newDeviceKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deviceName() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android phone" : /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Windows/i.test(ua) ? "Windows laptop" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux computer" : "This device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${os}, ${browser}`;
}

async function bearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function post(url: string, body: unknown, auth = false) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${await bearer()}`;
  const res = await fetch(url, { method: "POST", headers, credentials: "same-origin", body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, ...json } as { status: number; ok?: boolean; error?: string; [k: string]: unknown };
}

async function finishSession(tokenHash: string) {
  let r = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (r.error) r = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (r.error) throw new Error(r.error.message);
}

/**
 * v4.7.1: a fingerprint (passkey) belongs to one web address. Browsers refuse it on any other
 * address, so it is offered only on the main address (NEXT_PUBLIC_APP_URL). On other addresses
 * (for example the vercel.app link) ReqGen asks for the authenticator code instead.
 */
export function onMainAddress() {
  if (typeof window === "undefined") return false;
  try { return new URL(process.env.NEXT_PUBLIC_APP_URL || window.location.origin).origin === window.location.origin; } catch { return false; }
}

export async function fingerprintAvailable() {
  // v4.6.11: in the ReqGen app the phone's own sensor is used (brief §7).
  if (isApp()) return fingerprintSaved();
  if (!onMainAddress()) return false;
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
  } catch {
    return false;
  }
}

function friendly(e: unknown) {
  const m = e instanceof Error ? e.message : String(e || "");
  if (/NotAllowed|timed out|cancel/i.test(m)) return "The fingerprint check was cancelled or timed out. Try again.";
  if (/InvalidState|already registered/i.test(m)) return "This device's fingerprint is already added to your account.";
  return m || "The fingerprint check did not work. Try again or use your code.";
}

/** Signs in with a fingerprint (no password). Counts as the 2FA check. */
export async function fingerprintSignIn() {
  if (isApp()) {
    const saved = await readFingerprint("Sign in to ReqGen");
    const r = await supabase.auth.signInWithPassword({ email: saved.email, password: saved.password });
    if (r.error) {
      if (/invalid login|invalid credentials|password/i.test(r.error.message)) {
        // The password changed: forget it, and ask once again after the next password sign-in.
        await forgetFingerprint();
        await resetFingerprintAsk();
        throw new Error("Your password has changed. Sign in with your password, then turn the fingerprint on again.");
      }
      throw new Error(r.error.message);
    }
    return;
  }
  const opt = await post("/api/auth/webauthn", { action: "login-options" });
  if (!opt.ok) throw new Error(opt.error || "Fingerprint sign-in is not available.");
  let response;
  try { response = await startAuthentication({ optionsJSON: opt.options as Parameters<typeof startAuthentication>[0]["optionsJSON"] }); } catch (e) { throw new Error(friendly(e)); }
  const done = await post("/api/auth/webauthn", { action: "login-verify", response });
  if (!done.ok || !done.tokenHash) throw new Error(done.error || "The fingerprint did not match.");
  await finishSession(String(done.tokenHash));
}

/** After the password: confirm it is you with the fingerprint instead of the code. */
export async function fingerprintStepUp() {
  if (isApp()) return checkFingerprint("Confirm it is you");
  const opt = await post("/api/auth/webauthn", { action: "stepup-options" }, true);
  if (!opt.ok) throw new Error(opt.error || "No fingerprint is set up for this account yet.");
  let response;
  try { response = await startAuthentication({ optionsJSON: opt.options as Parameters<typeof startAuthentication>[0]["optionsJSON"] }); } catch (e) { throw new Error(friendly(e)); }
  const done = await post("/api/auth/webauthn", { action: "stepup-verify", response }, true);
  if (!done.ok) throw new Error(done.error || "The fingerprint did not match.");
  try { if (done.expiresAt) window.localStorage.setItem("reqgen:mfa-window-ends", String(done.expiresAt)); } catch { /* ignore */ }
}

/** Adds this device's fingerprint to the signed-in account (needs 2FA done). */
export async function registerFingerprint() {
  const opt = await post("/api/auth/webauthn", { action: "register-options" }, true);
  if (!opt.ok) { const err = new Error(opt.error || "Could not start."); (err as Error & { needCode?: boolean }).needCode = !!opt.needCode; throw err; }
  let response;
  try { response = await startRegistration({ optionsJSON: opt.options as Parameters<typeof startRegistration>[0]["optionsJSON"] }); } catch (e) { throw new Error(friendly(e)); }
  const done = await post("/api/auth/webauthn", { action: "register-verify", response, deviceName: deviceName() }, true);
  if (!done.ok) throw new Error(done.error || "The fingerprint could not be saved.");
}

export async function removeFingerprint(id: string) {
  const done = await post("/api/auth/webauthn", { action: "remove", id }, true);
  if (!done.ok) throw new Error(done.error || "Could not remove the fingerprint.");
}

/** Joins a passcode to this device. */
export async function setupPasscode(passcode: string, who: { email: string; name: string; positions: string; userId: string }) {
  const existing = readTrustedDevice();
  const deviceKey = existing && existing.userId === who.userId ? existing.deviceKey : newDeviceKey();
  const done = await post("/api/auth/passcode", { action: "setup", passcode, deviceKey, deviceName: deviceName() }, true);
  if (!done.ok) { const err = new Error(done.error || "Could not save the passcode."); (err as Error & { needCode?: boolean }).needCode = !!done.needCode; throw err; }
  saveTrustedDevice({ deviceId: String(done.deviceId), deviceKey, ...who });
}

/** Signs in with the passcode on this trusted device. */
export async function passcodeSignIn(passcode: string) {
  const d = readTrustedDevice();
  if (!d) throw new Error("This device has no passcode. Sign in with your password.");
  const done = await post("/api/auth/passcode", { action: "signin", deviceId: d.deviceId, deviceKey: d.deviceKey, passcode });
  if (done.forget) forgetTrustedDevice();
  if (!done.ok || !done.tokenHash) {
    const err = new Error(done.error || "Wrong passcode.");
    (err as Error & { forget?: boolean }).forget = !!done.forget;
    throw err;
  }
  await finishSession(String(done.tokenHash));
}

export async function removeTrustedDevice(id: string) {
  const done = await post("/api/auth/passcode", { action: "remove", id }, true);
  if (!done.ok) throw new Error(done.error || "Could not remove the device.");
  const d = readTrustedDevice();
  if (d && d.deviceId === id) forgetTrustedDevice();
}
