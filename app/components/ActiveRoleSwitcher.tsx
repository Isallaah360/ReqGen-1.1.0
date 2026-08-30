"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getActiveRole,
  getAvailableRoles,
  switchActiveRole,
  type ActiveRoleRecord,
  type AvailableRole,
} from "@/lib/activeRole";

export function ActiveRoleSwitcher({ compact = false, hero = false, allowInERP = false }: { compact?: boolean; hero?: boolean; allowInERP?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const hiddenInsideERPContent = pathname.startsWith("/erp-2") && !allowInERP;
  const [roles, setRoles] = useState<AvailableRole[]>([]);
  const [activeRole, setActiveRole] = useState<ActiveRoleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const [available, current] = await Promise.all([
      getAvailableRoles(data.user.id),
      getActiveRole(data.user.id),
    ]);
    setRoles(available);
    setActiveRole(current);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
    const handler = () => void load();
    window.addEventListener("reqgen-active-role-changed", handler);
    return () => window.removeEventListener("reqgen-active-role-changed", handler);
  }, [load]);

  const currentKey = activeRole?.active_role_key || roles[0]?.key || "staff";
  const currentName = activeRole?.active_role_name || roles[0]?.name || "Staff";

  async function changeRole(nextRole: string) {
    if (!nextRole || nextRole === currentKey) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await switchActiveRole(nextRole);
      setActiveRole(result);
      setMessage(`Now operating as ${result.active_role_name}.`);
      window.dispatchEvent(new CustomEvent("reqgen-active-role-changed", {
        detail: { roleKey: result.active_role_key, roleName: result.active_role_name },
      }));
      if (pathname.startsWith("/erp-2") || pathname === "/erp") router.replace(pathname);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to switch role.");
    } finally {
      setSaving(false);
    }
  }

  if (hiddenInsideERPContent) return null;
  if (loading) return <div className={compact ? "mock-role-skeleton" : "mock-role-panel-skeleton"} />;

  if (compact) {
    return (
      <div className={`mock-role-switcher ${hero ? "is-hero" : ""}`}>
        <span>Acting as</span>
        <div>
          <select
            aria-label="Active working role"
            data-tip="Switch to another role assigned to your account. The selected role controls your visible modules and permissions."
            value={currentKey}
            onChange={(event) => changeRole(event.target.value)}
            disabled={saving}
          >
            {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
          </select>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
    );
  }

  return (
    <section className="mock-role-panel">
      <div>
        <p>Current Working Role</p>
        <h2>Operating as {currentName}</h2>
        <span>ReqGen permissions and audit attribution follow the active role selected below.</span>
      </div>
      <div className="mock-role-panel-control">
        <label htmlFor="reqgen-role-select">Switch active role</label>
        <select id="reqgen-role-select" value={currentKey} onChange={(event) => changeRole(event.target.value)} disabled={saving}>
          {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
        </select>
        {message ? <small>{message}</small> : null}
      </div>
    </section>
  );
}

export function ActiveRoleBadge() {
  return <ActiveRoleSwitcher compact />;
}
