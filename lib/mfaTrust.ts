"use client";

import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen v3.1.14 — 12-hour two-factor window (client side).
 * See app/api/auth/mfa-trust/route.ts for the rules. The server cookie is the
 * authority; the browser keeps only the end time so it can sign the person
 * out on time.
 */

export const MFA_WINDOW_HOURS = 12;
const STORE_KEY = "reqgen:mfa-window-ends";

export type MfaWindow = { trusted: boolean; expiresAt: string | null; expired?: boolean; signedOut?: boolean };

async function call(method: "GET" | "POST" | "DELETE"): Promise<MfaWindow | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token && method !== "DELETE") return null;
    const response = await fetch("/api/auth/mfa-trust", {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = (await response.json().catch(() => ({}))) as Partial<MfaWindow> & { ok?: boolean };
    if (response.status === 401) return { trusted: false, expiresAt: null, signedOut: true };
    if (!response.ok) return null;
    const result: MfaWindow = { trusted: !!body.trusted, expiresAt: body.expiresAt || null, expired: !!body.expired };
    remember(result.trusted ? result.expiresAt : null);
    return result;
  } catch {
    return null; // network trouble: callers fall back to the normal 2FA rules
  }
}

function remember(expiresAt: string | null) {
  try {
    if (expiresAt) window.localStorage.setItem(STORE_KEY, expiresAt);
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable — the server cookie still decides */
  }
}

/** Starts (or confirms) the window right after a correct authenticator code. */
export function startMfaWindow() {
  return call("POST");
}

/** Is this device inside a valid 12-hour window for the signed-in person? */
export function checkMfaWindow() {
  return call("GET");
}

/** Ends the window on this device (for example after replacing the authenticator). */
export async function endMfaWindow() {
  remember(null);
  await call("DELETE");
}

export function storedWindowEnd(): number | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const time = raw ? new Date(raw).getTime() : NaN;
    return Number.isFinite(time) ? time : null;
  } catch {
    return null;
  }
}

/** Signs the person out completely when the window has ended. */
export async function signOutForExpiredWindow() {
  remember(null);
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  window.location.replace("/login?reason=2fa-expired");
}
