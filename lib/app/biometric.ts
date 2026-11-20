"use client";

import { APP_SERVER_NAME, appGet, appSet, isApp } from "./native";

/**
 * ReqGen v4.6.11 — fingerprint sign-in in the app (brief §7).
 * After a password sign-in the app asks "Use your fingerprint next time?".
 * On Yes, the email and password go into the phone's secure store, locked
 * by the fingerprint (@capgo/capacitor-native-biometric, Android Keystore).
 * "Sign in with fingerprint" reads them back after a fingerprint check.
 * If the password no longer works, they are forgotten and the app asks once.
 */

const ASKED = "reqgen:fp-asked";

async function plugin() {
  return import("@capgo/capacitor-native-biometric");
}

export async function fingerprintReady(): Promise<boolean> {
  if (!isApp()) return false;
  try {
    const { NativeBiometric } = await plugin();
    return !!(await NativeBiometric.isAvailable()).isAvailable;
  } catch {
    return false;
  }
}

export async function fingerprintSaved(): Promise<boolean> {
  if (!isApp()) return false;
  try {
    const { NativeBiometric } = await plugin();
    return !!(await NativeBiometric.isCredentialsSaved({ server: APP_SERVER_NAME })).isSaved;
  } catch {
    return false;
  }
}

export async function saveFingerprint(email: string, password: string) {
  const { NativeBiometric, AccessControl } = await plugin();
  await NativeBiometric.setCredentials({ username: email, password, server: APP_SERVER_NAME, accessControl: AccessControl.BIOMETRY_CURRENT_SET });
  await appSet(ASKED, "1");
}

export async function forgetFingerprint() {
  try {
    const { NativeBiometric } = await plugin();
    await NativeBiometric.deleteCredentials({ server: APP_SERVER_NAME });
  } catch { /* nothing saved */ }
}

/** Shows the fingerprint prompt and returns the saved email and password. */
export async function readFingerprint(reason = "Sign in to ReqGen"): Promise<{ email: string; password: string }> {
  const { NativeBiometric } = await plugin();
  try {
    const c = await NativeBiometric.getSecureCredentials({ server: APP_SERVER_NAME, reason, title: "ReqGen" });
    return { email: c.username, password: c.password };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e || "");
    if (/no protected credentials|21/i.test(m)) throw new Error("Fingerprint sign-in is not set up on this phone. Sign in with your password.");
    throw new Error(/cancel/i.test(m) ? "The fingerprint check was cancelled." : "The fingerprint did not match. Try again or use your password.");
  }
}

/** A fresh fingerprint check (signing, stamping, paying, unlocking). */
export async function checkFingerprint(reason = "Confirm it is you") {
  const { NativeBiometric } = await plugin();
  try {
    await NativeBiometric.verifyIdentity({ reason, title: "ReqGen", subtitle: reason, negativeButtonText: "Cancel" });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e || "");
    throw new Error(/cancel/i.test(m) ? "The fingerprint check was cancelled." : "The fingerprint did not match. Try again or use your code.");
  }
}

/** Ask once after a password sign-in (and once more after a password change). */
export async function shouldOfferFingerprint(): Promise<boolean> {
  if (!(await fingerprintReady())) return false;
  if (await fingerprintSaved()) return false;
  return (await appGet(ASKED)) !== "1";
}

export async function markFingerprintAsked() { await appSet(ASKED, "1"); }
export async function resetFingerprintAsk() { await appSet(ASKED, null); }
