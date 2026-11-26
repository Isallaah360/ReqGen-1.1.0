import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

/**
 * ReqGen app 4.0.0: the app talks to the ReqGen database only (Supabase): its tables and rules,
 * and two small database programs (Edge Functions) for SMS and e-mail. It never opens or calls
 * the website. The address and the PUBLIC key are packed at build time from .env.local.
 */
export const APP_VERSION = "4.2.0";
export const SUPABASE_URL = String(import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = String(import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
export const isNative = () => Capacitor.isNativePlatform();

export const store = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try { const { value } = await Preferences.get({ key }); return value ? (JSON.parse(value) as T) : fallback; } catch { return fallback; }
  },
  async set(key: string, value: unknown) { try { await Preferences.set({ key, value: JSON.stringify(value) }); } catch { /* ignore */ } },
  async del(key: string) { try { await Preferences.remove({ key }); } catch { /* ignore */ } },
};

const authStorage = {
  getItem: async (k: string) => (await Preferences.get({ key: k })).value,
  setItem: async (k: string, v: string) => { await Preferences.set({ key: k, value: v }); },
  removeItem: async (k: string) => { await Preferences.remove({ key: k }); },
};

// ---- signed out somewhere else -------------------------------------------------------------------------
// A password, passcode or 2FA change on another device, or the Super Admin switching the account off,
// ends this phone's sign-in. The app must notice at once and say so, never keep showing screens.
type OutReason = "elsewhere" | "deactivated";
let outListener: ((why: OutReason) => void) | null = null;
let signingOutOnPurpose = false;
export function onSignedOut(fn: (why: OutReason) => void) { outListener = fn; }
export function signingOut(v: boolean) { signingOutOnPurpose = v; }
function signedOut(why: OutReason = "elsewhere") { if (!signingOutOnPurpose) outListener?.(why); }

let checking: Promise<void> | null = null;
/** Asks the sign-in service whether this phone's sign-in is still valid (offline: assume yes). */
export function checkSignIn(): Promise<void> {
  if (checking) return checking;
  checking = (async () => {
    try {
      const c = await db();
      const { data } = await c.auth.getSession();
      if (!data.session) { signedOut(); return; }
      const { data: u, error } = await c.auth.getUser();
      if (error) {
        const status = (error as { status?: number }).status || 0;
        const code = String((error as { code?: string }).code || "");
        if (status === 401 || status === 403 || /session_not_found|user_not_found|bad_jwt|user_banned/.test(code)) signedOut(/banned/.test(code) ? "deactivated" : "elsewhere");
        return;
      }
      if (!u.user) signedOut();
    } catch { /* offline: try again later */ } finally { setTimeout(() => { checking = null; }, 3000); }
  })();
  return checking;
}

// ---- error reports (to our own database; read only by the Super Admin) -------------------------------------
let lastScreen = "Home";
export function setScreen(name: string) { lastScreen = name; }
const recent = new Map<string, number>();
export function reportError(code: string, message: string, detail?: Record<string, unknown>) {
  const key = `${code}|${message}`.slice(0, 200);
  const now = Date.now();
  if ((recent.get(key) || 0) > now - 30000) return;
  recent.set(key, now);
  void (async () => {
    try { const c = await db(); await c.rpc("reqgen_app_log_error", { p_version: APP_VERSION, p_screen: lastScreen, p_code: code, p_message: message.slice(0, 600), p_detail: detail || null }); } catch { /* never blocks */ }
  })();
}

/** Every database answer passes here: a refused sign-in is noticed, and failures are reported. */
const watchedFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!res.ok && /\/(rest|functions)\/v1\//.test(url) && !url.includes("reqgen_app_log_error")) {
    void res.clone().json().catch(() => ({})).then((j: { message?: string; error?: string; code?: string; msg?: string }) => {
      const msg = String(j?.message || j?.error || j?.msg || res.statusText || "");
      if (res.status === 401 || /JWT expired|invalid JWT|permission denied for (function|table|schema)|not authenticated/i.test(msg)) void checkSignIn();
      if (!/REQGEN_CODE_REQUIRED/.test(msg)) reportError(String(j?.code || res.status), msg, { path: url.replace(SUPABASE_URL, "").split("?")[0] });
    });
  }
  return res;
};

let sb: SupabaseClient | null = null;
/** The database client. When the database asks for confirmation, the fingerprint (or code) sheet opens and the call is tried once more. */
export async function db(): Promise<SupabaseClient> {
  if (sb) return sb;
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("This copy of the app was built without the database address. Build it again from the reqgen-web folder.");
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: watchedFetch },
  });
  client.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") signedOut(); });
  const plain = client.rpc.bind(client);
  client.rpc = ((...args: Parameters<typeof client.rpc>) => {
    const b = plain(...args);
    const then = b.then.bind(b);
    (b as unknown as { then: unknown }).then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      then(async (res: { error: { message?: string } | null }) => {
        if (!res?.error || !/REQGEN_CODE_REQUIRED/.test(String(res.error.message || ""))) return res;
        if (!(await askCode("confirm this action"))) return { ...res, error: { ...res.error, message: "Not done: it was not confirmed." } };
        return await plain(...args);
      }).then(ok, bad);
    return b;
  }) as typeof client.rpc;
  sb = client;
  return client;
}

