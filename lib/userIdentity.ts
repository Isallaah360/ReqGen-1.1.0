import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";

/**
 * ReqGen v3.0.2 identity standard: every person shown anywhere in the app is
 * shown with their role — "ISAH USMAN BARDE · Admin". This module provides the
 * canonical role labels and a cached people→role directory so pages that only
 * know a name or a user id can still show the role.
 */
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  auditor: "Auditor",
  account: "Account Officer",
  accounts: "Account Officer",
  accountofficer: "Account Officer",
  pvsigner: "PV Signer",
  pvcountersigner: "PV Countersigner",
  hr: "HR",
  hrboss: "HR Boss",
  hrofficer: "HR Officer",
  hrofficer1: "HR Officer 1",
  hrofficer2: "HR Officer 2",
  hrofficer3: "HR Officer 3",
  registry: "Registry",
  registrar: "Registrar",
  generalsecretary: "General Secretary",
  dinadmin: "DIN Admin",
  dg: "DG",
  director: "Director",
  dod: "DOD",
  hod: "HOD",
  po: "PO",
  staff: "Staff",
  system: "System",
};

/** Canonical, human-readable role label ("accountofficer" → "Account Officer"). */
export function roleLabel(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—" || raw === "-") return "";
  const key = normalizeRole(raw);
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  // Already a readable label (e.g. "Registrar / HR") — keep it as recorded.
  return raw;
}

/** Plain-text form for CSV, print and tooltips: "Name · Role" (or just the name). */
export function nameWithRole(name: string | null | undefined, role: string | null | undefined): string {
  const person = String(name ?? "").trim() || "—";
  const label = roleLabel(role);
  return label ? `${person} · ${label}` : person;
}

export type RoleDirectory = {
  nameById: (id: string | null | undefined) => string;
  roleById: (id: string | null | undefined) => string;
  roleByName: (name: string | null | undefined) => string;
};

let directoryPromise: Promise<RoleDirectory> | null = null;
let directoryLoadedAt = 0;
const DIRECTORY_TTL_MS = 5 * 60 * 1000;

function nameKey(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Loads profiles (id, full_name, email, role) once and caches them for five
 * minutes across every page in the browser session. Read-only.
 */
export function loadRoleDirectory(): Promise<RoleDirectory> {
  if (directoryPromise && Date.now() - directoryLoadedAt < DIRECTORY_TTL_MS) return directoryPromise;
  directoryLoadedAt = Date.now();
  directoryPromise = (async () => {
    const byId = new Map<string, string>();
    const names = new Map<string, string>();
    const byName = new Map<string, string>();
    const { data } = await supabase.from("profiles").select("id,full_name,email,role").limit(5000);
    (data || []).forEach((row: { id?: string | null; full_name?: string | null; email?: string | null; role?: string | null }) => {
      if (row.id) names.set(row.id, String(row.full_name || row.email || "").trim());
      const label = roleLabel(row.role);
      if (!label) return;
      if (row.id) byId.set(row.id, label);
      if (row.full_name) byName.set(nameKey(row.full_name), label);
      if (row.email) byName.set(nameKey(row.email), label);
    });
    const directory: RoleDirectory = {
      nameById: (id) => (id ? names.get(id) || "" : ""),
      roleById: (id) => (id ? byId.get(id) || "" : ""),
      roleByName: (name) => byName.get(nameKey(name)) || "",
    };
    return directory;
  })().catch((): RoleDirectory => ({ nameById: () => "", roleById: () => "", roleByName: () => "" }));
  return directoryPromise;
}
