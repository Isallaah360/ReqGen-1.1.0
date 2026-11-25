import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { askCode, db, plainError } from "../lib/core";
import { buzz } from "../lib/native";
import { normalizeRole } from "../lib/rules/roles";
import type { Req } from "../lib/data";
import { naira } from "../lib/text";
import { Note, Sheet, toast } from "../ui";

/**
 * Who may see subhead figures: decided by the position the person is ACTING AS (the same rule as the
 * website's lib/v4/budgetVisibility.ts). Staff, Registry, PD, PA to the DG and Counter Signers never see them.
 */
const SEE = new Set(["dg", "generalsecretary", "dod", "director", "hod", "dinadmin", "registrar", "hrcoordinator", "hr", "hrofficer", "account", "accounts", "accountofficer", "auditor", "admin", "superadmin"]);
export function canSeeBudget(role: string | null | undefined) {
  const k = normalizeRole(role || "");
  if (k.startsWith("hr:")) return true;
  return SEE.has(k.replace(/\d+$/, ""));
}

type Sub = { id: string; code: string | null; name: string; approved_allocation: number | null; reserved_amount: number | null; expenditure: number | null };
const left = (s: Sub) => Number(s.approved_allocation || 0) - Number(s.reserved_amount || 0) - Number(s.expenditure || 0);

/** An older request that has no subhead: the officer who sees the budget chooses one (figures shown). */
export function AssignSubheadSheet({ open, onClose, r, onDone }: { open: boolean; onClose: () => void; r: Req; onDone: () => Promise<void> }) {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const amount = Number(r.amount || 0);
  useEffect(() => {
    if (!open || subs || !r.dept_id) return;
    void db().then((s) => s.from("subheads").select("id,code,name,approved_allocation,reserved_amount,expenditure").eq("dept_id", r.dept_id).eq("is_active", true).order("code"))
      .then(({ data, error }) => { if (error) setErr(plainError(error)); setSubs((data || []) as Sub[]); });
  }, [open, subs, r.dept_id]);
  return (
    <Sheet open={open} onClose={onClose} title="Choose the budget subhead">
      <p className="mu" style={{ fontSize: 14 }}>{naira(amount)} is reserved on the subhead you choose.</p>
      {!subs ? <p className="mu">Loading…</p> : !subs.length ? <Note tone="wa">This department has no subheads. The Super Admin adds them in Finance › Budget and Subheads.</Note> : (
        <div className="grp" role="radiogroup" aria-label="Subheads">
          {subs.map((s) => {
            const ok = left(s) >= amount;
            return (
              <button key={s.id} type="button" className="cell" role="radio" aria-checked={pick === s.id} onClick={() => { buzz.tap(); setPick(s.id); }}>
                <span className="t"><b>{s.code ? `${s.code}: ` : ""}{s.name}</b><small className={ok ? "" : "er"} style={ok ? undefined : { color: "var(--er)" }}>{naira(left(s))} left{ok ? "" : ", not enough"}</small></span>
                <span className={`box${pick === s.id ? " on" : ""}`} style={{ borderRadius: 13 }} aria-hidden="true">{pick === s.id ? <Check size={15} strokeWidth={3} /> : null}</span>
              </button>
            );
          })}
        </div>
      )}
      {err ? <Note tone="er">{err}</Note> : null}
      <button type="button" className="btn bp block" disabled={busy || !pick} onClick={async () => {
        const s0 = subs?.find((x) => x.id === pick);
        if (s0 && left(s0) < amount) { setErr("This subhead cannot finance the amount. Choose another one."); return; }
        if (!(await askCode("reserve the fund on this subhead"))) { setErr("Not done: it was not confirmed."); return; }
        setBusy(true); setErr(null);
        try {
          const c = await db();
          let { error } = await c.rpc("reqgen_officer_assign_subhead", { p_request_id: r.id, p_subhead_id: pick });
          if (error && /does not exist|schema cache/i.test(error.message)) ({ error } = await c.rpc("assign_request_subhead_and_reserve", { p_request_id: r.id, p_subhead_id: pick, p_actor_id: (await c.auth.getUser()).data.user?.id }));
          if (error) throw new Error(error.message);
          onClose(); toast("Subhead chosen and the fund reserved. You can approve it now."); await onDone();
        } catch (e) { buzz.bad(); setErr(plainError(e)); }
        finally { setBusy(false); }
      }}>{busy ? "Saving…" : "Reserve on this subhead"}</button>
    </Sheet>
  );
}
