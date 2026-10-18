"use client";

import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen v4.6.6 — module switches. The Developer can switch a module off for maintenance
 * (Developer Console › Modules). While it is off, everyone except the Developer is told so
 * instead of opening its pages, and it leaves the menu. If the v4.6.6 database step has not
 * run, every module is on.
 */
export type ModuleSwitch = { module_key: string; label: string; enabled: boolean; note: string | null; changed_label: string | null; changed_at: string };

export const MODULE_SWITCH_EVENT = "reqgen:module-switches-changed";

/** Which switch covers which pages. */
export const SWITCH_PREFIXES: Record<string, string[]> = {
  requests: ["/requests"],
  approvals: ["/approvals"],
  finance: ["/finance"],
  vouchers: ["/payment-vouchers"],
  registry: ["/registry"],
  reports: ["/reports"],
  audit: ["/audit-centre", "/workflow"],
};

let cache: { at: number; rows: ModuleSwitch[] } | null = null;

export async function loadModuleSwitches(force = false): Promise<ModuleSwitch[]> {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.rows;
  const { data, error } = await supabase.from("reqgen_module_switches").select("module_key,label,enabled,note,changed_label,changed_at");
  const order = Object.keys(SWITCH_PREFIXES);
  const rows = (error ? [] : ((data || []) as ModuleSwitch[])).sort((a, b) => order.indexOf(a.module_key) - order.indexOf(b.module_key));
  cache = { at: Date.now(), rows };
  return rows;
}

export function forgetModuleSwitches() {
  cache = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MODULE_SWITCH_EVENT));
}

export function switchForPath(pathname: string, rows: ModuleSwitch[]): ModuleSwitch | null {
  for (const row of rows) {
    if (row.enabled) continue;
    const prefixes = SWITCH_PREFIXES[row.module_key] || [];
    if (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return row;
  }
  return null;
}
