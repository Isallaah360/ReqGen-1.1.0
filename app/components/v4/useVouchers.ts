"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Voucher } from "@/lib/v4/vouchers";
import { useIdentity } from "./useIdentity";

/** Every voucher the person may see (reqgen_pv_list, v4.3), with a fallback to the v3 list. */
export function useVouchers() {
  const me = useIdentity();
  const [rows, setRows] = useState<Voucher[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    let res = await supabase.rpc("reqgen_pv_list");
    if (res.error && /could not find the function|schema cache/i.test(res.error.message)) res = await supabase.rpc("get_payment_vouchers");
    setError(res.error ? res.error.message : null);
    setRows(res.error ? [] : ((res.data || []) as Voucher[]));
  }, []);

  useEffect(() => { if (me.ready) queueMicrotask(() => { void reload(); }); }, [me.ready, reload]);
  return { me, rows, error, reload };
}

/**
 * Reminder to whoever holds the voucher: in-app alert, SMS and email, with a
 * cooldown and a history line (app/api/pv/remind, v3.1.7). Falls back to the
 * in-app reminder (reqgen_pv_remind) when the API cannot be reached.
 * Returns { error } or { sentTo } (names, with how SMS / email went).
 */
export async function remindVoucher(id: string): Promise<{ error: string | null; sentTo?: string }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { error: "Your session has expired. Please sign in again." };
  try {
    const response = await fetch("/api/pv/remind", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ voucherId: id }),
    });
    const result = (await response.json()) as { ok: boolean; error?: string; recipients?: Array<{ name: string; sms: string; email: string }> };
    if (!response.ok || !result.ok) return { error: result.error || "The reminder could not be sent." };
    return { error: null, sentTo: (result.recipients || []).map((r) => `${r.name} (SMS ${r.sms}, email ${r.email})`).join("; ") };
  } catch {
    const { error } = await supabase.rpc("reqgen_pv_remind", { p_voucher_id: id });
    return error ? { error: error.message } : { error: null, sentTo: "in the app" };
  }
}
