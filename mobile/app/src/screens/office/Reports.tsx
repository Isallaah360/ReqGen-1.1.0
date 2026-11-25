import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, BarChart3, Download, FileText, Printer, ShieldCheck, Play } from "lucide-react";
import { db } from "../../lib/core";
import { naira, when, day } from "../../lib/text";
import { num, subheadLabel, utilisation, SUBHEAD_COLUMNS, type Subhead } from "../../lib/finance";
import { addMonths, fyLabel, fyMonths, fyOfMonth, fyRange, groupOf, last12, loadSpend, loadTier, loadTransactions, monthName, monthOf, monthRange, pct, scopeLabel, thisMonth, type TxRow } from "../../lib/reports";
import { pvAmount, pvStage, type Voucher } from "../../lib/vouchers";
import { downloadXlsx } from "../../lib/xlsx";
import { printRequest } from "../../lib/a4";
import { useApp } from "../../App";
import { Body, Chip, Chips, Empty, Head, Item, More, Note, Skeleton, toast, useMore, useNav } from "../../ui";
import Detail from "../Detail";
import { VoucherRecord } from "./Vouchers";
import { Bars, Err, Stats, call, rows, useAction, useLoad } from "./kit";

/**
 * App 4.1.0: Reports. Who sees what is decided by the database (reqgen_report_tier): the Super Admin and
 * the Auditor see every department; Account, the DG and the General Secretary see finance for all; everyone
 * else sees their own. Each report can be saved as an Excel file on the phone.
 */
function useTier() {
  const { me } = useApp();
  return useLoad(() => loadTier(me.role), [me.role]).data;
}
const xl = (f: () => Promise<void>) => () => void f().catch((e) => toast(e instanceof Error ? e.message : "The file could not be saved.", "er"));

export function TransactionsReport() {
  const { me } = useApp();
  const tier = useTier();
  const [month, setMonth] = useState(thisMonth());
  const [show, setShow] = useState<"all" | "out" | "in" | "transfer" | "pending">("all");
  const { data, error } = useLoad(async () => { const r = await loadTransactions(monthRange(addMonths(month, -11)).from, monthRange(month).to); if (r.error) throw new Error(r.error); return r.rows; }, [month]);
  const inMonth = (data || []).filter((r) => monthOf(r.at) === month);
  const list = inMonth.filter((r) => show === "all" || r.kind === show).slice().reverse();
  const { shown, more, left } = useMore(list);
  const sum = (k: TxRow["kind"]) => inMonth.filter((r) => r.kind === k).reduce((t, r) => t + r.amount, 0);
  const trend = last12(month).map((m) => ({ k: monthName(m, true), v: (data || []).filter((r) => r.kind === "out" && monthOf(r.at) === m).reduce((t, r) => t + r.amount, 0) }));
  return (
    <>
      <Head title="Transactions" />
      <Body>
        {tier ? <Note tone="mu">{scopeLabel(tier, me.roleName)}</Note> : null}
        <MonthStep month={month} onChange={setMonth} />
        <Err text={error} />
        <Stats items={[{ label: "Money out", value: naira(sum("out")), tone: "er" }, { label: "Money in", value: naira(sum("in")), tone: "ok" }, { label: "Transfers", value: naira(sum("transfer")) }, { label: "Waiting to pay", value: naira(sum("pending")), tone: "wa" }]} />
        <Bars label="Money out per month" data={trend} />
        <Chips label="Show" value={show} onChange={setShow} items={[{ k: "all", label: "All" }, { k: "out", label: "Out" }, { k: "in", label: "In" }, { k: "transfer", label: "Transfers" }, { k: "pending", label: "Waiting" }]} />
        <button type="button" className="btn bs block" disabled={!list.length} onClick={xl(() => downloadXlsx(`Transactions_${month}`, [{ name: "Transactions", title: `Transactions: ${monthName(month)}`, rows: list.map((r) => ({ Date: day(r.at), Kind: r.kind, Reference: r.ref, Title: r.title, Department: r.dept_name, Subhead: r.subhead_code, Mode: r.mode, Status: r.status, Amount: r.amount })) }]))}><Download size={18} />Save as Excel</button>
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={<BarChart3 size={28} />} title="Nothing this month" text="Choose another month." /> : shown.map((r, i) => (
          <Item key={`${r.ref}-${i}`} title={`${r.ref} · ${naira(r.amount)}`} sub={`${r.title}${r.dept_name ? `, ${r.dept_name}` : ""}`} chip={<Chip tone={r.kind === "out" ? "er" : r.kind === "in" ? "ok" : r.kind === "pending" ? "wa" : "in"}>{r.kind === "out" ? "Out" : r.kind === "in" ? "In" : r.kind === "pending" ? "Waiting" : "Transfer"}</Chip>}
            facts={[["Date", day(r.at)], r.subhead_code ? ["Subhead", `${r.subhead_code} ${r.subhead_name}`] : null, r.mode ? ["Mode", r.mode] : null, r.days_to_pay !== null ? ["Days to pay", String(r.days_to_pay)] : null]} />
        ))}
        <More more={more} left={left} />
      </Body>
    </>
  );
}

