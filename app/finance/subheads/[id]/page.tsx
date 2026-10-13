"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { canSeeBudgetBalances } from "@/lib/v4/budgetVisibility";
import { ACCOUNT_COLUMNS, SUBHEAD_COLUMNS, accountUnallocated, fyOf, num, subheadLabel, subheadLeft, type Account, type Subhead } from "@/lib/v4/finance";
import { formatAmountInput, nairaExact, parseAmount } from "@/lib/v4/money";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Dept = { id: string; name: string };

/** Finance › Budget & Subheads › New / Edit subhead (mock-up 42). */
export default function SubheadFormPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "new";
  const isNew = id === "new";
  const router = useRouter();
  const me = useIdentity();
  const role = normalizeRole(me.role);
  const canManage = role === "admin" || role === "auditor";
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<Subhead | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [linked, setLinked] = useState<number | null>(null);
  const [fyStatus, setFyStatus] = useState("Open");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [account, setAccount] = useState("");
  const [active, setActive] = useState("active");
  const [alloc, setAlloc] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "red" | "green"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, d, y] = await Promise.all([
      supabase.from("iet_accounts").select(ACCOUNT_COLUMNS).order("name"),
      supabase.from("departments").select("id,name").order("name"),
      supabase.from("reqgen_financial_years").select("status").eq("fy_start", fyOf()).maybeSingle(),
    ]);
    setAccounts((a.data || []) as Account[]);
    setDepts((d.data || []) as Dept[]);
    setFyStatus(String((y.data as { status?: string } | null)?.status || "Open"));
    if (!isNew) {
      const s = await supabase.from("subheads").select(SUBHEAD_COLUMNS).eq("id", id).maybeSingle();
      const row = (s.data || null) as Subhead | null;
      setSub(row);
      if (row) {
        setCode(row.code || ""); setName(row.name); setDept(row.dept_id || ""); setAccount(row.bank_account_id || "");
        setActive(row.is_active === false ? "inactive" : "active"); setAlloc(formatAmountInput(String(num(row.approved_allocation))));
        const c = await supabase.from("requests").select("id", { count: "exact", head: true }).eq("subhead_id", row.id);
        setLinked(c.count ?? null);
      }
    }
    setLoading(false);
  }, [id, isNew]);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const acc = accounts.find((a) => a.id === account) || null;
  const newAlloc = parseAmount(alloc || "0");
  const oldAlloc = sub && sub.bank_account_id === account ? num(sub.approved_allocation) : 0;
  const increase = Number.isFinite(newAlloc) ? newAlloc - oldAlloc : 0;
  const unallocatedNow = acc ? accountUnallocated(acc) : 0;
  const leftAfter = unallocatedNow - increase;
  const allocChanged = !sub ? newAlloc > 0 : newAlloc !== num(sub.approved_allocation) || account !== (sub.bank_account_id || "");
  const locked = fyStatus === "Locked" || fyStatus === "Closed";
  const floor = sub ? num(sub.expenditure) + num(sub.reserved_amount) : 0;

  const problem = useMemo(() => {
    if (name.trim().length < 2) return "Type the subhead name.";
    if (!account) return "Choose the funding account.";
    if (!Number.isFinite(newAlloc) || newAlloc < 0) return "Type the approved allocation (numbers only).";
    if (allocChanged && locked) return "The budget is locked; change allocations with a transfer.";
    if (allocChanged && leftAfter < 0) return `The account has only ${nairaExact(unallocatedNow)} not yet given to subheads.`;
    if (sub && newAlloc < floor) return `The allocation cannot be below what is spent and reserved (${nairaExact(floor)}).`;
    if (allocChanged && note.trim().length < 3) return "Write an allocation note for the ledger.";
    return "";
  }, [name, account, newAlloc, allocChanged, locked, leftAfter, unallocatedNow, sub, floor, note]);

  async function save() {
    if (problem) { setMsg({ tone: "red", text: problem }); return; }
    setBusy(true); setMsg(null);
    try {
      const payload = { code: code.trim() || null, name: name.trim(), dept_id: dept || null, is_active: active === "active" };
      let sid = sub?.id || "";
      if (sub) {
        const { error } = await supabase.from("subheads").update(payload).eq("id", sub.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from("subheads").insert({ ...payload, approved_allocation: 0, reserved_amount: 0, expenditure: 0, balance: 0 }).select("id").single();
        if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "A subhead with this code or name already exists." : error.message);
        sid = (data as { id: string }).id;
      }
      if (allocChanged || !sub) {
        const { error } = await supabase.rpc("reqgen_assign_subhead_bank_allocation", {
          p_subhead_id: sid, p_bank_account_id: account, p_new_allocation: newAlloc, p_actor_id: me.userId, p_note: note.trim() || "Subhead created.",
        });
        if (error) {
          if (!sub) await supabase.from("subheads").delete().eq("id", sid);
          throw new Error(error.message);
        }
      }
      router.push("/finance/subheads");
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof Error ? e.message : "The subhead could not be saved." });
    } finally { setBusy(false); }
  }

  if (me.ready && !canSeeBudgetBalances(me.role)) return <V4Page><Notice tone="amber">Subhead figures are private for the position you are acting as.</Notice></V4Page>;
  if (loading) return <V4Page><PageHead title={isNew ? "New subhead" : "Subhead"} /><div className="v4-card"><Skeleton lines={6} /></div></V4Page>;
  if (!isNew && !sub) return <V4Page><Notice tone="red">This subhead was not found.</Notice></V4Page>;

  const ro = !canManage;
  return (
    <V4Page>
      <PageHead title={isNew ? "New subhead" : `${ro ? "" : "Edit "}${subheadLabel(sub)}`} sub={ro ? `View only. Only the Super Admin and the Auditor change subheads (you are acting as ${me.roleName}).` : "Only the Super Admin and the Auditor can change allocations."} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {locked ? <Notice tone="amber">The FY budget is {fyStatus.toLowerCase()}. Names and status can change; allocations move only through Finance › Transfers.</Notice> : null}
      <div className="v4-split">
        <form className="v4-card v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 20 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div className="v4-form-grid">
            <label className="v4-field"><span className="v4-flabel">Code</span><input className="v4-input" value={code} onChange={(e) => setCode(e.target.value)} disabled={ro} placeholder="e.g. GA05" /><span className="v4-help">Leave empty if the subhead has no code.</span></label>
            <label className="v4-field"><span className="v4-flabel">Name <span className="v4-req">*</span></span><input className="v4-input" value={name} onChange={(e) => setName(e.target.value)} disabled={ro} /></label>
            <div className="v4-field"><label className="v4-flabel" htmlFor="sh-dept" style={{ fontSize: 13, fontWeight: 700 }}>Department</label>
              <Select id="sh-dept" value={dept} onChange={setDept} disabled={ro} placeholder="Institution-wide" options={[{ value: "", label: "Institution-wide" }, ...depts.map((d) => ({ value: d.id, label: d.name }))]} /></div>
            <div className="v4-field"><label className="v4-flabel" htmlFor="sh-acc" style={{ fontSize: 13, fontWeight: 700 }}>Funding account <span className="v4-req">*</span></label>
              <Select id="sh-acc" value={account} onChange={setAccount} disabled={ro || locked} placeholder="Choose the account"
                options={accounts.filter((a) => a.is_active !== false || a.id === account).map((a) => ({ value: a.id, label: a.name, hint: `${a.bank_name || ""} · not yet allocated ${nairaExact(accountUnallocated(a))}` }))} /></div>
            <div className="v4-field"><label className="v4-flabel" htmlFor="sh-status" style={{ fontSize: 13, fontWeight: 700 }}>Status</label>
              <Select id="sh-status" value={active} onChange={setActive} disabled={ro} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></div>
            <label className="v4-field"><span className="v4-flabel">Approved allocation (₦) <span className="v4-req">*</span></span>
              <input className="v4-input v4-num" inputMode="decimal" value={alloc} onChange={(e) => setAlloc(formatAmountInput(e.target.value))} disabled={ro || locked} />
              <span className="v4-help">{sub ? `Was ${nairaExact(sub.approved_allocation)}` : "Given from the funding account."}</span></label>
            <label className="v4-field v4-span-2"><span className="v4-flabel">Allocation note {allocChanged ? <span className="v4-req">*</span> : null}</span><input className="v4-input" value={note} onChange={(e) => setNote(e.target.value)} disabled={ro || locked} placeholder="e.g. Extra diesel for the dry season" /></label>
          </div>
          <div className="v4-form-actions">
            <Link className="v4-btn v4-btn-ghost" href="/finance/subheads">{ro ? "Back" : "Cancel"}</Link>
            {ro ? null : <button className="v4-btn v4-btn-primary" type="submit" disabled={busy || !!problem}><Icon name="check" />{busy ? "Saving…" : "Save subhead"}</button>}
          </div>
          {!ro && problem ? <p className="v4-help" style={{ textAlign: "right", margin: "-10px 0 0" }}>{problem}</p> : null}
        </form>
        <aside className="v4-side-stack">
          <section className="v4-card v4-card-pad"><h2 className="v4-h3" style={{ marginBottom: 12 }}>Live check</h2>
            <dl className="v4-kv"><dt>Account not yet allocated</dt><dd>{acc ? nairaExact(unallocatedNow) : "—"}</dd><dt>{increase >= 0 ? "Increase" : "Decrease"}</dt><dd>{increase >= 0 ? "+" : "−"} {nairaExact(Math.abs(increase))}</dd><dt>Left after save</dt><dd style={{ color: leftAfter >= 0 ? "var(--v4-green)" : "var(--v4-red)" }}>{acc ? nairaExact(leftAfter) : "—"}</dd></dl>
            {acc ? <div className={`v4-notice v4-notice-${leftAfter >= 0 ? "green" : "red"}`} style={{ marginTop: 12 }}><Icon name={leftAfter >= 0 ? "check" : "alert"} /><span>{leftAfter >= 0 ? "The account can cover this allocation." : "The account cannot cover this allocation. Add fund in Bank Accounts or lower it."}</span></div> : null}
          </section>
          {sub ? (
            <section className="v4-card v4-card-pad"><h2 className="v4-h3" style={{ marginBottom: 12 }}>This subhead now</h2>
              <dl className="v4-kv"><dt>Spent</dt><dd>{nairaExact(sub.expenditure)}</dd><dt>Reserved</dt><dd>{nairaExact(sub.reserved_amount)}</dd><dt>Available</dt><dd>{nairaExact(subheadLeft(sub))}</dd><dt>Requests linked</dt><dd>{linked ?? "—"}</dd></dl></section>
          ) : null}
        </aside>
      </div>
    </V4Page>
  );
}
