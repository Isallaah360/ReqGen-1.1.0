"use client";

import { supabase } from "@/lib/supabaseClient";

/** ReqGen v4.6.6 — data for the Developer Console. */
export type SystemAccountStatus = {
  kind: string; email: string; signin: string; last_sign_in: string | null; full_name: string | null;
  marked: string | null; active: boolean; positions: string | null; acting: string | null; has_2fa: boolean;
};
export type Release = { id: string; version: string; title: string; notes: string; published_label: string | null; published_at: string };
export type AuditEvent = { at: string; actor_label: string | null; category: string; module: string; action: string; record_no: string | null; device: string | null };

const missing = (m: string) => /does not exist|schema cache|Could not find/i.test(m);
export const NEEDS_STEP = "Switched on by the database step v4_6_6_system_accounts.sql.";

export async function loadSystemAccounts(): Promise<{ rows: SystemAccountStatus[]; error: string | null }> {
  const { data, error } = await supabase.rpc("reqgen_system_accounts_status");
  if (error) return { rows: [], error: missing(error.message) ? NEEDS_STEP : error.message };
  return { rows: (data || []) as SystemAccountStatus[], error: null };
}

export async function loadReleases(): Promise<{ rows: Release[]; error: string | null }> {
  const { data, error } = await supabase.from("reqgen_releases").select("id,version,title,notes,published_label,published_at").order("published_at", { ascending: false }).limit(100);
  if (error) return { rows: [], error: missing(error.message) ? NEEDS_STEP : error.message };
  return { rows: (data || []) as Release[], error: null };
}

/** The Developer account's own actions, from the Audit Log. */
export async function loadDeveloperActivity(days = 90): Promise<{ rows: AuditEvent[]; error: string | null }> {
  const to = new Date(); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0);
  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - days);
  const { data, error } = await supabase.rpc("reqgen_audit_events", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) return { rows: [], error: error.message };
  return { rows: ((data || []) as AuditEvent[]).filter(isDeveloperEvent).sort((a, b) => b.at.localeCompare(a.at)), error: null };
}

export function isDeveloperEvent(e: { actor_label: string | null }) {
  return /— Developer$/.test(String(e.actor_label || ""));
}

export function whenText(at: string | null | undefined) {
  if (!at) return "never";
  return new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