function MonthStep({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button type="button" className="btn bs sm" aria-label="Month before" onClick={() => onChange(addMonths(month, -1))}><ChevronLeft size={20} /></button>
      <b style={{ flex: 1, textAlign: "center" }}>{monthName(month)}</b>
      <button type="button" className="btn bs sm" aria-label="Next month" disabled={month >= thisMonth()} onClick={() => onChange(addMonths(month, 1))}><ChevronRight size={20} /></button>
    </div>
  );
}
function FyStep({ fy, onChange }: { fy: number; onChange: (y: number) => void }) {
  const now = fyOfMonth(thisMonth());
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button type="button" className="btn bs sm" aria-label="Year before" onClick={() => onChange(fy - 1)}><ChevronLeft size={20} /></button>
      <b style={{ flex: 1, textAlign: "center" }}>FY {fyLabel(fy)}</b>
      <button type="button" className="btn bs sm" aria-label="Next year" disabled={fy >= now} onClick={() => onChange(fy + 1)}><ChevronRight size={20} /></button>
    </div>
  );
}

type RRow = { id: string; request_no: string | null; title: string | null; dept_name: string; request_type: string; status: string; bucket: "approved" | "rejected" | "withdrawn" | "returned" | "pending"; amount: number; created_at: string; decided_at: string | null; returned_count: number; is_mine: boolean };
const BUCKET: Record<RRow["bucket"], [string, string]> = { approved: ["Approved", "ok"], rejected: ["Rejected", "er"], withdrawn: ["Withdrawn", "mu"], returned: ["Sent back", "wa"], pending: ["Pending", "in"] };
export function RequestReport() {
  const { me } = useApp();
  const { push } = useNav();
  const tier = useTier();
  const [fy, setFy] = useState(fyOfMonth(thisMonth()));
  const [tab, setTab] = useState<"dept" | "list">("dept");
  const { data, error } = useLoad(async () => { const p = fyRange(fy); return (await rows<RRow>("reqgen_report_requests", { p_from: p.from, p_to: p.to })).map((r) => ({ ...r, amount: num(r.amount) })); }, [fy]);
  const list = data || [];
  const count = (b: RRow["bucket"]) => list.filter((r) => r.bucket === b).length;
  const depts = useMemo(() => { const m = new Map<string, { n: number; a: number; amount: number }>(); list.forEach((r) => { const x = m.get(r.dept_name) || { n: 0, a: 0, amount: 0 }; x.n += 1; if (r.bucket === "approved") { x.a += 1; x.amount += r.amount; } m.set(r.dept_name, x); }); return [...m.entries()].sort((a, b) => b[1].n - a[1].n); }, [list]);
  const { shown, more, left } = useMore(list.slice().reverse());
  return (
    <>
      <Head title="Request Reports" />
      <Body>
        {tier ? <Note tone="mu">{scopeLabel(tier, me.roleName, "requests")}</Note> : null}
        <FyStep fy={fy} onChange={setFy} />
        <Err text={error} />
        <Stats items={[{ label: "Submitted", value: list.length }, { label: "Approved", value: count("approved"), tone: "ok" }, { label: "Sent back", value: count("returned"), tone: "wa" }, { label: "Rejected", value: count("rejected"), tone: "er" }]} />
        <Bars label="Requests per month" money={false} data={fyMonths(fy).map((m) => ({ k: monthName(m, true), v: list.filter((r) => monthOf(r.created_at) === m).length }))} />
        <Chips label="Show" value={tab} onChange={setTab} items={[{ k: "dept", label: "By department" }, { k: "list", label: "Every request" }]} />
        <button type="button" className="btn bs block" disabled={!list.length} onClick={xl(() => downloadXlsx(`Request_Reports_FY${fy}`, [{ name: "Requests", title: `Requests: FY ${fyLabel(fy)}`, rows: list.map((r) => ({ Number: r.request_no, Title: r.title, Department: r.dept_name, Type: r.request_type, Status: BUCKET[r.bucket][0], Amount: r.amount, Sent: day(r.created_at), "Sent back": r.returned_count })) }]))}><Download size={18} />Save as Excel</button>
        {!data ? <Skeleton rows={4} /> : tab === "dept" ? depts.map(([name, x]) => <Item key={name} title={name || "No department"} facts={[["Requests", String(x.n)], ["Approved", String(x.a)], ["Approved amount", naira(x.amount)]]} />) : (<>
          {shown.map((r) => <Item key={r.id} title={`${r.request_no} · ${naira(r.amount)}`} sub={`${r.title || ""}, ${r.dept_name}`} chip={<Chip tone={BUCKET[r.bucket][1]}>{BUCKET[r.bucket][0]}</Chip>} facts={[["Sent", day(r.created_at)], r.decided_at ? ["Decided", day(r.decided_at)] : null]} onClick={() => push(<Detail id={r.id} meId={me.id} />)} />)}
          <More more={more} left={left} />
        </>)}
      </Body>
    </>
  );
}

