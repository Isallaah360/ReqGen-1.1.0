"use client";

import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen v4.6 — Administration helpers: the position catalogue (mock-up 83),
 * the permissions matrix (mock-up 84) and calls to the admin server routes.
 */

export type PersonPosition = { key: string; name: string; primary: boolean; since: string | null };
export type AdminPerson = {
  id: string; full_name: string; email: string; dept_id: string | null; dept_name: string | null; is_active: boolean;
  system_account: "superadmin" | "developer" | null; positions: PersonPosition[]; has_2fa: boolean; fingerprints: number;
  passcodes: number; last_sign_in: string | null; has_signature: boolean; created_at: string | null;
};

export type PositionGroup = "Base level" | "Leadership" | "Departments" | "Offices" | "System";
export type PositionDef = { code: string; name: string; group: PositionGroup; keys: string[]; about: string; one?: boolean; renamed?: string; chip: "staff" | "lead" | "office" | "dept" | "sys" };

/** Everyone is Staff; these sit on top (Build Reference §3). */
export const POSITIONS: PositionDef[] = [
  { code: "STAFF", name: "Staff", group: "Base level", keys: ["staff"], chip: "staff", about: "Everyone in IET. Can raise requests, see their own requests, payments and print register, and reopen their own closed request." },
  { code: "DG", name: "Director General", group: "Leadership", keys: ["dg", "directorgeneral"], one: true, chip: "lead", about: "President of the Islamic Education Trust. Final approval of requests; signs, stamps and authorises vouchers." },
  { code: "GS", name: "General Secretary", group: "Leadership", keys: ["generalsecretary", "gensec"], one: true, chip: "lead", about: "General Secretary of the Trust. Acts for the DG when the DG is away — signs and stamps “for the DG”." },
  { code: "PA", name: "PA to the DG", group: "Leadership", keys: ["padg"], chip: "lead", about: "Personal Assistant to the Director General. Manages the DG’s queue and correspondence." },
  { code: "DOD", name: "Director of Department", group: "Departments", keys: ["dod", "director"], chip: "dept", about: "Approves requests from their department." },
  { code: "HOD", name: "Head of Department", group: "Departments", keys: ["hod"], chip: "dept", about: "Approves requests from their unit." },
  { code: "PD", name: "Program Director", group: "Departments", keys: ["pd", "po"], renamed: "Was “PO”", chip: "dept", about: "First check on ASAP-ALLI requests. Replaces “PO” everywhere." },
  { code: "DIN", name: "DIN Admin", group: "Offices", keys: ["dinadmin", "deanadmin"], chip: "office", about: "Checks requests for the DIN route. Spelt D-I-N everywhere." },
  { code: "REG", name: "Registrar", group: "Offices", keys: ["registrar"], one: true, chip: "office", about: "Registrar of IET." },
  { code: "HRC", name: "HR Coordinator", group: "Offices", keys: ["hrcoordinator", "hrboss"], one: true, chip: "office", about: "Head of Human Resources. Every HR request passes through the HR Coordinator." },
  { code: "HR", name: "HR Officer", group: "Offices", keys: ["hr", "hrofficer"], chip: "office", about: "Human Resources staff. Prepares HR files." },
  { code: "ACC", name: "Account Officer", group: "Offices", keys: ["accountofficer", "account", "accounts"], chip: "office", about: "Releases funds and prepares vouchers for one account: General Admin, DIN or ASAP-ALLI." },
  { code: "AUD", name: "Auditor", group: "Offices", keys: ["auditor"], one: true, chip: "office", about: "Internal Auditor. Checks every voucher — nobody chooses an auditor." },
  { code: "CS", name: "Counter Signer", group: "Offices", keys: ["pvcountersigner", "pvsigner"], chip: "office", about: "Counter-signs vouchers after the Auditor." },
  { code: "RGY", name: "Registry", group: "Offices", keys: ["registry"], chip: "office", about: "Tracks, files, dispatches and archives. Never sees request contents." },
  { code: "SA", name: "Super Admin", group: "System", keys: ["superadmin"], one: true, chip: "sys", about: "The Trust’s own account for running ReqGen. Not a person." },
  { code: "DEV", name: "Developer", group: "System", keys: ["developer"], one: true, chip: "sys", about: "Barderian Enterprises. Maintenance, releases and repairs." },
];

