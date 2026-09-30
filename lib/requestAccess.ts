import { isAwaitingUser, queueRoleKey } from "@/lib/approvalQueue";

/**
 * ReqGen v3.0.3 — who may open a request's FULL details (content, amounts,
 * attachments, edit and print). One rule, used everywhere:
 *
 *   1. the requester who created it;
 *   2. the officer it is currently routed to (awaiting their action);
 *   3. any officer who has already acted on it (recorded in request_history);
 *   4. the Account Officer assigned to process it;
 *   5. oversight roles (Admin, Auditor) — see OVERSIGHT_ROLES below.
 *
 * Everyone else — including the Registry role, which tracks movement only —
 * is refused. The database (RLS) remains the final authority; this gate makes
 * the app enforce the same rule before any content is even fetched.
 */
export const REQUEST_OVERSIGHT_ROLES = new Set(["admin", "auditor"]);

export type RequestAccessFacts = {
  created_by: string | null;
  current_owner: string | null;
  current_stage: string | null;
  status: string | null;
  assigned_account_officer_id: string | null;
};

export type RequestAccessReason =
  | "requester"
  | "awaiting-you"
  | "you-acted"
  | "account-officer"
  | "oversight"
  | "registry-movement-only"
  | "not-involved";

export function evaluateRequestAccess({
  request,
  userId,
  activeRole,
  actorIds,
}: {
  request: RequestAccessFacts;
  userId: string;
  activeRole: string;
  actorIds: Iterable<string | null | undefined>;
}): { allowed: boolean; reason: RequestAccessReason } {
  const role = queueRoleKey(activeRole);
  if (role === "registry") return { allowed: false, reason: "registry-movement-only" };
  if (request.created_by && request.created_by === userId) return { allowed: true, reason: "requester" };
  if (isAwaitingUser(request, userId, role)) return { allowed: true, reason: "awaiting-you" };
  for (const id of actorIds) if (id && id === userId) return { allowed: true, reason: "you-acted" };
  if (request.assigned_account_officer_id && request.assigned_account_officer_id === userId) return { allowed: true, reason: "account-officer" };
  if (REQUEST_OVERSIGHT_ROLES.has(role)) return { allowed: true, reason: "oversight" };
  return { allowed: false, reason: "not-involved" };
}