export function FinanceStatements() {
  const { me } = useApp();
  const tier = useTier();
  const [fy, setFy] = useState(fyOfMonth(thisMonth()));
  const [tab, setTab] = useState<"monthly" | "subhead">("monthly");
  const { data, error } = useLoad(async () => {
    const r = fyRange(fy);
    const c = await db();
    const [s, sp, tx] = await Promise.all([c.from("subheads").select(SUBHEAD_COLUMNS).order("code"), loadSpend(r.from, r.to), loadTransactions(r.from, r.to)]);
    return { subs: (s.data || []) as Subhead[], spend: sp.rows, tx: tx.rows };
  }, [fy]);
  const months = fyMonths(fy);
  const out = (m: string) => (data?.tx || []).filter((r) => r.kind === "out" && monthOf(r.at) === m).reduce((t, r) => t + r.amount, 0);
  const inn = (m: string) => (data?.tx || []).filter((r) => r.kind === "in" && monthOf(r.at) === m).reduce((t, r) => t + r.amount, 0);
  const groups = useMemo(() => { const m = new Map<string, number>(); (data?.spend || []).forEach((r) => m.set(groupOf(r.subhead_code), (m.get(groupOf(r.subhead_code)) || 0) + r.amount)); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [data]);
  const alloc = (data?.subs || []).reduce((t, s) => t + num(s.approved_allocation), 0);
  const spent = (data?.subs || []).reduce((t, s) => t + num(s.expenditure), 0);
  return (
    <>
      <Head title="Finance Statements" />
      <Body>
        {tier ? <Note tone="mu">{scopeLabel(tier, me.roleName)}</Note> : null}
        <FyStep fy={fy} onChange={setFy} />
        <Err text={error} />
        <Stats items={[{ label: "Allocation", value: naira(alloc) }, { label: "Spent", value: naira(spent), tone: "er" }, { label: "Used", value: `${pct(spent, alloc)}%` }, { label: "Left", value: naira(alloc - spent), tone: "ok" }]} />
        <Chips label="Statement" value={tab} onChange={setTab} items={[{ k: "monthly", label: "Monthly" }, { k: "subhead", label: "By subhead" }]} />
        <button type="button" className="btn bs block" disabled={!data} onClick={xl(() => downloadXlsx(`Finance_Statement_FY${fy}`, [
          { name: "Monthly", title: `Monthly statement: FY ${fyLabel(fy)}`, rows: months.map((m) => ({ Month: monthName(m), "Money in": inn(m), "Money out": out(m), Net: inn(m) - out(m) })) },
          { name: "Subheads", title: `Subheads: FY ${fyLabel(fy)}`, rows: (data?.subs || []).map((s) => ({ Subhead: subheadLabel(s), Allocation: num(s.approved_allocation), Reserved: num(s.reserved_amount), Spent: num(s.expenditure), Left: num(s.approved_allocation) - num(s.expenditure) - num(s.reserved_amount) })) },
          { name: "Expense groups", title: "Spending by expense group", rows: groups.map(([g, v]) => ({ Group: g, Spent: v })) },
        ]))}><Download size={18} />Save as Excel</button>
        {!data ? <Skeleton rows={4} /> : tab === "monthly" ? (<>
          <Bars label="Money out and in per month" data={months.map((m) => ({ k: monthName(m, true), v: out(m), v2: inn(m) }))} />
          <p className="foot" style={{ textAlign: "left" }}>Blue: money out. Gold: money in.</p>
          {months.map((m) => <Item key={m} title={monthName(m)} facts={[["Money in", naira(inn(m))], ["Money out", naira(out(m))], ["Net", naira(inn(m) - out(m))]]} />)}
        </>) : (<>
          <Bars label="Spending by expense group" data={groups.map(([g, v]) => ({ k: g, v }))} />
          {(data.subs).filter((s) => num(s.approved_allocation) > 0).map((s) => <Item key={s.id} title={subheadLabel(s)} chip={<Chip tone={utilisation(s) >= 90 ? "er" : utilisation(s) >= 70 ? "wa" : "ok"}>{utilisation(s)}%</Chip>} facts={[["Allocation", naira(s.approved_allocation)], ["Spent", naira(s.expenditure)], ["Reserved", naira(s.reserved_amount)]]} />)}
        </>)}
      </Body>
    </>
  );
}

type Step = { step: string; avg_hours: number; vouchers: number };
export function VoucherReport() {
  const { push } = useNav();
  const [fy, setFy] = useState(fyOfMonth(thisMonth()));
  const { data, error } = useLoad(async () => {
    const r = fyRange(fy);
    const [v, s] = await Promise.all([rows<Voucher>("reqgen_pv_list"), rows<Step>("reqgen_report_voucher_steps", { p_from: r.from, p_to: r.to })]);
    return { v: v.filter((x) => String(x.created_at || "") >= r.from && String(x.created_at || "") <= `${r.to}T23:59:59`), s };
  }, [fy]);
  const v = data?.v || [];
  const by = (k: string) => v.filter((x) => (x.disbursement_mode || "Transfer") === k);
  const payees = useMemo(() => { const m = new Map<string, number>(); v.filter((x) => pvStage(x.status) === "paid").forEach((x) => m.set(String(x.payee_name || "").toUpperCase(), (m.get(String(x.payee_name || "").toUpperCase()) || 0) + pvAmount(x))); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8); }, [v]);
  return (
    <>
      <Head title="Voucher Reports" />
      <Body>
        <FyStep fy={fy} onChange={setFy} />
        <Err text={error} />
        <Stats items={[{ label: "Vouchers", value: v.length }, { label: "Paid", value: naira(v.filter((x) => pvStage(x.status) === "paid").reduce((t, x) => t + pvAmount(x), 0)), tone: "ok" }, { label: "In signing", value: v.filter((x) => ["check", "counter", "dg"].includes(pvStage(x.status))).length, tone: "wa" }, { label: "Cancelled", value: v.filter((x) => pvStage(x.status) === "cancelled").length }]} />
        <Bars label="By mode" data={["Transfer", "Cheque", "Cash"].map((k) => ({ k, v: by(k).reduce((t, x) => t + pvAmount(x), 0) }))} />
        {data?.s.length ? (<><div className="sect"><b>Average time at each signing step</b></div><Bars label="Hours per step" money={false} data={data.s.map((x) => ({ k: x.step, v: Math.round(num(x.avg_hours)) }))} /><p className="foot" style={{ textAlign: "left" }}>Hours, on average.</p></>) : null}
        {payees.length ? (<><div className="sect"><b>Top payees</b></div><Bars label="Top payees" data={payees.map(([k, x]) => ({ k: k.split(" ")[0] || k, v: x }))} /></>) : null}
        <button type="button" className="btn bs block" disabled={!v.length} onClick={xl(() => downloadXlsx(`Voucher_Reports_FY${fy}`, [{ name: "Vouchers", title: `Vouchers: FY ${fyLabel(fy)}`, rows: v.map((x) => ({ Number: x.voucher_no, Payee: x.payee_name, Mode: x.disbursement_mode, Status: x.status, Amount: pvAmount(x), Date: day(x.created_at) })) }]))}><Download size={18} />Save as Excel</button>
        {!data ? <Skeleton rows={3} /> : v.slice(0, 20).map((x) => <Item key={x.id} title={`${x.voucher_no} · ${naira(pvAmount(x))}`} sub={String(x.payee_name || "").toUpperCase()} onClick={() => push(<VoucherRecord id={x.id} />)} />)}
      </Body>
    </>
  );
}

