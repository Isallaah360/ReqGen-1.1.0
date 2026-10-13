import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen v4.5 — Registry helpers. Registry works with numbers, dates, offices
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
  let q = supabase.from("registry_correspondence").select(CORR_COLUMNS).order("created_at", { ascending: false }).limit(5000);
  if (direction !== "all") q = q.eq("direction", direction);
  const { data, error } = await q;
  return { rows: (data || []) as Corr[], error: error?.message || null };
}

export function ageText(iso: string | null | undefined, now: number) {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}
export const ageDaysOf = (iso: string | null | undefined, now: number) => (iso ? (now - new Date(iso).getTime()) / 86400000 : 0);

/** In-app reminder + SMS + email (one an hour), through /api/registry/remind; in-app only if the route is unreachable. */
export async function remindRequest(id: string): Promise<{ error: string | null; sentTo?: string }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { error: "Your session has expired. Please sign in again." };
  try {
    const res = await fetch("/api/registry/remind", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ requestId: id }) });
    const out = (await res.json()) as { ok: boolean; error?: string; recipient?: string | null; sms?: string; email?: string };
    if (!res.ok || !out.ok) return { error: out.error || "The reminder could not be sent." };
    return { error: null, sentTo: out.recipient ? `${out.recipient} (in-app, SMS ${out.sms}, email ${out.email})` : "the officer" };
  } catch {
    const { data, error } = await supabase.rpc("reqgen_request_remind", { p_request_id: id, p_automatic: false });
    return error ? { error: error.message } : { error: null, sentTo: `${(data as { sent_to?: string } | null)?.sent_to || "the officer"} (in-app)` };
  }
}

export const RETENTION = [
  { value: "Financial records — 6 years", years: 6 },
  { value: "Correspondence — 3 years", years: 3 },
  { value: "Staff records — 7 years", years: 7 },
  { value: "Contracts and agreements — 10 years", years: 10 },
  { value: "Board minutes and deeds — permanent", years: 0 },
];
