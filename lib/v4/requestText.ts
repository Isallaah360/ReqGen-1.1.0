/**
 * ReqGen v4 — plain words for request stages and statuses (PO shows as PD,
 * HR as HR Coordinator), used by every v4 list.
 */
import type { ChipTone } from "@/app/components/v4/ui";

const STAGE_WORDS: Record<string, string> = {
  SUBMITTED: "Submitted",
  PO: "With the PD",
  PD: "With the PD",
  DOD: "With the DOD",
  DIRECTOR: "With the DOD",
  DINADMIN: "With the DIN Admin",
  REGISTRAR: "With the Registrar",
  REGISTRY: "With the Registrar",
  HOD: "With the HOD",
  HR: "With the HR Coordinator",
  DG: "With the Director General",
  ACCOUNT: "With Account for payment",
  HRFILING: "With HR for filing",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Closed",
  DELETED: "Deleted",
};

export function stageKey(stage: string | null | undefined) {
  return String(stage || "").toUpperCase().replace(/[\s_-]+/g, "");
}

export function stageWords(stage: string | null | undefined) {
  const k = stageKey(stage);
  return STAGE_WORDS[k] || (stage ? `At ${stage}` : "Not yet submitted");
}

export function statusChip(status: string | null | undefined, stage?: string | null): { tone: ChipTone; label: string } {
  const s = String(status || "").toLowerCase();
  const k = stageKey(stage);
  if (/withdrawn/.test(s)) return { tone: "grey", label: "Withdrawn" };
  if (/reject|cancel|delete/.test(s) || k === "REJECTED") return { tone: "red", label: "Rejected" };
  if (/returned by the director general/.test(s)) return { tone: "amber", label: "Sent back by the DG" };
  if (/return|correct|query/.test(s)) return { tone: "red", label: "Returned" };
  if (/paid/.test(s) && !/pending/.test(s)) return { tone: "green", label: "Paid" };
  if (/complet|closed/.test(s) || k === "COMPLETED") return { tone: "green", label: "Completed" };
  if (/approv/.test(s) || k === "ACCOUNT") return { tone: "green", label: "Approved" };
  if (/draft/.test(s)) return { tone: "grey", label: "Draft" };
  return { tone: "amber", label: "In approval" };
}

export function shortDate(iso: string | null | undefined) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function waitedFor(iso: string | null | undefined) {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"}`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function ageDays(iso: string | null | undefined) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 86_400_000) : 0;
}