type RegRow = { month: string; office: string; direction: string; state: "open" | "dispatched" | "archived"; received_at: string; days_to_dispatch: number | null };
export function RegistryReport() {
  const [month] = useState(thisMonth());
  const { data, error } = useLoad(() => rows<RegRow>("reqgen_report_registry", { p_from: `${last12(month)[0]}-01`, p_to: fyRange(fyOfMonth(month)).to }), [month]);
  const list = data || [];
  return (
    <>
      <Head title="Registry Reports" />
      <Body>
        <Note tone="mu">Counts only. Registry reports never show what a letter or request says.</Note>
        <Err text={error} />
        <Stats items={[{ label: "Incoming", value: list.filter((r) => r.direction === "incoming").length }, { label: "Outgoing", value: list.filter((r) => r.direction === "outgoing").length }, { label: "Dispatched", value: list.filter((r) => r.state === "dispatched").length, tone: "ok" }, { label: "Archived", value: list.filter((r) => r.state === "archived").length }]} />
        <Bars label="Items per month" money={false} data={last12(month).map((m) => ({ k: monthName(m, true), v: list.filter((r) => r.month === m || monthOf(r.received_at) === m).length }))} />
        {!data ? <Skeleton rows={3} /> : [...new Set(list.map((r) => r.office))].map((o) => { const x = list.filter((r) => r.office === o); const d = x.filter((r) => r.days_to_dispatch !== null); return <Item key={o} title={o || "No office"} facts={[["Items", String(x.length)], ["Open", String(x.filter((r) => r.state === "open").length)], ["Average days to dispatch", d.length ? (d.reduce((t, r) => t + num(r.days_to_dispatch), 0) / d.length).toFixed(1) : "-"]]} />; })}
      </Body>
    </>
  );
}

