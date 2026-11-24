import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

/**
 * ReqGen real app: the connection to our own servers only.
 *  - Our database (Supabase), with the same rules as the website.
 *  - Our website (ietreqgen.barderians.com.ng) for the 6-digit codes, the SMS and e-mail alerts,
 *    and the newest app version. No other address is ever contacted.
 */
export const WEBSITE = "https://ietreqgen.barderians.com.ng";
export const isNative = () => Capacitor.isNativePlatform();

/**
 * Opens a page outside the app (the phone's browser): password reset, printing, Finance, files.
 * In the app, leaving the app's own address makes Android open it in the browser, and ReqGen stays as it was.
 */
export function openOutside(url: string) {
  if (isNative()) window.location.href = url;
  else window.open(url, "_blank", "noopener");
}

export const store = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try { const { value } = await Preferences.get({ key }); return value ? (JSON.parse(value) as T) : fallback; } catch { return fallback; }
  },
  async set(key: string, value: unknown) { try { await Preferences.set({ key, value: JSON.stringify(value) }); } catch { /* ignore */ } },
  async del(key: string) { try { await Preferences.remove({ key }); } catch { /* ignore */ } },
};

type Config = { supabaseUrl: string; supabaseAnonKey: string; website: string; version: string; codes: string };
let cfg: Config | null = null;
let sb: SupabaseClient | null = null;

/** Public settings from our website (cached, so the app opens without network after the first time). */
export async function loadConfig(): Promise<Config> {
  if (cfg) return cfg;
  const cached = await store.get<Config | null>("rg:config", null);
  try {
    const r = await fetch(`${WEBSITE}/api/app-config`, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as Config;
      if (j.supabaseUrl && j.supabaseAnonKey) { cfg = j; await store.set("rg:config", j); return j; }
    }
  } catch { /* offline: use the saved copy */ }
  if (cached) { cfg = cached; return cached; }
  throw new Error("ReqGen needs the network the first time it opens. Check your data or Wi-Fi, then try again.");
}

const authStorage = {
  getItem: async (k: string) => (await Preferences.get({ key: k })).value,
  setItem: async (k: string, v: string) => { await Preferences.set({ key: k, value: v }); },
  removeItem: async (k: string) => { await Preferences.remove({ key: k }); },
};

/** The database client. When the database asks for the 6-digit code, the code sheet opens and the call is tried once more. */
export async function db(): Promise<SupabaseClient> {
  if (sb) return sb;
  const c = await loadConfig();
  const client = createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const plain = client.rpc.bind(client);
  client.rpc = ((...args: Parameters<typeof client.rpc>) => {
    const b = plain(...args);
    const then = b.then.bind(b);
    (b as unknown as { then: unknown }).then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      then(async (res: { error: { message?: string } | null }) => {
        if (!res?.error || !/REQGEN_CODE_REQUIRED/.test(String(res.error.message || ""))) return res;
        if (!(await askCode("confirm this action"))) return { ...res, error: { ...res.error, message: "Not done: the code was not entered." } };
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

/** Calls to our website with the signed-in person's token. */
export async function site<T>(path: string, body?: unknown): Promise<T> {
  const s = await session();
  const r = await fetch(`${WEBSITE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(s ? { Authorization: `Bearer ${s.access_token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!r.ok || j.ok === false) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

/** SMS and e-mail to whoever a request now waits for (or the sender, for an answer). Never blocks the screen. */
export function alert(requestId: string, kind: "waiting" | "answered", to?: string[]) {
  void site("/api/notifications/alert", { requestId, kind, to }).catch(() => null);
}

/** The same SMS and e-mail notices the website sends (sent, waiting for the officer, approved, returned). */
export function notice(kind: "submitted" | "decided", requestId: string) {
  if (kind === "submitted") {
    for (const event of ["submission_success", "approval_pending"]) void site("/api/notifications/sms/request-event", { requestId, event }).catch(() => null);
  } else void site("/api/notifications/sms/request-approval", { requestId }).catch(() => null);
}

// ---- the code sheet (drawn in ui.tsx) ------------------------------------------------------------
type Ask = { what: string; purpose: "action" | "sign_in"; resolve: (ok: boolean) => void };
let asker: ((a: Ask) => void) | null = null;
let pending: Promise<boolean> | null = null;
export function onCodeAsk(fn: (a: Ask) => void) { asker = fn; }
export function askCode(what: string, purpose: "action" | "sign_in" = "action"): Promise<boolean> {
  if (pending) return pending;
  if (!asker) return Promise.resolve(false);
  const fn = asker;
  pending = new Promise<boolean>((resolve) => fn({ what, purpose, resolve: (ok) => { pending = null; resolve(ok); } }));
  return pending;
}

export function plainError(e: unknown) {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e || "");
  return m.replace(/^.*REQGEN_CODE_REQUIRED:\s*/, "") || "Something went wrong. Try again.";
}
