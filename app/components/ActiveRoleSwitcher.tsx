"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getActiveRole,
  getAvailableRoles,
  switchActiveRole,
  type ActiveRoleRecord,
  type AvailableRole,
} from "@/lib/activeRole";

export function ActiveRoleSwitcher({ compact = false, hero = false }: { compact?: boolean; hero?: boolean }) {
  const router = useRouter();
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
    load();
    const handler = () => load();
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
      window.dispatchEvent(new Event("reqgen-active-role-changed"));
      router.replace("/staff");
      router.refresh();
      setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to switch role.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-12 animate-pulse rounded-xl bg-slate-200" />;
  }

  if (compact) {
    return (
      <div className={hero
        ? "min-w-[210px] rounded-xl border border-cyan-300/40 bg-white/10 px-3 py-2 shadow-lg backdrop-blur-md"
        : "min-w-[190px] rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 shadow-sm"
      }>
        <div className={hero
          ? "text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100"
          : "text-[10px] font-black uppercase tracking-[0.16em] text-blue-700"
        }>Acting as</div>
        <select
          aria-label="Active working role"
          value={currentKey}
          onChange={(event) => changeRole(event.target.value)}
          disabled={saving}
          className={hero
            ? "mt-1 w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-sm font-black text-white outline-none [color-scheme:dark]"
            : "mt-1 w-full border-0 bg-transparent p-0 text-sm font-black text-slate-950 outline-none"
          }
        >
          {roles.map((role) => (
            <option key={role.key} value={role.key} className="bg-slate-950 text-white">{role.name}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Current Working Context</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Operating as {currentName}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            Navigation, authorization, database actions and audit attribution use only this active role. Other assigned roles remain inactive until you deliberately switch to them.
          </p>
        </div>
        <div className="w-full lg:max-w-md">
          <label className="text-sm font-black text-slate-800">Switch active role</label>
          <select
            value={currentKey}
            onChange={(event) => changeRole(event.target.value)}
            disabled={saving}
            className="mt-2 w-full rounded-xl border-2 border-blue-200 bg-white px-4 py-3 text-base font-black text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          >
            {roles.map((role) => (
              <option key={role.key} value={role.key}>{role.name}</option>
            ))}
          </select>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">{roles.length} assigned role{roles.length === 1 ? "" : "s"}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Strict role isolation active</span>
          </div>
          {message && <div className="mt-3 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-800">{message}</div>}
        </div>
      </div>
    </section>
  );
}

export function ActiveRoleBadge() {
  return <ActiveRoleSwitcher compact />;
}
