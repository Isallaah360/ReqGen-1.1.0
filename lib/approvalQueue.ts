/**
 * ReqGen approval queue — the single source of truth (v3.0.2) for deciding
 * whether a request is closed and whether it is waiting on a given user.
 * Used by BOTH the top-bar bell / sidebar badge and the Approvals page, so the
 * number on the bell always matches what the user can actually act on.
 */
export type ApprovalQueueRow = {
  current_owner?: string | null;
  current_stage?: string | null;
  status?: string | null;
};

export function queueRoleKey(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalized === "deanadmin" ? "dinadmin" : normalized;
}

export function queueStageKey(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
}

/** Workflow stages each role is responsible for approving. */
export const STAGES_FOR_ROLE: Record<string, string[]> = {
  po: ["PO"],
  dod: ["DOD"],
  director: ["DOD", "DIRECTOR"],
  dinadmin: ["DINADMIN"],
  registrar: ["REGISTRAR"],
  // Registry tracks movement only and is never an approval stage (v3.0.2).
  registry: [],
  gensec: ["GENERALSECRETARY", "GENSEC"],
  generalsecretary: ["GENERALSECRETARY", "GENSEC"],
  hod: ["HOD"],
  hr: ["HR", "HRFILING"],
  hrboss: ["HR", "HRFILING"],
  hrofficer: ["HR", "HRFILING"],
  hrofficer1: ["HR", "HRFILING"],
  hrofficer2: ["HR", "HRFILING"],
  hrofficer3: ["HR", "HRFILING"],
  dg: ["DG"],
  account: ["ACCOUNT"],
  accounts: ["ACCOUNT"],
  accountofficer: ["ACCOUNT"],
};

/** Roles that may view every request for oversight (not as approvers). */
export const OVERSIGHT_ROLES = new Set(["admin", "auditor"]);

export function isClosedRequest(row: ApprovalQueueRow) {
  const status = String(row.status || "").toLowerCase();
  const stage = queueStageKey(row.current_stage);
  return ["COMPLETED", "REJECTED", "DELETED", "CANCELLED"].includes(stage) ||
    ["approved", "paid", "completed", "closed", "rejected", "deleted", "cancelled"].some((token) => status.includes(token));
}

/** True when the request is open AND it is this user's turn to act on it. */
export function isAwaitingUser(row: ApprovalQueueRow, userId: string, role: string) {
  if (isClosedRequest(row)) return false;
  if (row.current_owner && row.current_owner === userId) return true;
  const stages = STAGES_FOR_ROLE[queueRoleKey(role)] || [];
  return stages.includes(queueStageKey(row.current_stage));
}

/** Rows a user may see on the Approvals page (oversight roles see everything). */
export function isVisibleInApprovals(row: ApprovalQueueRow, userId: string, role: string) {
  if (OVERSIGHT_ROLES.has(queueRoleKey(role))) return true;
  if (row.current_owner && row.current_owner === userId) return true;
  const stages = STAGES_FOR_ROLE[queueRoleKey(role)] || [];
  return stages.includes(queueStageKey(row.current_stage));
}

/** Browser event fired after any approval action so every badge refreshes instantly. */
export const APPROVAL_QUEUE_CHANGED_EVENT = "reqgen-approval-queue-changed";
