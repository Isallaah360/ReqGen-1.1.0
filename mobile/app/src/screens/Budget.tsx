import { useEffect, useState } from "react";
import { CircleCheck, CircleAlert, Loader2 } from "lucide-react";
import { db } from "../lib/core";

/**
 * App 4.1.0: the sender chooses the budget subhead. Staff see subhead NAMES only, never a balance.
 * When the amount is typed, the database answers one word: available (blue tick, the IET logo has
 * no green) or not enough (red), with the name of the Auditor to contact.
 */
export type Live = "" | "checking" | "available" | "not_enough";
type Sub = { id: string; code: string | null; name: string };

export function useSubheads(deptId: string, on: boolean) {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  useEffect(() => {
    if (!on || !deptId) { setSubs(null); return; }
    let alive = true;
    setSubs(null);
    void db().then((s) => s.rpc("reqgen_department_subhead_names", { p_dept_id: deptId })).then(({ data }) => { if (alive) setSubs((data || []) as Sub[]); });
    return () => { alive = false; };
  }, [deptId, on]);
  return subs;
}

/** `extra` is how much more money this choice needs (a correction checks only the difference); NaN when no amount is typed. */
export function useLive(subId: string, extra: number, on: boolean) {
  const [live, setLive] = useState<Live>("");
  useEffect(() => {
    if (!on || !subId || !Number.isFinite(extra)) { setLive(""); return; }
    if (extra <= 0) { setLive("available"); return; }
    setLive("checking");
    const t = window.setTimeout(() => {
      void db().then((s) => s.rpc("reqgen_subhead_live_check", { p_subhead_id: subId, p_amount: extra })).then(({ data, error }) => {
        const v = String(Array.isArray(data) ? data[0] : data || "");
        setLive(error ? "" : v === "available" ? "available" : v === "not_enough" ? "not_enough" : "");
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [subId, extra, on]);
  return live;
}

let helpCache: { name: string; position: string } | null = null;
export function useHelpContact(on: boolean) {
  const [who, setWho] = useState(helpCache);
  useEffect(() => {
    if (!on || helpCache) return;
    void db().then((s) => s.rpc("reqgen_help_contact")).then(({ data }) => {
      const r = (Array.isArray(data) ? data[0] : data) as { full_name?: string; position_name?: string } | null;
      if (r?.full_name) { helpCache = { name: r.full_name, position: r.position_name || "Auditor" }; setWho(helpCache); }
    });
  }, [on]);
  return who;
}

export function SubheadField({ subs, value, onChange, live, deptName }: { subs: Sub[] | null; value: string; onChange: (v: string) => void; live: Live; deptName?: string }) {
  const help = useHelpContact(live === "not_enough");
  if (subs && !subs.length) return <p className="foot" style={{ textAlign: "left" }}>{deptName || "This department"} has no budget subheads yet. The officer who sees the budget chooses it.</p>;
  return (
    <label style={{ display: "block" }}>
      <span className="lbl">Budget subhead</span>
      <select className="inp" value={value} onChange={(e) => onChange(e.target.value)} disabled={!subs}>
        <option value="">{subs ? "Choose the subhead" : "Loading subheads…"}</option>
        {(subs || []).map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code}: ` : ""}{s.name}</option>)}
      </select>
      <BudgetLine live={live} help={help} />
    </label>
  );
}

export function BudgetLine({ live, help }: { live: Live; help: { name: string; position: string } | null }) {
  if (live === "checking") return <span className="budget b-chk" role="status"><Loader2 size={16} className="spin" />Checking the budget…</span>;
  if (live === "available") return <span className="budget b-ok" role="status"><CircleCheck size={18} />Available. This subhead can finance the amount.</span>;
  if (live === "not_enough") return (
    <span className="budget b-er" role="alert">
      <CircleAlert size={18} />
      <span>Not enough. This subhead cannot finance the amount. Choose another subhead or lower the amount, or contact {help ? <b>{help.name}</b> : "the Auditor"}{help ? `, ${help.position},` : ""} for help.</span>
    </span>
  );
  return <span className="foot" style={{ display: "block", textAlign: "left", marginTop: 6 }}>Type the amount to see if the subhead can finance it. Balances stay private.</span>;
}

