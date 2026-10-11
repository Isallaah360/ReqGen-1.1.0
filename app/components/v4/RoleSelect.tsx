"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveRole, getAvailableRoles, switchActiveRole, type AvailableRole } from "@/lib/activeRole";
import { normalizeRole, roleDisplayName } from "@/lib/roles";
import { alertDialog } from "@/lib/dialog";

/** Position label for the "Acting as" box (system accounts get their own name). */
export function positionName(key: string, raw: string, systemAccount?: string | null) {
  const k = normalizeRole(key);
  if (k === "admin" && systemAccount === "developer") return "Developer";
  return roleDisplayName(k || raw);
}

/**
 * Top-bar "ACTING AS" box. Lists only the positions this person holds; the
 * chosen position decides what the menu shows and is written on every action.
 */
export default function RoleSelect({ systemAccount }: { systemAccount?: string | null }) {
  const router = useRouter();
  const [roles, setRoles] = useState<AvailableRole[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const [available, active] = await Promise.all([getAvailableRoles(data.user.id), getActiveRole(data.user.id)]);
    // One entry per position (old and new keys collapse into one).
    const seen = new Set<string>();
    const unique = available.filter((r) => { const k = normalizeRole(r.key); if (seen.has(k)) return false; seen.add(k); return true; });
    setRoles(unique);
    setCurrent(normalizeRole(active?.active_role_key || unique[0]?.key || "staff"));
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
    const handler = () => void load();
    window.addEventListener("reqgen-active-role-changed", handler);
    return () => window.removeEventListener("reqgen-active-role-changed", handler);
  }, [load]);

  async function change(next: string) {
    if (!next || next === current) return;
    const target = roles.find((r) => normalizeRole(r.key) === next);
    setSaving(true);
    try {
      const result = await switchActiveRole(target?.key || next);
      setCurrent(normalizeRole(result.active_role_key));
      window.dispatchEvent(new CustomEvent("reqgen-active-role-changed", { detail: { roleKey: result.active_role_key, roleName: result.active_role_name } }));
      router.refresh();
    } catch (error) {
      await alertDialog({ title: "Could not change position", message: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="v4-acting" aria-hidden="true"><small>ACTING AS</small><span className="v4-muted" style={{ fontWeight: 700 }}>…</span></div>;

  return (
    <div className="v4-acting">
      <small>ACTING AS</small>
      <label className="v4-sr-only" htmlFor="v4-acting-as">Acting as</label>
      <select id="v4-acting-as" value={current} disabled={saving || roles.length < 2} onChange={(e) => void change(e.target.value)}>
        {roles.map((r) => {
          const k = normalizeRole(r.key);
          return <option key={k} value={k}>{positionName(k, r.name, systemAccount)}</option>;
        })}
      </select>
    </div>
  );
}
