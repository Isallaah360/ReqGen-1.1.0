/**
 * ReqGen department routing — single source of truth (v3.0.4).
 *
 * The approval flow a request follows depends on the requester's department
 * group and the request type. The New Request page (which tells staff the
 * route) and Admin → Department Routing (where the route's people are set)
 * both use these rules, so they can never disagree.
 *
 * Who fills each step:
 *   DOD  → the department's Director   (departments.director_user_id)
 *   HOD  → the department's HOD        (departments.hod_user_id)
 *   PO   → staff holding the PO role   (Admin → Users)
 *   DIN Admin, Registrar, HR, DG, AccountOfficer → global officers
 *          (Admin → System Settings / Account Routing)
 */
export type RouteRequestType = "Official" | "Personal";
export type RouteCategory = "Fund" | "Other" | string;
export type DeptGroup = "DIN" | "ASAP-ALLI" | "Welfare" | "Liaison" | "General Admin";

export function deptGroupName(name: string | null | undefined): DeptGroup {
  const clean = String(name || "").toUpperCase();
  if (clean.includes("DIN")) return "DIN";
  if (clean.includes("ASAP") || clean.includes("ALLI")) return "ASAP-ALLI";
  if (clean.includes("WELFARE")) return "Welfare";
  if (clean.includes("LIAISON")) return "Liaison";
  return "General Admin";
}

/** Ordered approval steps (as displayed to staff). */
export function routeSteps(type: RouteRequestType, category: RouteCategory, deptName: string | null | undefined): string[] {
  const group = deptGroupName(deptName);
  if (type === "Official") {
    if (group === "DIN") return ["Staff", "DOD", "DIN Admin", "Registrar", "DG", "AccountOfficer"];
    if (group === "ASAP-ALLI") return ["Staff", "PO", "DOD", "HOD", "DG", "AccountOfficer"];
    if (group === "Welfare" || group === "Liaison") return ["Staff", "DOD", "DG", "AccountOfficer"];
    return ["Staff", "HOD", "DG", "AccountOfficer"];
  }
  if (category === "Fund") {
    if (group === "ASAP-ALLI") return ["Staff", "DOD", "HOD", "HR", "DG", "AccountOfficer", "HR Filing", "Staff & DOD/HOD"];
    if (group === "General Admin") return ["Staff", "HOD", "HR", "DG", "AccountOfficer", "HR Filing", "Staff & HOD"];
    return ["Staff", "DOD", "HR", "DG", "AccountOfficer", "HR Filing", "Staff & DOD"];
  }
  if (group === "ASAP-ALLI") return ["Staff", "DOD", "HOD", "HR", "DG", "HR Filing", "Staff & DOD/HOD"];
  if (group === "General Admin") return ["Staff", "HOD", "HR", "DG", "HR Filing", "Staff & HOD"];
  return ["Staff", "DOD", "HR", "DG", "HR Filing", "Staff & DOD"];
}

export function routeLabel(type: RouteRequestType, category: RouteCategory) {
  if (type === "Official") return "Official";
  return category === "Fund" ? "Personal Fund" : "Personal Other";
}

/** The sentence shown to staff on the New Request page. */
export function routingNoteFor(type: RouteRequestType, category: RouteCategory, deptName: string | null | undefined) {
  return `${deptGroupName(deptName)} ${routeLabel(type, category)} route: ${routeSteps(type, category, deptName).join(" → ")}.`;
}

/** The three request routes every department has. */
export const ROUTE_KINDS: Array<{ type: RouteRequestType; category: RouteCategory; label: string }> = [
  { type: "Official", category: "", label: "Official" },
  { type: "Personal", category: "Fund", label: "Personal Fund" },
  { type: "Personal", category: "Other", label: "Personal Other" },
];

/** Steps that are filled by a person (not the requester or a filing step). */
export type ApproverSlot = "DOD" | "HOD" | "PO" | "DIN Admin" | "Registrar" | "HR" | "DG" | "AccountOfficer";
const SLOTS: ApproverSlot[] = ["DOD", "HOD", "PO", "DIN Admin", "Registrar", "HR", "DG", "AccountOfficer"];

/** Every approver slot a department needs across all three routes. */
export function requiredSlots(deptName: string | null | undefined): ApproverSlot[] {
  const needed = new Set<ApproverSlot>();
  for (const kind of ROUTE_KINDS) {
    for (const step of routeSteps(kind.type, kind.category, deptName)) {
      if ((SLOTS as string[]).includes(step)) needed.add(step as ApproverSlot);
    }
  }
  return SLOTS.filter((slot) => needed.has(slot));
}

/** Which app_settings key holds each global officer. */
export const GLOBAL_SLOT_SETTING: Partial<Record<ApproverSlot, string>> = {
  "DIN Admin": "DIN_ADMIN_USER_ID",
  Registrar: "REGISTRAR_USER_ID",
  HR: "HR_USER_ID",
  DG: "DG_USER_ID",
};