export async function session(): Promise<Session | null> {
  const { data } = await (await db()).auth.getSession();
  return data.session;
}

/** Calls one of ReqGen's database programs (Supabase Edge Functions) with the signed-in person's token. */
export async function fn<T>(name: "reqgen-notify" | "reqgen-code", body: Record<string, unknown>): Promise<T> {
  const c = await db();
  const { data, error } = await c.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") { try { const j = await ctx.json(); if (j?.error) msg = String(j.error); } catch { /* keep */ } }
    throw new Error(msg);
  }
  const j = data as T & { ok?: boolean; error?: string };
  if (j && j.ok === false) throw new Error(j.error || "Something went wrong. Try again.");
  return j as T;
}

/**
 * 4.1.0: the office jobs that need the server (staff accounts, reminders, backups, the financial reset)
 * run in the reqgen-office Edge Function: the website's own server code, on Supabase. Never the website.
 */
export async function office<T = Record<string, unknown>>(route: string, opts: { method?: string; body?: unknown; id?: string; raw?: boolean } = {}): Promise<T> {
  const c = await db();
  const { data } = await c.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your sign-in has ended. Please sign in again.");
  const form = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reqgen-office?route=${encodeURIComponent(route)}${opts.id ? `&id=${encodeURIComponent(opts.id)}` : ""}`, {
    method: opts.method || "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY, ...(form || opts.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: opts.body === undefined ? undefined : form ? (opts.body as FormData) : JSON.stringify(opts.body),
  });
  if (opts.raw && res.ok) return (await res.arrayBuffer()) as T;
  const j = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || j.ok === false) throw new Error(j.error || (res.status === 404 ? "This needs the reqgen-office Edge Function. Run DEPLOY_FUNCTIONS.bat." : "Something went wrong. Try again."));
  return j;
}

/** SMS and e-mail to whoever a request now waits for (or the sender, for an answer). Never blocks the screen. */
export function alert(requestId: string, kind: "waiting" | "answered", to?: string[]) {
  void fn("reqgen-notify", { kind: "alert", requestId, alertKind: kind, to }).catch(() => null);
}

/** The same SMS and e-mail notices the website sends (sent, waiting for the officer, approved, returned). */
export function notice(kind: "submitted" | "decided", requestId: string) {
  if (kind === "submitted") {
    for (const event of ["submission_success", "approval_pending"]) void fn("reqgen-notify", { kind: "event", requestId, event }).catch(() => null);
  } else void fn("reqgen-notify", { kind: "approval", requestId }).catch(() => null);
}

// ---- confirming an action (fingerprint or PIN; the SMS code only when the phone is not set up) -----------
type Ask = { what: string; purpose: "action" | "sign_in"; resolve: (ok: boolean) => void };
let asker: ((a: Ask) => void) | null = null;
let pending: Promise<boolean> | null = null;
export function onCodeAsk(fn: (a: Ask) => void) { asker = fn; }
export function askCode(what: string, purpose: "action" | "sign_in" = "action"): Promise<boolean> {
  if (pending) return pending;
  if (!asker) return Promise.resolve(false);
  const ask = asker;
  pending = new Promise<boolean>((resolve) => ask({ what, purpose, resolve: (ok) => { pending = null; resolve(ok); } }));
  return pending;
}

/** A clear sentence for any failure. Database wording never reaches the screen. */
export function plainError(e: unknown) {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e || "");
  if (/^REQGEN_[A-Z0-9_]+:\s*/.test(m)) return m.replace(/^REQGEN_[A-Z0-9_]+:\s*/, "");
  if (/.*REQGEN_CODE_REQUIRED:\s*/.test(m)) return m.replace(/^.*REQGEN_CODE_REQUIRED:\s*/, "");
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(m)) return "No network. Check your data or Wi-Fi, then try again.";
  if (/JWT expired|invalid JWT|refresh token|session.*(not found|expired)/i.test(m)) return "Your sign-in has ended. Please sign in again.";
  if (/permission denied/i.test(m)) return "Your position cannot do this. If it should, ask the Super Admin.";
  if (/row-level security/i.test(m)) return "ReqGen did not allow this change for your position.";
  if (/duplicate key|already exists/i.test(m)) return "This already exists.";
  if (/violates (check|foreign key|not-null) constraint/i.test(m)) return "Something in the form is not accepted. Check the fields and try again.";
  return m.trim() || "Something went wrong. Try again.";
}
