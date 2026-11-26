/** Plain words, money and dates for the app (the same wording as the website). */
export const naira = (n: number | string | null | undefined) => {
  const v = Number(n || 0);
  return `₦${v.toLocaleString("en-NG", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
};
export const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).replace(/(\d) ?([ap])m\b/i, (_m, d, x) => `${d} ${x.toUpperCase()}M`) : "";
export const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
export const clock = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/(\d) ?([ap])m\b/i, (_m, d, x) => `${d} ${x.toUpperCase()}M`);
export function ago(iso?: string | null) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "1 day" : `${d} days`;
}
export const initials = (n?: string | null) =>
  String(n || "S").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "S";
export const first = (n?: string | null) => String(n || "").trim().split(/\s+/)[0] || "";

export const stageKey = (s?: string | null) => String(s || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
const STAGE: Record<string, string> = {
  HOD: "the HOD", PD: "the PD", PO: "the PD", DOD: "the Director", DIRECTOR: "the Director", DINADMIN: "the Dean Admin",
  REGISTRAR: "the Registrar", REGISTRY: "the Registrar", GENERALSECRETARY: "the General Secretary", GENSEC: "the General Secretary",
  HR: "HR", HRFILING: "HR for filing", DG: "the DG", ACCOUNT: "Account",
};
export const withWho = (stage?: string | null) => STAGE[stageKey(stage)] || stage || "the next officer";

export type Tone = "ok" | "wa" | "er" | "in" | "mu" | "or";
/** The status chip for a request, in the same words as the website. */
export function statusChip(r: { status?: string | null; current_stage?: string | null }): { text: string; tone: Tone } {
  const s = String(r.status || "").toLowerCase();
  const k = stageKey(r.current_stage);
  if (/returned for correction/.test(s)) return { text: "Back with me", tone: "er" };
  if (/sent directly/.test(s)) return { text: "Direct", tone: "in" };
  if (/answered/.test(s)) return { text: "Answered", tone: "ok" };
  if (/paid/.test(s) && !/pending/.test(s)) return { text: "Paid", tone: "ok" };
  if (k === "COMPLETED" || /completed/.test(s)) return { text: "Completed", tone: "ok" };
  if (/reject|declin/.test(s) || k === "REJECTED") return { text: "Rejected", tone: "er" };
  if (/withdraw|cancel/.test(s) || k === "CANCELLED") return { text: "Withdrawn", tone: "mu" };
  if (/draft/.test(s)) return { text: "Draft", tone: "mu" };
  if (k === "ACCOUNT") return { text: "With Account", tone: "in" };
  if (/approved/.test(s)) return { text: "Approved", tone: "ok" };
  if (k === "SUBMITTED" || /submitted|sent/.test(s)) return { text: "Sent", tone: "in" };
  return { text: "In approval", tone: "wa" };
}
export function isClosed(r: { status?: string | null; current_stage?: string | null }) {
  const s = String(r.status || "").toLowerCase();
  const k = stageKey(r.current_stage);
  if (["COMPLETED", "REJECTED", "DELETED", "CANCELLED", "CLOSED", "PAID"].includes(k)) return true;
  if (s.includes("pending")) return false;
  return ["paid", "completed", "closed", "rejected", "deleted", "cancelled", "withdrawn"].some((t) => s.includes(t));
}
/** Same single rule as the website: waiting for me only when I own it, or I am the Account Officer at Account. */
export function waitingForMe(r: { current_owner?: string | null; current_stage?: string | null; status?: string | null; assigned_account_officer_id?: string | null; assigned_account_officer_user_id?: string | null }, me: string) {
  if (!me || isClosed(r)) return false;
  if (/returned for correction/i.test(String(r.status || ""))) return false;
  if (r.current_owner) return r.current_owner === me;
  if (stageKey(r.current_stage) === "ACCOUNT") return r.assigned_account_officer_id === me || r.assigned_account_officer_user_id === me;
  return false;
}
export const maskPhone = (p?: string | null) => { const d = String(p || "").replace(/\D/g, ""); return d.length >= 7 ? `${d.slice(0, 4)} *** ${d.slice(-4)}` : "your phone"; };
export const maskMail = (m?: string | null) => { const [u, h] = String(m || "").split("@"); return u && h ? `${u[0]}***@${h}` : "your e-mail"; };