type Ex = { tone: "red" | "amber"; title: string; detail: string; link: string; at: string };
export function Executive() {
  const { me } = useApp();
  const tier = useTier();
  const month = thisMonth();
  const { data, error } = useLoad(async () => {
    const c = await db();
    const [s, t, e] = await Promise.all([c.from("subheads").select(SUBHEAD_COLUMNS).eq("is_active", true), loadTransactions(monthRange(addMonths(month, -11)).from, monthRange(month).to), c.rpc("reqgen_report_exceptions")]);
    return { subs: (s.data || []) as Subhead[], tx: t.rows, ex: ((e.data || []) as Ex[]).sort((a, b) => (a.tone === b.tone ? String(b.at).localeCompare(String(a.at)) : a.tone === "red" ? -1 : 1)) };
  }, []);
  const alloc = (data?.subs || []).reduce((t, s) => t + num(s.approved_allocation), 0);
  const spent = (data?.subs || []).reduce((t, s) => t + num(s.expenditure), 0);
  const used = pct(spent, alloc);
  const expected = Math.round(((((Number(month.slice(5, 7)) - 9 + 12) % 12) + 1) / 12) * 100);
  const risk = (data?.subs || []).filter((s) => num(s.approved_allocation) > 0 && utilisation(s) >= 80).sort((a, b) => utilisation(b) - utilisation(a)).slice(0, 6);
  return (
    <>
      <Head title="Executive Analytics" />
      <Body>
        {tier ? <Note tone="mu">{scopeLabel(tier, me.roleName)}</Note> : null}
        <Err text={error} />
        <Stats items={[{ label: "Budget used", value: `${used}%`, tone: used > expected + 5 ? "er" : "ok" }, { label: "Expected by now", value: `${expected}%` }, { label: "Allocation", value: naira(alloc) }, { label: "Spent", value: naira(spent) }]} />
        <Note tone={used > expected + 5 ? "wa" : "ok"}>{used > expected + 5 ? "Spending is ahead of the year's pace." : "Spending is within the year's pace."}</Note>
        <div className="sect"><b>Money out, last 12 months</b></div>
        <Bars label="Money out per month" data={last12(month).map((m) => ({ k: monthName(m, true), v: (data?.tx || []).filter((r) => r.kind === "out" && monthOf(r.at) === m).reduce((t, r) => t + r.amount, 0) }))} />
        <div className="sect"><b>Subheads at 80% or more</b></div>
        {!data ? <Skeleton rows={2} /> : !risk.length ? <p className="mu">None.</p> : risk.map((s) => <Item key={s.id} title={subheadLabel(s)} chip={<Chip tone="er">{utilisation(s)}%</Chip>} facts={[["Allocation", naira(s.approved_allocation)], ["Spent", naira(s.expenditure)]]} />)}
        <div className="sect"><b>Exceptions</b></div>
        {(data?.ex || []).length ? data!.ex.slice(0, 15).map((e, i) => <Item key={i} title={e.title} sub={e.detail} chip={<Chip tone={e.tone === "red" ? "er" : "wa"}>{e.tone === "red" ? "Act now" : "Check"}</Chip>} facts={[["When", when(e.at)]]} />) : <p className="mu">Nothing outside the normal path.</p>}
      </Body>
    </>
  );
}

