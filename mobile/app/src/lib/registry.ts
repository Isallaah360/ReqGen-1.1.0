import { db, office } from "./core";

/**
 * ReqGen app (copied from the website lib/v4/registry.ts): Registry helpers. Registry works with numbers, dates, offices
 * and people only; nothing here reads a request's title, amount or contents.
 */

export type Corr = {
  id: string; reference_no: string | null; subject: string | null; direction: string | null; from_to: string | null; department_id: string | null;
  priority: string | null; status: string | null; received_at: string | null; created_at: string | null; acknowledged_at: string | null;
  forwarded_at: string | null; dispatch_method: string | null; dispatched_at: string | null; receiver_name: string | null; delivered_at: string | null;
  items_count: number | null; note: string | null; archived_at: string | null; created_by_label: string | null; dispatched_by_label: string | null;
};
export const CORR_COLUMNS = "id,reference_no,subject,direction,from_to,department_id,priority,status,received_at,created_at,acknowledged_at,forwarded_at,dispatch_method,dispatched_at,receiver_name,delivered_at,items_count,note,archived_at,created_by_label,dispatched_by_label";

export type Track = { id: string; request_no: string | null; office: string; request_type: string; stage: string; owner_id: string | null; owner_name: string; waiting_since: string; status: string; created_at: string; last_reminder: string | null };

export async function loadCorrespondence(direction: "incoming" | "outgoing" | "all") {
  let q = (await db()).from("registry_correspondence").select(CORR_COLUMNS).order("created_at", { ascending: false }).limit(5000);
  if (direction !== "all") q = q.eq("direction", direction);
  const { data, error } = await q;
  return { rows: (data || []) as Corr[], error: error?.message || null };
}

export function ageText(iso: string | null | undefined, now: number) {
  if (!iso) return "-";
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}
export const ageDaysOf = (iso: string | null | undefined, now: number) => (iso ? (now - new Date(iso).getTime()) / 86400000 : 0);

/** App notice + SMS + e-mail (one an hour) through the reqgen-office Edge Function; app notice only if it cannot be reached. */
export async function remindRequest(id: string): Promise<{ error: string | null; sentTo?: string }> {
  try {
    const out = await office<{ recipient?: string | null; sms?: string; email?: string }>("registry_remind", { body: { requestId: id } });
    return { error: null, sentTo: out.recipient ? `${out.recipient} (in the app, SMS ${out.sms}, e-mail ${out.email})` : "the officer" };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (/hour|already|not allowed|only/i.test(m)) return { error: m };
    const { data, error } = await (await db()).rpc("reqgen_request_remind", { p_request_id: id, p_automatic: false });
    return error ? { error: error.message } : { error: null, sentTo: `${(data as { sent_to?: string } | null)?.sent_to || "the officer"} (in the app)` };
  }
}

/** Shows a retention category without the long dash the database keeps. */
export function retentionLabel(v: string | null | undefined) {
  const r = RETENTION.find((x) => x.value === v);
  return r ? r.label : String(v || "").replace(/\s*\u2014\s*/g, ", ");
}

/** `value` is what the database keeps (unchanged); `label` is what people see. */
export const RETENTION = [
  { value: "Financial records \u2014 6 years", label: "Financial records, 6 years", years: 6 },
  { value: "Correspondence \u2014 3 years", label: "Correspondence, 3 years", years: 3 },
  { value: "Staff records \u2014 7 years", label: "Staff records, 7 years", years: 7 },
  { value: "Contracts and agreements \u2014 10 years", label: "Contracts and agreements, 10 years", years: 10 },
  { value: "Board minutes and deeds \u2014 permanent", label: "Board minutes and deeds, permanent", years: 0 },
];
