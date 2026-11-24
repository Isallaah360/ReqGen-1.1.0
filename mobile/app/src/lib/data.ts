import { useCallback, useEffect, useRef, useState } from "react";
import { Network } from "@capacitor/network";
import { db, store } from "./core";
import { normalizeRole } from "./web";

/** Online or not (the phone's own signal). */
export function useOnline() {
  const [on, setOn] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    let h: { remove: () => Promise<void> } | null = null;
    void Network.getStatus().then((s) => setOn(s.connected)).catch(() => null);
    void Network.addListener("networkStatusChange", (s) => setOn(s.connected)).then((x) => { h = x; }).catch(() => null);
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { void h?.remove(); window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return on;
}

/**
 * A list saved on the phone: shows at once from the saved copy, then the fresh one replaces it.
 * Saved per person, so a different person signing in never sees someone else's list.
 */
export function useSaved<T>(key: string | null, load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loader = useRef(load);
  useEffect(() => { loader.current = load; });
  const reload = useCallback(async () => {
    if (!key) return;
    try {
      const fresh = await loader.current();
      setData(fresh); setError(null);
      const now = Date.now(); setAt(now);
      await store.set(`rg:c:${key}`, { at: now, data: fresh });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load. Pull down to try again.");
    } finally { setLoading(false); }
  }, [key]);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    void store.get<{ at: number; data: T } | null>(`rg:c:${key}`, null).then((c) => {
      if (alive && c) { setData(c.data); setAt(c.at); setLoading(false); }
      void reload();
    });
    return () => { alive = false; };
  }, [key, reload]);
  return { data, at, error, loading, reload };
}

export type Me = {
  id: string; email: string | null; full_name: string; avatar_url: string | null; signature_url: string | null;
  phone: string | null; dept_id: string | null; role: string; roleName: string; deptName: string;
  /** 2.1.0: system account (developer or super admin) and the positions this person holds */
  systemAccount: string | null; positions: Array<{ key: string; name: string; primary: boolean }>;
};

/** Who is signed in (with the position now in use). */
export async function loadMe(): Promise<Me> {
  const s = await db();
  const { data: u } = await s.auth.getUser();
  if (!u.user) throw new Error("Please sign in again.");
  const [p, active] = await Promise.all([
    s.from("profiles").select("full_name,avatar_url,signature_url,phone,email,dept_id,role,system_account").eq("id", u.user.id).maybeSingle(),
    s.rpc("get_my_active_role"),
  ]);
  const pr = await s.from("profile_roles").select("role_key,role_name,is_primary,is_active").eq("profile_id", u.user.id).eq("is_active", true);
  const row = (p.data || {}) as Record<string, string | null>;
  const a = (Array.isArray(active.data) ? active.data[0] : active.data) as Record<string, string | null> | string | null;
  const roleKey = typeof a === "string" ? a : String(a?.active_role_key ?? a?.role_key ?? a?.role ?? row.role ?? "staff");
  const roleName = typeof a === "string" ? a : String(a?.active_role_name ?? a?.role_name ?? roleKey);
  let deptName = "";
  if (row.dept_id) {
    const d = await s.from("departments").select("name").eq("id", row.dept_id).maybeSingle();
    deptName = String((d.data as { name?: string } | null)?.name || "");
  }
  const me: Me = {
    id: u.user.id, email: row.email || u.user.email || null, full_name: String(row.full_name || u.user.email || "ReqGen user").trim(),
    avatar_url: row.avatar_url || null, signature_url: row.signature_url || null, phone: row.phone || null, dept_id: row.dept_id || null,
    role: normalizeRole(String(roleKey || "staff")) || "staff", roleName: niceRole(roleName), deptName,
    systemAccount: row.system_account || null,
    positions: ((pr.data || []) as Array<{ role_key: string; role_name: string | null; is_primary: boolean | null }>).map((x) => ({ key: normalizeRole(x.role_key) || x.role_key, name: niceRole(x.role_name || x.role_key), primary: !!x.is_primary })),
  };
  await store.set("rg:me", me);
  return me;
}
export function niceRole(r: string) {
  const k = String(r || "").trim();
  if (!k) return "Staff";
  if (/^staff$/i.test(k)) return "Staff";
  if (/^po$|program ?officer/i.test(k)) return "PD";
  if (/^dg$/i.test(k)) return "Director General";
  if (/^hod$/i.test(k)) return "HOD";
  return k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type Req = {
  id: string; request_no: string | null; title: string | null; details?: string | null; amount: number | null; status: string | null; current_stage: string | null;
  current_owner?: string | null; created_at: string | null; created_by?: string | null; request_type?: string | null; personal_category?: string | null;
  requester_name?: string | null; dept_id?: string | null; direct_to?: string | null; subhead_id?: string | null;
  assigned_account_officer_id?: string | null; assigned_account_officer_user_id?: string | null; updated_at?: string | null;
};
export const LIST_COLS = "id,request_no,title,amount,status,current_stage,current_owner,created_at,created_by,request_type,personal_category,requester_name,dept_id,direct_to,assigned_account_officer_id,assigned_account_officer_user_id";
export type DirectWaiting = { id: string; request_no: string | null; title: string | null; amount: number | null; requester_name: string | null; dept_id: string | null; created_at: string | null; read_at: string | null };