type PR = { tab: "mine" | "treated_by_me" | "all_treated"; doc_kind: "request" | "voucher" | "report"; doc_id: string | null; doc_no: string; label: string; for_name: string; times_printed: number; last_printed: string | null; last_by: string | null; link: string };
export function PrintRegister() {
  const { me } = useApp();
  const { push } = useNav();
  const [tab, setTab] = useState<PR["tab"]>("mine");
  const { data, error } = useLoad(() => rows<PR>("reqgen_print_register_v4"), []);
  const list = (data || []).filter((r) => r.tab === tab);
  const { shown, more, left } = useMore(list);
  const [busy, setBusy] = useState("");
  return (
    <>
      <Head title="Print Register" />
      <Body>
        <Chips label="Show" value={tab} onChange={setTab} items={[{ k: "mine", label: "Mine" }, { k: "treated_by_me", label: "Treated by me" }, { k: "all_treated", label: "All" }]} />
        <Err text={error} />
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={<Printer size={28} />} title="Nothing here" text="Completed requests and vouchers you can print appear here." /> : shown.map((r, i) => (
          <Item key={`${r.doc_no}-${i}`} title={r.doc_no} sub={`${r.label}${r.for_name ? `, ${r.for_name}` : ""}`} chip={<Chip tone={r.times_printed ? "in" : "mu"}>{r.times_printed ? `Printed ${r.times_printed}×` : "Not printed"}</Chip>}
            facts={[r.last_printed ? ["Last printed", `${when(r.last_printed)}${r.last_by ? `, ${r.last_by}` : ""}`] : null]}
            onClick={r.doc_id ? () => push(r.doc_kind === "voucher" ? <VoucherRecord id={r.doc_id!} /> : <Detail id={r.doc_id!} meId={me.id} />) : undefined}>
            {r.doc_id && r.doc_kind === "request" ? <button type="button" className="btn bs sm" disabled={!!busy} onClick={async () => { setBusy(r.doc_no); try { await printRequest(r.doc_id!); } catch (e) { toast(e instanceof Error ? e.message : "Not printed.", "er"); } finally { setBusy(""); } }}><FileText size={16} />{busy === r.doc_no ? "Making…" : "A4 PDF"}</button> : null}
          </Item>
        ))}
        <More more={more} left={left} />
      </Body>
    </>
  );
}

