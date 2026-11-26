"use client";

import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen 6.3.0: backup officers take over a request that waits too long (owner's YES, 25 Nov 2026).
 * After the set working minutes the request moves from the officer to the backup; if the backup does not
 * act either, it goes back to the officer and stays there, and the Registry is told. Only the review steps
 * (PD, DOD, HOD, DIN Admin, HR Coordinator, Registrar) hand over. The database does the moving
 * (reqgen_backup_handover_run, every 2 minutes); these helpers only read and save the Super Admin's choices.
 * The app keeps a copy of this file (mobile/app/src/lib/handover.ts).
 */
export type Handover = { on: boolean; minutes: number; from: string; to: string; days: string };
export const BACKUP_STAGES = ["PD", "DOD", "HOD", "DIN Admin", "HR", "Registrar"] as const;
export type BackupStage = (typeof BACKUP_STAGES)[number];
export const DAY_SETS = [
  { value: "1,2,3,4,5", label: "Monday to Friday" },
  { value: "1,2,3,4,5,6", label: "Monday to Saturday" },
  { value: "1,2,3,4,5,6,7", label: "Every day" },
];
export const HOURS = Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`); // 6:00 AM to 10:00 PM
export const MINUTE_CHOICES = [10, 15, 20, 25, 30, 45, 60, 90, 120];
export const DEFAULT_HANDOVER: Handover = { on: true, minutes: 25, from: "08:00", to: "17:00", days: "1,2,3,4,5" };

/** "17:00" -> "5:00 PM" (all ReqGen times are 12-hour). */
export function clock12(hhmm: string) {
  const [h, m] = String(hhmm || "00:00").split(":").map((x) => Number(x) || 0);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export const daysText = (days: string) => DAY_SETS.find((d) => d.value === days)?.label || "the chosen days";
export function handoverSummary(h: Handover) {
  if (!h.on) return "Off: requests stay with the officer until they act.";
  return `After ${h.minutes} working minutes (${daysText(h.days)}, ${clock12(h.from)} to ${clock12(h.to)}): officer, then backup, then back to the officer. The Registry is told.`;
}
const key = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function stageOf(s: string): BackupStage | null {
  const k = key(s);
  if (k === "po" || k === "pd") return "PD";
  if (k === "hrcoordinator") return "HR";
  return BACKUP_STAGES.find((b) => key(b) === k) || null;
}

export async function loadHandover(): Promise<Handover> {
  const { data, error } = await supabase.rpc("reqgen_handover_settings");
  if (error || !data) return DEFAULT_HANDOVER;
  const d = data as Partial<Handover>;
  return { on: d.on !== false, minutes: Number(d.minutes) || 25, from: d.from || "08:00", to: d.to || "17:00", days: d.days || "1,2,3,4,5" };
}
export async function saveHandover(h: Handover) {
  const { error } = await supabase.rpc("reqgen_handover_settings_save", { p_on: h.on, p_minutes: h.minutes, p_from: h.from, p_to: h.to, p_days: h.days });
  if (error) throw new Error(error.message.replace(/^REQGEN_[A-Z_]+:\s*/, ""));
}
/** The first backup (priority 2) for each review step of one department. */
export async function loadDeptBackups(deptId: string): Promise<Partial<Record<BackupStage, string>>> {
  const { data } = await supabase.from("reqgen_stage_backups").select("stage,user_id,priority,is_active").eq("dept_id", deptId).eq("is_active", true).order("priority");
  const out: Partial<Record<BackupStage, string>> = {};
  ((data || []) as Array<{ stage: string; user_id: string }>).forEach((b) => { const s = stageOf(b.stage); if (s && !out[s]) out[s] = b.user_id; });
  return out;
}
export async function setDeptBackup(deptId: string, stage: BackupStage, userId: string | null) {
  const { error } = await supabase.rpc("reqgen_set_stage_backup", { p_dept_id: deptId, p_stage: stage, p_user_id: userId || null });
  if (error) throw new Error(error.message.replace(/^REQGEN_[A-Z_]+:\s*/, ""));
}
