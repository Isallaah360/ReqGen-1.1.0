import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen v3.0.4 — content-free registers for oversight and reporting.
 *
 * From v3.0.4 the database only lets a person read a request's FULL row if
 * they created it, it is routed to them, they acted on it, or they are its
 * assigned Account Officer. Registry, Reports, Audit Centre and Finance
 * overviews still need organisation-wide movement and budget figures, so they
 * read these registers instead. The registers NEVER contain request titles,
 * details, comments, attachments or signatures — only numbers, stages,
 * statuses, departments, subheads, amounts, people and dates.
 *
 * Each fetcher calls the secure database function created by
 * database/v3_0_4_request_privacy.sql. If that SQL has not been run yet, it
 * falls back to the pre-v3.0.4 query so the app keeps working either way.
 */

export type RegisterRequest = {
  id: string;
  request_no: string | null;
  status: string | null;
  current_stage: string | null;
  current_owner: string | null;
  created_by: string | null;
  requester_name: string | null;
  dept_id: string | null;
  subhead_id: string | null;
  request_type: string | null;
  personal_category: string | null;
  amount: number | null;
  funds_state: string | null;
  funds_reserved_amount: number | null;
  assigned_account_officer_id: string | null;
  assigned_account_officer_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
};

export type RegisterMovement = {
  id: string;
  request_id: string;
  action_type: string | null;
  from_stage: string | null;
  to_stage: string | null;
  actor_name: string | null;
  actor_role_key: string | null;
  actor_role_name: string | null;
  action_by: string | null;
  created_at: string | null;
};

export type RegisterVoucher = {
  id: string;
  request_id: string | null;
  voucher_no: string | null;
  status: string | null;
  voucher_type: string | null;
  voucher_origin: string | null;
  signing_stage: string | null;
  total_amount: number | null;
  amount: number | null;
  dept_id: string | null;
  subhead_id: string | null;
  created_at: string | null;
};

const REQUEST_COLUMNS =
  "id,request_no,status,current_stage,current_owner,created_by,requester_name,dept_id,subhead_id,request_type,personal_category,amount,funds_state,funds_reserved_amount,assigned_account_officer_id,assigned_account_officer_name,created_at,updated_at,closed_at";
const MOVEMENT_COLUMNS = "id,request_id,action_type,from_stage,to_stage,actor_name,actor_role_key,actor_role_name,action_by,created_at";
const VOUCHER_COLUMNS = "id,request_id,voucher_no,status,voucher_type,voucher_origin,signing_stage,total_amount,amount,dept_id,subhead_id,created_at";

type Result<T> = { data: T[]; error: string | null; source: "register" | "fallback" };

/** True when PostgREST reports the function simply does not exist yet. */
function isMissingFunction(message: string | undefined) {
  return /could not find the function|does not exist|PGRST202/i.test(String(message || ""));
}

async function viaRpc<T>(fn: string, limit: number, fallback: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Result<T>> {
  const rpc = await supabase.rpc(fn, { p_limit: limit });
  if (!rpc.error) return { data: ((rpc.data || []) as T[]), error: null, source: "register" };
  if (!isMissingFunction(rpc.error.message)) return { data: [], error: rpc.error.message, source: "register" };
  const res = await fallback();
  return { data: ((res.data || []) as T[]), error: res.error?.message || null, source: "fallback" };
}

export function fetchRequestRegister(limit = 5000) {
  return viaRpc<RegisterRequest>("reqgen_request_register", limit, () =>
    supabase.from("requests").select(REQUEST_COLUMNS).order("created_at", { ascending: false }).limit(limit),
  );
}

export function fetchRequestMovements(limit = 10000) {
  return viaRpc<RegisterMovement>("reqgen_request_movements", limit, () =>
    supabase.from("request_history").select(MOVEMENT_COLUMNS).order("created_at", { ascending: false }).limit(limit),
  );
}

export function fetchVoucherRegister(limit = 5000) {
  return viaRpc<RegisterVoucher>("reqgen_voucher_register", limit, () =>
    supabase.from("payment_vouchers").select(VOUCHER_COLUMNS).order("created_at", { ascending: false }).limit(limit),
  );
}