type Check = { key: string; title: string; about: string; status: "pass" | "warn" | "fail"; note: string; link: string };
type Run = { run_at: string; passed: number; warnings: number; failed: number; results: Check[]; run_by_label?: string | null };
export function Compliance() {
  const { data, error, reload, setData } = useLoad(async () => { const { data: d } = await (await db()).from("reqgen_compliance_runs").select("run_at,passed,warnings,failed,results,run_by_label").order("run_at", { ascending: false }).limit(1).maybeSingle(); return (d as Run | null) || null; }, []);
  const { busy, err, run } = useAction();
  return (
    <>
      <Head title="Compliance" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Automatic checks on vouchers, signatures and security.</p>
        <button type="button" className="btn bp block" disabled={busy} onClick={() => void run(null, async () => { const r = await call<unknown>("reqgen_compliance_run", { p_save: true }); setData((typeof r === "string" ? JSON.parse(r) : r) as Run); }, "Checks done.")}><Play size={18} />{busy ? "Checking…" : "Run the checks now"}</button>
        <Err text={error || err} />
        {data ? (<>
          <Stats items={[{ label: "Passed", value: data.passed, tone: "ok" }, { label: "Warnings", value: data.warnings, tone: "wa" }, { label: "Failed", value: data.failed, tone: "er" }]} />
          <p className="foot" style={{ textAlign: "left" }}>Last run {when(data.run_at)}{data.run_by_label ? ` by ${data.run_by_label}` : ""}.</p>
          {(data.results || []).map((c) => <Item key={c.key} title={c.title} sub={c.note || c.about} chip={<Chip tone={c.status === "pass" ? "ok" : c.status === "warn" ? "wa" : "er"}>{c.status === "pass" ? "Pass" : c.status === "warn" ? "Check" : "Fail"}</Chip>} />)}
        </>) : <Empty icon={<ShieldCheck size={28} />} title="Not run yet" text="Run the checks to see the results." />}
      </Body>
    </>
  );
}
