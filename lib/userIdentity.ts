import { normalizeRole } from "@/lib/roles";

/**
 * ReqGen v3.0.2 identity standard: every person shown anywhere in the app is
 * shown with their role — "ISAH USMAN BARDE · Admin". This module provides the
 * canonical role labels.
 */
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  auditor: "Auditor",
  account: "Account Officer",
  accounts: "Account Officer",
  accountofficer: "Account Officer",
  pvsigner: "PV Signer",
  pvcountersigner: "PV Countersigner",
  hr: "HR Officer",
  hrboss: "HR Coordinator",
  hrcoordinator: "HR Coordinator",
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
  po: "PD",
  pd: "PD",
  staff: "Staff",
  system: "System",
};

/** Canonical, human-readable role label ("accountofficer" → "Account Officer"). */
export function roleLabel(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—" || raw === "-") return "";
  const key = normalizeRole(raw);
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  // v4.6.7: an HR section permission recorded as the acting role reads as HR Officer.
  if (key.startsWith("hr:")) return "HR Officer";
  // Already a readable label (e.g. "Registrar / HR") — keep it as recorded.
  return raw;
}

/** Plain-text form for CSV, print and tooltips: "Name · Role" (or just the name). */
export function nameWithRole(name: string | null | undefined, role: string | null | undefined): string {
  const person = String(name ?? "").trim() || "—";
  const label = roleLabel(role);
  return label ? `${person} · ${label}` : person;
}
