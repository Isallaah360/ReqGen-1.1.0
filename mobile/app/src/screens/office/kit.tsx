import { useCallback, useEffect, useState, type ReactNode } from "react";
import { askCode, db, plainError } from "../../lib/core";
import { normalizeRole } from "../../lib/rules/roles";
import { naira } from "../../lib/text";
import { Note, toast } from "../../ui";

/**
 * App 4.1.0: small building blocks for the office screens (Payment Vouchers, Finance, Registry,
 * Reports, Audit, Administration). Every screen reads the same database functions as the website.
 */

/** The position being acted as, without its number: accountofficer2 → accountofficer. */
export const roleBase = (r: string | null | undefined) => normalizeRole(r || "").replace(/\d+$/, "");
export const isOfficerRole = (r: string) => ["account", "accounts", "accountofficer"].includes(roleBase(r));
export const isAdminRole = (r: string) => ["admin", "superadmin"].includes(roleBase(r));
export const isAuditorRole = (r: string) => roleBase(r) === "auditor";
export const isDgRole = (r: string) => ["dg", "directorgeneral"].includes(roleBase(r));
export const isRegistryRole = (r: string) => ["padg", "patothedg", "registry"].includes(roleBase(r));

/** Website chip colours to app chip colours. */
export const TONE: Record<string, string> = { amber: "wa", blue: "in", green: "ok", red: "er", grey: "mu", brand: "or" };
export const one = <T,>(d: unknown): T | null => ((Array.isArray(d) ? d[0] : d) as T) || null;
export const parsed = <T,>(d: unknown): T => (typeof d === "string" ? JSON.parse(d) : d) as T;
export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Loads a list (or record) from the database; reload after an action. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => { try { setData(await load()); setError(null); } catch (e) { setError(plainError(e)); } }, deps);
  useEffect(() => { void run(); }, [run]);
  useEffect(() => { const on = () => void run(); window.addEventListener("rg-notice", on); return () => window.removeEventListener("rg-notice", on); }, [run]);
  return { data, error, reload: run, setData };
}

/** Calls a database function; a refusal becomes a plain sentence. */
export async function call<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (await db()).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export async function rows<T>(name: string, args: Record<string, unknown> = {}): Promise<T[]> {
  const d = await call<unknown>(name, args);
  return (Array.isArray(d) ? d : d ? [d] : []) as T[];
}

/** Runs an action with confirmation (fingerprint, PIN or code), a busy flag and a toast. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run(what: string | null, fn: () => Promise<unknown>, ok: string, after?: () => Promise<unknown> | void) {
    setErr(null);
    if (what && !(await askCode(what))) { setErr("Not done: it was not confirmed."); return false; }
    setBusy(true);
    try { await fn(); toast(ok); if (after) await after(); return true; }
    catch (e) { setErr(plainError(e)); toast(plainError(e), "er"); return false; }
    finally { setBusy(false); }
  }
  return { busy, err, setErr, run };
}

export function Err({ text }: { text: string | null | undefined }) { return text ? <Note tone="er">{text}</Note> : null; }

/** Four figures in a row (two on a narrow phone). */
export function Stats({ items }: { items: Array<{ label: string; value: ReactNode; tone?: string }> }) {
  return (
    <div className="stats">
      {items.map((s) => <div key={s.label} className={`stat${s.tone ? ` st-${s.tone}` : ""}`}><small>{s.label}</small><b>{s.value}</b></div>)}
    </div>
  );
}

/** A simple bar chart (SVG, no library): one bar per label. */
export function Bars({ data, money = true, label }: { data: Array<{ k: string; v: number; v2?: number }>; money?: boolean; label: string }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.v, d.v2 || 0)));
  const fmt = (n: number) => money ? (n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `₦${Math.round(n / 1e3)}k` : naira(n)) : String(n);
  return (
    <figure className="bars" aria-label={label}>
      {data.map((d) => (
        <div key={d.k} className="bar-row">
          <span className="bk">{d.k}</span>
          <span className="bt">
            <i style={{ width: `${(d.v / max) * 100}%` }} />
            {d.v2 !== undefined ? <i className="b2" style={{ width: `${(d.v2 / max) * 100}%` }} /> : null}
          </span>
          <span className="bv">{fmt(d.v)}{d.v2 !== undefined ? ` / ${fmt(d.v2)}` : ""}</span>
        </div>
      ))}
    </figure>
  );
}

/** A labelled value row used on record screens. */
export function Facts({ rows: list }: { rows: Array<[string, ReactNode] | null | false | undefined> }) {
  return <dl className="kv">{list.filter(Boolean).map((r) => { const [k, v] = r as [string, ReactNode]; return <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>; })}</dl>;
}

/** A month picker as "2026-11". */
export function MonthPick({ value, onChange, label = "Month" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return <label style={{ display: "block" }}><span className="lbl">{label}</span><input className="inp" type="month" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