const norm = (k: string) => String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/\d+$/, "");
export function positionFor(key: string): PositionDef | null {
  const k = norm(key);
  return POSITIONS.find((p) => p.keys.includes(k)) || null;
}
/** The positions a person holds, in catalogue order (Staff is implied, the "admin" key is a system account). */
export function positionsOf(person: Pick<AdminPerson, "positions" | "system_account">) {
  const out: Array<{ def: PositionDef; primary: boolean; since: string | null }> = [];
  if (person.system_account) out.push({ def: POSITIONS.find((p) => p.keys.includes(person.system_account!))!, primary: true, since: null });
  for (const p of person.positions) {
    const def = positionFor(p.key);
    if (def && def.code !== "STAFF" && !out.some((o) => o.def.code === def.code)) out.push({ def, primary: p.primary, since: p.since });
  }
  return out.sort((a, b) => POSITIONS.indexOf(a.def) - POSITIONS.indexOf(b.def));
}
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** Role keys offered when giving a position (the database checks the catalogue). */
export const ASSIGNABLE: Array<{ key: string; label: string }> = [
  { key: "dg", label: "Director General" }, { key: "generalsecretary", label: "General Secretary" }, { key: "padg", label: "PA to the DG" },
  { key: "director", label: "DOD — Director of Department" }, { key: "hod", label: "HOD — Head of Department" }, { key: "pd", label: "PD — Program Director" },
  { key: "dinadmin", label: "DIN Admin" }, { key: "registrar", label: "Registrar" }, { key: "hrcoordinator", label: "HR Coordinator" },
  { key: "hrofficer", label: "HR Officer" }, { key: "accountofficer", label: "Account Officer" }, { key: "auditor", label: "Auditor" },
  { key: "pvcountersigner", label: "Counter Signer" }, { key: "registry", label: "Registry" },
];

/**
 * The permissions matrix (mock-up 84). It describes what ReqGen enforces —
 * page rules in lib/permissions.ts and the database functions — so it is shown,
 * printed and exported here, and changed only by a release.
 * y = allowed · route = only when routed to them · own = only their own · n = not allowed · view = can look, not change
 */
export type Cell = "y" | "route" | "own" | "n" | "view";
export const MATRIX_COLUMNS = ["Staff", "DG", "GS", "PA", "DOD", "HOD", "PD", "DIN", "Reg.", "HRC", "Acct", "Aud.", "Rgy", "SA", "Dev"] as const;
const all = (v: Cell): Cell[] => MATRIX_COLUMNS.map(() => v);
const cells = (spec: Partial<Record<(typeof MATRIX_COLUMNS)[number], Cell>>, rest: Cell = "n"): Cell[] => MATRIX_COLUMNS.map((c) => spec[c] ?? rest);
export const MATRIX: Array<{ group: string; rows: Array<{ action: string; cells: Cell[] }> }> = [
  { group: "Requests", rows: [
    { action: "Raise a request", cells: cells({ SA: "n", Dev: "n" }, "y") },
    { action: "Open request contents", cells: cells({ Staff: "own", Rgy: "n", SA: "n", Dev: "n" }, "route") },
    { action: "Approve / return / reject", cells: cells({ DG: "y", GS: "route", DOD: "route", HOD: "route", PD: "route", DIN: "route", "Reg.": "route", HRC: "route" }) },
    { action: "Final approval + IET stamp", cells: cells({ DG: "y", GS: "route" }) },
    { action: "Reopen a closed request (reason logged)", cells: cells({ Staff: "own", Acct: "y", "Aud.": "y", SA: "y", Dev: "y" }) },
  ] },
  { group: "Money", rows: [
    { action: "Release fund · prepare voucher", cells: cells({ Acct: "y" }) },
    { action: "Check voucher", cells: cells({ "Aud.": "y" }) },
    { action: "Sign, stamp and authorise voucher", cells: cells({ DG: "y", GS: "route" }) },
    // the same rule as lib/v4/budgetVisibility.ts (owner's instruction, 12 Oct 2026)
    { action: "See subhead balances", cells: cells({ DG: "y", GS: "y", DOD: "y", HOD: "y", DIN: "y", "Reg.": "y", HRC: "y", Acct: "y", "Aud.": "y", SA: "y", Dev: "y" }) },
  ] },
  { group: "Registry and oversight", rows: [
    { action: "Track, file, dispatch, archive", cells: cells({ "Reg.": "y", Rgy: "y", "Aud.": "view", SA: "y", Dev: "y" }) },
    { action: "Reports (own scope)", cells: all("y") },
    { action: "Audit Log", cells: cells({ "Aud.": "y", SA: "y", Dev: "y" }) },
  ] },
  { group: "System", rows: [
    { action: "Staff, positions, departments, routing", cells: cells({ SA: "y", Dev: "y" }) },
    { action: "Security rules, reset 2FA / passcode", cells: cells({ SA: "y", Dev: "y" }) },
    { action: "Restore backup", cells: cells({ SA: "y", Dev: "y" }) },
    { action: "Releases, database changes, repairs", cells: cells({ Dev: "y" }) },
  ] },
];
export const CELL_TEXT: Record<Cell, string> = { y: "✓", route: "route", own: "own", n: "—", view: "view" };

/** Call an Administration server route as the signed-in person. */
export async function adminApi<T = { ok: boolean; error?: string }>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T & { ok: boolean; error?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Your session has ended. Please sign in again." } as T & { ok: boolean; error?: string };
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  return { ...json, ok: res.ok && json.ok !== false } as T & { ok: boolean; error?: string };
}

export const whenText = (d: string | null | undefined) => {
  if (!d) return "Never";
  const t = new Date(d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const hm = t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (t >= today) return `Today ${hm}`;
  return `${t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: t.getFullYear() === today.getFullYear() ? undefined : "numeric" })} · ${hm}`;
};
