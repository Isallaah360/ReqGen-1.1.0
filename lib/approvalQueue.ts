/**
 * ReqGen approval queue — the single source of truth (v3.0.2) for deciding
 * whether a request is closed and whether it is waiting on a given user.
 * Used by BOTH the top-bar bell / sidebar badge and the Approvals page, so the
 * number on the bell always matches what the user can actually act on.
 */
export type ApprovalQueueRow = {
  current_owner?: string | null;
  assigned_account_officer_id?: string | null;
  assigned_account_officer_user_id?: string | null;
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
  // The database names the Registrar's workflow stage "Registry".
  registrar: ["REGISTRAR", "REGISTRY"],
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

/**
 * Roles that may see every request in the Approvals list. Deliberately empty
 * since v3.0.4 (IET decision): Admin and Auditor follow the same rule as
 * everyone else and use the content-free registers for oversight.
 */
export const OVERSIGHT_ROLES = new Set<string>([]);

/**
 * A request is finished only when its STAGE is final, or its status says it
 * was completed/paid/closed/rejected/cancelled/deleted. "Approved" is NOT
 * final: after DG approval a request sits at the Account stage with status
 * "Approved" and is still waiting on the Account Officer (v3.0.4 fix).
 */
export function isClosedRequest(row: ApprovalQueueRow) {
  const status = String(row.status || "").toLowerCase();
  const stage = queueStageKey(row.current_stage);
  if (["COMPLETED", "REJECTED", "DELETED", "CANCELLED", "CLOSED", "PAID"].includes(stage)) return true;
  // "Paid - Pending HR Filing" is still waiting on HR (v3.0.5 fix): any status
  // that says "pending" is open, whatever else it contains.
  if (status.includes("pending")) return false;
  return ["paid", "completed", "closed", "rejected", "deleted", "cancelled"].some((token) => status.includes(token));
}

/** True when the user is the Account Officer attached to the request (either column). */
export function isAssignedAccountOfficer(row: ApprovalQueueRow, userId: string) {
  if (!userId) return false;
  return row.assigned_account_officer_id === userId || row.assigned_account_officer_user_id === userId;
}

/**
 * v3.1.5 — THE single rule for "this request is waiting for you". Used by the
 * Approvals list, the bell/sidebar badge, the request access gate and the
 * Process screen (canAct), so a request counted as waiting can always be
 * opened AND acted on. Precise by design:
 *   1. If an officer owns the request (current_owner), ONLY that officer.
 *   2. At the Account stage with no owner yet, the attached Account Officer.
 *   3. Otherwise nobody — an un-owned request is a routing gap for Admin, not
 *      something every holder of the role should see as "waiting".
 * The Registry role tracks movement only and never has requests waiting.
 */
export function isAwaitingUser(row: ApprovalQueueRow, userId: string, role: string) {
  if (!userId || isClosedRequest(row)) return false;
  if (queueRoleKey(role) === "registry") return false;
  if (row.current_owner) return row.current_owner === userId;
  if (queueStageKey(row.current_stage) === "ACCOUNT") return isAssignedAccountOfficer(row, userId);
  return false;
}

/**
 * Open requests sitting at a stage this role handles but held by ANOTHER
 * officer (or by nobody). They are never shown as "waiting for you"; the
 * Approvals page reports them as a notice so the mismatch is visible.
 */
export function isHeldElsewhere(row: ApprovalQueueRow, userId: string, role: string) {
  if (isClosedRequest(row) || isAwaitingUser(row, userId, role)) return false;
  const stages = STAGES_FOR_ROLE[queueRoleKey(role)] || [];
  return stages.includes(queueStageKey(row.current_stage));
}

/** Browser event fired after any approval action so every badge refreshes instantly. */
export const APPROVAL_QUEUE_CHANGED_EVENT = "reqgen-approval-queue-changed";
