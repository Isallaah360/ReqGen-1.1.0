import { useState } from "react";
import { ArrowLeftRight, Check, CornerUpLeft, FileText, Landmark, Plus, Scale, Settings, Undo2, Wallet, Lock, Unlock } from "lucide-react";
import { db } from "../../lib/core";
import { fmtAmount, parseAmount } from "../../lib/files";
import { day, naira, when } from "../../lib/text";
import { SECTIONS } from "../../lib/vouchers";
import { ACCOUNT_COLUMNS, NIGERIAN_BANKS, SUBHEAD_COLUMNS, TRANSFER_TONE, accountAvailable, accountName, accountSub, accountUnallocated, fyOf, num, subheadLabel, subheadLeft, utilisation, type Account, type Subhead, type Transfer } from "../../lib/finance";
import { isClosed, stageKey, waitingForMe } from "../../lib/text";
import { useApp } from "../../App";
import { Body, Cell, Chip, Chips, Empty, FormSheet, Head, Item, More, Note, SearchBox, Sheet, Skeleton, useMore, useNav } from "../../ui";
import Detail from "../Detail";
import { VoucherRecord } from "./Vouchers";
import { Err, Facts, Stats, TONE, call, isAdminRole, isAuditorRole, isDgRole, isOfficerRole, parsed, useAction, useLoad } from "./kit";

const payeeKey = (n: string | null | undefined) => String(n || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
const fyLabel = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, "0")}`;

// ---- Finance Processing: requests at Account ------------------------------------------------------------
type Row = { id: string; request_no: string | null; title: string | null; amount: number | null; status: string | null; current_stage: string | null; current_owner: string | null; assigned_account_officer_id: string | null; assigned_account_officer_user_id: string | null; created_at: string | null; updated_at: string | null; request_type: string | null; personal_category: string | null; requester_name: string | null; dept_id: string | null; subhead_id: string | null };

export function FinanceProcessing() {
  const { me } = useApp();
  const { push } = useNav();
  const [tab, setTab] = useState<"mine" | "all" | "done">("mine");
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [l, d] = await Promise.all([
      c.from("requests").select("id,request_no,title,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_user_id,created_at,updated_at,request_type,personal_category,requester_name,dept_id,subhead_id").order("updated_at", { ascending: true }).limit(3000),
      c.from("departments").select("id,name"),
    ]);
    if (l.error) throw new Error(l.error.message);
    return { rows: (l.data || []) as Row[], depts: Object.fromEntries(((d.data || []) as Array<{ id: string; name: string }>).map((x) => [x.id, x.name])) };
  }, []);
  const atAccount = (data?.rows || []).filter((r) => stageKey(r.current_stage) === "ACCOUNT" && !isClosed(r));
  const mine = atAccount.filter((r) => waitingForMe(r, me.id));
  const done = (data?.rows || []).filter((r) => /paid|complet/i.test(String(r.status || "")) && (r.assigned_account_officer_id === me.id || r.assigned_account_officer_user_id === me.id)).reverse();
  const list = tab === "mine" ? mine : tab === "all" ? atAccount : done;
  const { shown, more, left } = useMore(list);
  return (
    <>
      <Head title="Finance Processing" />
      <Body onRefresh={reload}>
        <Stats items={[{ label: "Waiting for you", value: mine.length, tone: mine.length ? "wa" : undefined }, { label: "At Account", value: atAccount.length }, { label: "Total waiting", value: naira(mine.reduce((t, r) => t + num(r.amount), 0)) }, { label: "Treated by you", value: done.length }]} />
        <Chips label="Show" value={tab} onChange={setTab} items={[{ k: "mine", label: "Waiting for me", n: mine.length }, { k: "all", label: "All at Account", n: atAccount.length }, { k: "done", label: "Treated", n: done.length }]} />
        <Err text={error} />
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={<Wallet size={28} />} title="Nothing here" text={tab === "mine" ? "Requests approved by the DG and routed to you appear here." : "No requests."} /> : shown.map((r) => (
          <Item key={r.id} title={`${r.request_no || "Request"} · ${naira(r.amount)}`} sub={`${r.title || ""}${r.requester_name ? `, ${r.requester_name}` : ""}`}
            chip={tab === "done" ? <Chip tone="ok">Paid</Chip> : waitingForMe(r, me.id) ? <Chip tone="wa">Treat</Chip> : <Chip tone="mu">At Account</Chip>}
            facts={[["Department", data.depts[r.dept_id || ""] || "-"], ["Kind", `${r.request_type || ""}${r.personal_category ? `, ${r.personal_category}` : ""}`], ["Since", day(r.updated_at || r.created_at)]]}
            onClick={() => push(tab !== "done" && waitingForMe(r, me.id) ? <TreatRequest id={r.id} onDone={reload} /> : <Detail id={r.id} meId={me.id} onChanged={reload} />)} />
        ))}
        <More more={more} left={left} />
      </Body>
    </>
  );
}

/** Account treats an approved request: releases the fund and prepares its voucher in one step. */
export function TreatRequest({ id, onDone }: { id: string; onDone?: () => void }) {
  const { me } = useApp();
  const { push, replace } = useNav();
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const r = await c.from("requests").select("*").eq("id", id).maybeSingle();
    if (r.error || !r.data) throw new Error(r.error?.message || "This request is not open to you.");
    const req = r.data as Row & { details: string | null; direct_to: string | null };
    const [d, s, a, k, cs, bank] = await Promise.all([
      req.dept_id ? c.from("departments").select("name").eq("id", req.dept_id).maybeSingle() : Promise.resolve({ data: null }),
      req.subhead_id ? c.from("subheads").select(SUBHEAD_COLUMNS).eq("id", req.subhead_id).maybeSingle() : Promise.resolve({ data: null }),
      c.from("request_attachments").select("id").eq("request_id", id),
      c.from("request_attachment_checks").select("attachment_id").eq("request_id", id).eq("checked_by", me.id),
      c.from("payment_voucher_counter_signatories").select("full_name,signatory_type").eq("is_active", true).order("full_name"),
      c.from("reqgen_payee_bank_accounts").select("account_name,account_number,bank_name").eq("payee_key", payeeKey(req.requester_name)).maybeSingle(),
    ]);
    const atts = ((a.data || []) as Array<{ id: string }>).map((x) => x.id);
    const checked = new Set(((k.data || []) as Array<{ attachment_id: string }>).map((x) => x.attachment_id));
    return {
      req, dept: String((d.data as { name?: string } | null)?.name || ""), sub: (s.data as Subhead | null) || null, unchecked: atts.filter((x) => !checked.has(x)).length,
      counters: ((cs.data || []) as Array<{ full_name: string; signatory_type: string | null }>).filter((x) => !x.signatory_type || /counter/i.test(x.signatory_type)).map((x) => x.full_name),
      bank: (bank.data as { account_name: string; account_number: string; bank_name: string } | null) || null,
    };
  }, [id, me.id]);
  const [section, setSection] = useState("");
  const [mode, setMode] = useState<"Transfer" | "Cheque" | "Cash">("Transfer");
  const [bank, setBank] = useState<{ name: string; number: string; bank: string } | null>(null);
  const [cheque, setCheque] = useState({ no: "", date: new Date().toISOString().slice(0, 10), bank: "" });
  const [cashPayee, setCashPayee] = useState("");
  const [counter, setCounter] = useState("");
  const [narration, setNarration] = useState("");
  const [back, setBack] = useState(false);
  const { busy, err, setErr, run } = useAction();
  if (error && !data) return <><Head title="Treat request" /><Body><Note tone="er">{error}</Note></Body></>;
  if (!data) return <><Head title="Treat request" /><Body><Skeleton rows={4} /></Body></>;
  const { req } = data;
  const b = bank || { name: data.bank?.account_name || String(req.requester_name || "").toUpperCase(), number: data.bank?.account_number || "", bank: data.bank?.bank_name || "" };
  const bankOk = b.name.trim().length > 1 && b.number.replace(/\D/g, "").length === 10 && b.bank.trim().length > 1;

  function treat() {
    const why = !me.signature_url ? "Add your signature in Me › Signature and photo first." : data!.unchecked ? `Open the request and check ${data!.unchecked === 1 ? "the attachment" : `all ${data!.unchecked} attachments`} first.` : !section ? "Choose who you are preparing as." : mode === "Transfer" && !bankOk ? "Complete the bank details: account name, 10-digit account number and bank." : mode === "Cheque" && (!cheque.no.trim() || !cheque.bank) ? "Type the cheque number and choose the bank." : !counter ? "Choose the Counter Signer." : narration.trim().length < 3 ? "Write the narration." : "";
    if (why) { setErr(why); return; }
    let made: string | null = null;
    void run("release the fund and prepare the voucher", async () => {
      if (req.direct_to) await call("reqgen_direct_act", { p_request_id: req.id, p_action: "release", p_comment: `Fund released. ${narration.trim()}` });
      else await call("approve_request_step", { p_request_id: req.id, p_actor_id: me.id, p_comment: `Fund released. ${narration.trim()}`, p_signature_url: me.signature_url });
      try {
        const pv = parsed<{ voucher_id?: string }>(await call("reqgen_pv_generate", {
          p_request_ids: [req.id], p_mode: mode, p_preparing_as: section, p_counter_signer: counter,
          p_schedule: mode === "Transfer" ? [{ payee_name: String(req.requester_name || "").toUpperCase(), account_name: b.name.trim().toUpperCase(), account_number: b.number.replace(/\D/g, ""), bank_name: b.bank, request_ids: [req.id] }] : [],
          p_cash_payee: mode === "Cash" ? (cashPayee.trim() || String(req.requester_name || "").toUpperCase()) : null,
          p_cheque_no: mode === "Cheque" ? cheque.no.trim() : null, p_cheque_date: mode === "Cheque" ? cheque.date : null, p_cheque_bank: mode === "Cheque" ? cheque.bank : null,
          p_narration: narration.trim(), p_reissue_of: null,
        }));
        made = pv?.voucher_id || null;
      } catch (e) { throw new Error(`The fund is released, but the voucher was not created: ${e instanceof Error ? e.message : ""} Create it from Payment Vouchers › Generate from Requests.`); }
    }, "Fund released and the voucher sent to the Auditor.", () => { onDone?.(); if (made) replace(<VoucherRecord id={made} />); });
  }

  return (
    <>
      <Head title={`Treat ${req.request_no || "request"}`} />
      <Body bar onRefresh={reload}>
        <div className="card">
          <div className="row"><Chip tone="wa">At Account</Chip><span className="amt">{naira(req.amount)}</span></div>
          <p className="title">{req.title}</p>
          <Facts rows={[["From", req.requester_name || "-"], ["Department", data.dept || "-"], data.sub ? ["Subhead", subheadLabel(data.sub)] : null, data.sub ? ["Subhead left", naira(subheadLeft(data.sub))] : null]} />
          <button type="button" className="btn bs sm" onClick={() => push(<Detail id={req.id} meId={me.id} onChanged={reload} />)}><FileText size={16} />Open the request and its files</button>
        </div>
        {data.unchecked ? <Note tone="wa">Open the request and check {data.unchecked === 1 ? "the attachment" : `all ${data.unchecked} attachments`} before you release the fund.</Note> : null}
        <label><span className="lbl">Preparing as</span><select className="inp" value={section} onChange={(e) => setSection(e.target.value)}><option value="">Choose the section</option>{SECTIONS.map((s) => <option key={s} value={s}>Account Officer: {s}</option>)}</select></label>
        <div><span className="lbl">How it is paid</span><Chips label="Mode" value={mode} onChange={setMode} items={[{ k: "Transfer", label: "Transfer" }, { k: "Cheque", label: "Cheque" }, { k: "Cash", label: "Cash" }]} /></div>
        {mode === "Transfer" ? (<>
          <label><span className="lbl">Account name</span><input className="inp" value={b.name} onChange={(e) => setBank({ ...b, name: e.target.value })} /></label>
          <label><span className="lbl">Account number (10 digits)</span><input className="inp" inputMode="numeric" maxLength={10} value={b.number} onChange={(e) => setBank({ ...b, number: e.target.value.replace(/\D/g, "") })} /></label>
          <label><span className="lbl">Bank</span><input className="inp" list="rg-banks2" value={b.bank} onChange={(e) => setBank({ ...b, bank: e.target.value })} /></label>
          <datalist id="rg-banks2">{NIGERIAN_BANKS.map((x) => <option key={x} value={x} />)}</datalist>
        </>) : mode === "Cheque" ? (<>
          <label><span className="lbl">Cheque number</span><input className="inp" value={cheque.no} onChange={(e) => setCheque({ ...cheque, no: e.target.value })} /></label>
          <label><span className="lbl">Cheque date</span><input className="inp" type="date" value={cheque.date} onChange={(e) => setCheque({ ...cheque, date: e.target.value })} /></label>
          <label><span className="lbl">Bank</span><input className="inp" list="rg-banks2" value={cheque.bank} onChange={(e) => setCheque({ ...cheque, bank: e.target.value })} /></label>
          <datalist id="rg-banks2">{NIGERIAN_BANKS.map((x) => <option key={x} value={x} />)}</datalist>
        </>) : <label><span className="lbl">Paid in cash to</span><input className="inp" value={cashPayee} placeholder={String(req.requester_name || "").toUpperCase()} onChange={(e) => setCashPayee(e.target.value)} /></label>}
        <label><span className="lbl">Counter Signer</span><select className="inp" value={counter} onChange={(e) => setCounter(e.target.value)}><option value="">Choose the Counter Signer</option>{data.counters.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label><span className="lbl">Narration</span><textarea className="inp" value={narration} maxLength={500} onChange={(e) => setNarration(e.target.value)} placeholder="Being payment for…" style={{ minHeight: 70 }} /></label>
        <Err text={err} />
      </Body>
      <div className="bar">
        <button type="button" className="btn bs" onClick={() => setBack(true)}><CornerUpLeft size={18} />Return</button>
        <button type="button" className="btn bp" disabled={busy} onClick={treat}><Check size={18} />{busy ? "Releasing…" : "Release and prepare voucher"}</button>
      </div>
      <ReturnSheet open={back} onClose={() => setBack(false)} onRun={(reason) => req.direct_to ? call("reqgen_direct_act", { p_request_id: req.id, p_action: "return", p_comment: reason }) : call("reqgen_return_request", { p_request_id: req.id, p_comment: reason, p_signature_url: me.signature_url })} onDone={() => { onDone?.(); replace(<FinanceProcessing />); }} />
    </>
  );
}

function ReturnSheet({ open, onClose, onRun, onDone }: { open: boolean; onClose: () => void; onRun: (reason: string) => Promise<unknown>; onDone: () => void }) {
  const [t, setT] = useState("");
  const { busy, err, setErr, run } = useAction();
  return (
    <Sheet open={open} onClose={onClose} title="Return to the requester?">
      <p className="mu" style={{ fontSize: 14 }}>They see your reason, correct the request and send it again.</p>
      <label><span className="lbl">Reason</span><textarea className="inp" value={t} maxLength={500} onChange={(e) => setT(e.target.value)} style={{ minHeight: 80 }} /></label>
      <Err text={err} />
      <button type="button" className="btn bd block" disabled={busy} onClick={() => { if (t.trim().length < 3) { setErr("Write the reason."); return; } void run("return this request", () => onRun(t.trim()), "Returned to the requester.", () => { onClose(); onDone(); }); }}>{busy ? "Saving…" : "Return"}</button>
    </Sheet>
  );
}

// ---- Bank accounts ---------------------------------------------------------------------------------------
export function BankAccounts() {
  const { me } = useApp();
  const may = isOfficerRole(me.role) || isAdminRole(me.role);
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [a, s, p] = await Promise.all([c.from("iet_accounts").select(ACCOUNT_COLUMNS).order("name"), c.from("iet_account_officer_assignments").select("id,account_id,officer_user_id"), c.from("profiles").select("id,full_name")]);
    if (a.error) throw new Error(a.error.message);
    const names = Object.fromEntries(((p.data || []) as Array<{ id: string; full_name: string | null }>).map((x) => [x.id, x.full_name || ""]));
    return { list: (a.data || []) as Account[], officer: Object.fromEntries(((s.data || []) as Array<{ account_id: string; officer_user_id: string }>).map((x) => [x.account_id, names[x.officer_user_id] || ""])) };
  }, []);
  const [edit, setEdit] = useState<null | { id?: string; name: string; bank: string; active: boolean }>(null);
  const [fund, setFund] = useState<null | { acc: Account; total: string; note: string }>(null);
  const { busy, err, setErr, run } = useAction();
  const list = data?.list || [];
  return (
    <>
      <Head title="Bank Accounts" />
      <Body onRefresh={reload}>
        <Stats items={[{ label: "Total fund", value: naira(list.reduce((t, a) => t + num(a.total_fund), 0)) }, { label: "Given to subheads", value: naira(list.reduce((t, a) => t + num(a.allocated_amount), 0)) }, { label: "Spent", value: naira(list.reduce((t, a) => t + num(a.expenditure), 0)) }, { label: "Free", value: naira(list.reduce((t, a) => t + accountAvailable(a), 0)), tone: "ok" }]} />
        {may ? <button type="button" className="btn bs block" onClick={() => setEdit({ name: "", bank: "", active: true })}><Plus size={18} />Add an IET account</button> : null}
        <Err text={error} />
        {!data ? <Skeleton rows={3} /> : list.map((a) => (
          <Item key={a.id} title={accountName(a)} sub={accountSub(a)} chip={<Chip tone={a.is_active === false ? "mu" : "ok"}>{a.is_active === false ? "Off" : "Active"}</Chip>}
            facts={[["Total fund", naira(a.total_fund)], ["Given to subheads", naira(a.allocated_amount)], ["Not yet given", naira(accountUnallocated(a))], ["Reserved", naira(a.reserved_amount)], ["Spent", naira(a.expenditure)], ["Free", naira(accountAvailable(a))], ["Account Officer", data.officer[a.id] || "None"]]}>
            {may ? <><button type="button" className="btn bs sm" onClick={() => setFund({ acc: a, total: fmtAmount(String(num(a.total_fund))), note: "" })}><Wallet size={16} />Set fund</button><button type="button" className="btn bs sm" onClick={() => setEdit({ id: a.id, name: a.name, bank: a.bank_name || "", active: a.is_active !== false })}>Edit</button></> : null}
          </Item>
        ))}
      </Body>
      <FormSheet open={!!edit} title={edit?.id ? "Edit account" : "Add an IET account"} onClose={() => setEdit(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (!edit) return;
        if (edit.name.trim().length < 2 || edit.bank.trim().length < 2) { setErr("Type the account name and the bank."); return; }
        if (/^(pos|cash|cheque|transfer)$/i.test(edit.name.trim())) { setErr("An account name cannot be a payment word (POS, Cash, Cheque or Transfer)."); return; }
        void run(null, async () => {
          const c = await db();
          const payload = { name: edit.name.trim(), bank_name: edit.bank.trim(), is_active: edit.active };
          if (edit.id) { const { error: e } = await c.from("iet_accounts").update(payload).eq("id", edit.id); if (e) throw new Error(e.message); }
          else {
            const used = new Set(list.map((r) => String(r.code || "").toUpperCase()));
            let n = 1; while (used.has(`IET${String(n).padStart(3, "0")}`)) n += 1;
            const { error: e } = await c.from("iet_accounts").insert({ ...payload, code: `IET${String(n).padStart(3, "0")}` }); if (e) throw new Error(e.message);
          }
        }, "Account saved.", async () => { setEdit(null); await reload(); });
      }}>
        {edit ? (<>
          <label><span className="lbl">Account name</span><input className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Admin" /></label>
          <label><span className="lbl">Bank</span><input className="inp" list="rg-banks3" value={edit.bank} onChange={(e) => setEdit({ ...edit, bank: e.target.value })} /></label>
          <datalist id="rg-banks3">{NIGERIAN_BANKS.map((x) => <option key={x} value={x} />)}</datalist>
          <Chips label="Status" value={edit.active ? "on" : "off"} onChange={(k) => setEdit({ ...edit, active: k === "on" })} items={[{ k: "on", label: "Active" }, { k: "off", label: "Switched off" }]} />
        </>) : null}
      </FormSheet>
      <FormSheet open={!!fund} title={`Total fund: ${fund ? accountName(fund.acc) : ""}`} sub="The ledger records the change, with your note." onClose={() => setFund(null)} saveLabel="Set fund" busy={busy} error={err} onSave={() => {
        if (!fund) return;
        const total = parseAmount(fund.total);
        if (!(total >= 0)) { setErr("Type the total fund."); return; }
        if (total < num(fund.acc.allocated_amount)) { setErr(`The fund cannot be less than what is already given to subheads (${naira(fund.acc.allocated_amount)}).`); return; }
        if (fund.note.trim().length < 3) { setErr("Write a note for the ledger."); return; }
        void run("set the account fund", () => call("reqgen_set_iet_account_fund", { p_bank_account_id: fund.acc.id, p_total_fund: total, p_actor_id: me.id, p_note: fund.note.trim() }), "Total fund set. The ledger records the change.", async () => { setFund(null); await reload(); });
      }}>
        {fund ? (<>
          <label><span className="lbl">Total fund (₦)</span><input className="inp" inputMode="decimal" value={fund.total} onChange={(e) => setFund({ ...fund, total: fmtAmount(e.target.value) })} /></label>
          <label><span className="lbl">Note</span><input className="inp" value={fund.note} onChange={(e) => setFund({ ...fund, note: e.target.value })} placeholder="e.g. Second term allocation received" /></label>
        </>) : null}
      </FormSheet>
    </>
  );
}

// ---- Officer assignment -----------------------------------------------------------------------------------
export function OfficerAssignment() {
  const { me } = useApp();
  const may = isAdminRole(me.role) || isOfficerRole(me.role);
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [a, s, r, p] = await Promise.all([c.from("iet_accounts").select("id,code,name,bank_name,is_active").order("name"), c.from("iet_account_officer_assignments").select("id,account_id,officer_user_id"), c.from("profile_roles").select("profile_id,role_key,is_active").eq("is_active", true), c.from("profiles").select("id,full_name")]);
    const names = Object.fromEntries(((p.data || []) as Array<{ id: string; full_name: string | null }>).map((x) => [x.id, x.full_name || ""]));
    const officers = [...new Set(((r.data || []) as Array<{ profile_id: string; role_key: string }>).filter((x) => /^account/i.test(String(x.role_key).replace(/[^a-z]/gi, ""))).map((x) => x.profile_id))].map((id) => ({ id, name: names[id] || "Officer" }));
    return { accounts: (a.data || []) as Array<{ id: string; code: string | null; name: string; bank_name: string | null }>, assign: (s.data || []) as Array<{ id: string; account_id: string; officer_user_id: string }>, officers, names };
  }, []);
  const [dlg, setDlg] = useState<null | { acc: { id: string; name: string }; officer: string }>(null);
  const { busy, err, run } = useAction();
  return (
    <>
      <Head title="Officer Assignment" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Which Account Officer handles each IET account.</p>
        <Err text={error} />
        {!data ? <Skeleton rows={3} /> : <div className="grp">{data.accounts.map((a) => { const cur = data.assign.find((x) => x.account_id === a.id); return (
          <Cell key={a.id} icon={<Landmark size={18} />} title={a.name} sub={cur ? data.names[cur.officer_user_id] || "Officer" : "No officer yet"} onClick={may ? () => setDlg({ acc: a, officer: cur?.officer_user_id || "" }) : undefined} />
        ); })}</div>}
      </Body>
      <FormSheet open={!!dlg} title={dlg ? `Account Officer for ${dlg.acc.name}` : ""} onClose={() => setDlg(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (!dlg) return;
        const cur = data?.assign.find((x) => x.account_id === dlg.acc.id);
        void run(null, async () => {
          const c = await db();
          if (!dlg.officer) { if (cur) { const { error: e } = await c.from("iet_account_officer_assignments").delete().eq("id", cur.id); if (e) throw new Error(e.message); } return; }
          const { error: e } = await c.from("iet_account_officer_assignments").upsert({ account_id: dlg.acc.id, officer_user_id: dlg.officer }, { onConflict: "account_id" });
          if (e) throw new Error(e.message);
        }, "Saved.", async () => { setDlg(null); await reload(); });
      }}>
        {dlg ? <select className="inp" value={dlg.officer} onChange={(e) => setDlg({ ...dlg, officer: e.target.value })}><option value="">No officer</option>{(data?.officers || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : null}
      </FormSheet>
    </>
  );
}

// ---- Budget & subheads ------------------------------------------------------------------------------------
export function Subheads() {
  const { me } = useApp();
  const may = isOfficerRole(me.role) || isAdminRole(me.role);
  const fy = fyOf();
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [s, a, d, y] = await Promise.all([c.from("subheads").select(SUBHEAD_COLUMNS).order("code"), c.from("iet_accounts").select(ACCOUNT_COLUMNS), c.from("departments").select("id,name").order("name"), c.from("reqgen_financial_years").select("status").eq("fy_start", fy).maybeSingle()]);
    if (s.error) throw new Error(s.error.message);
    return { subs: (s.data || []) as Subhead[], accounts: (a.data || []) as Account[], depts: (d.data || []) as Array<{ id: string; name: string }>, fyStatus: String((y.data as { status?: string } | null)?.status || "Open") };
  }, []);
  const [dept, setDept] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<null | { sub?: Subhead; code: string; name: string; dept: string; account: string; alloc: string; note: string; active: boolean }>(null);
  const { busy, err, setErr, run } = useAction();
  const list = (data?.subs || []).filter((s) => (!dept || s.dept_id === dept) && (!q.trim() || subheadLabel(s).toLowerCase().includes(q.trim().toLowerCase())));
  const { shown, more, left } = useMore(list);
  const locked = data ? ["Locked", "Closed"].includes(data.fyStatus) : false;
  return (
    <>
      <Head title="Budget & Subheads" />
      <Body onRefresh={reload}>
        <Stats items={[{ label: "Allocation", value: naira(list.reduce((t, s) => t + num(s.approved_allocation), 0)) }, { label: "Reserved", value: naira(list.reduce((t, s) => t + num(s.reserved_amount), 0)) }, { label: "Spent", value: naira(list.reduce((t, s) => t + num(s.expenditure), 0)) }, { label: "Left", value: naira(list.reduce((t, s) => t + subheadLeft(s), 0)), tone: "ok" }]} />
        <p className="mu" style={{ margin: 0 }}>FY {fyLabel(fy)} budget: {data?.fyStatus || "…"}{locked ? ". Allocations change only by transfer." : "."}</p>
        <select className="inp" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{(data?.depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <SearchBox value={q} onChange={setQ} placeholder="Search code or name" />
        {may ? <button type="button" className="btn bs block" onClick={() => setEdit({ code: "", name: "", dept: dept, account: "", alloc: "0", note: "", active: true })}><Plus size={18} />Add a subhead</button> : null}
        <Err text={error} />
        {!data ? <Skeleton rows={4} /> : shown.map((s) => { const u = utilisation(s); return (
          <Item key={s.id} title={subheadLabel(s)} sub={data.depts.find((d) => d.id === s.dept_id)?.name || ""} chip={<Chip tone={u >= 90 ? "er" : u >= 70 ? "wa" : "ok"}>{u}% used</Chip>}
            facts={[["Allocation", naira(s.approved_allocation)], ["Reserved", naira(s.reserved_amount)], ["Spent", naira(s.expenditure)], ["Left", naira(subheadLeft(s))]]}
            onClick={may ? () => setEdit({ sub: s, code: s.code || "", name: s.name, dept: s.dept_id || "", account: s.bank_account_id || "", alloc: fmtAmount(String(num(s.approved_allocation))), note: "", active: s.is_active !== false }) : undefined} />
        ); })}
        <More more={more} left={left} />
      </Body>
      <FormSheet open={!!edit} title={edit?.sub ? `Edit ${edit.sub.code || edit.sub.name}` : "Add a subhead"} onClose={() => setEdit(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (!edit || !data) return;
        const alloc = parseAmount(edit.alloc || "0");
        const changed = !edit.sub || Math.abs(alloc - num(edit.sub.approved_allocation)) > 0.001 || edit.account !== (edit.sub.bank_account_id || "");
        const floor = edit.sub ? num(edit.sub.expenditure) + num(edit.sub.reserved_amount) : 0;
        const acc = data.accounts.find((a) => a.id === edit.account);
        const room = acc ? accountUnallocated(acc) + (edit.sub && edit.sub.bank_account_id === acc.id ? num(edit.sub.approved_allocation) : 0) : 0;
        const why = edit.name.trim().length < 2 ? "Type the subhead name." : !edit.account ? "Choose the funding account." : !(alloc >= 0) ? "Type the allocation." : changed && locked && edit.sub ? "The budget is locked; change allocations with a transfer." : changed && alloc > room ? `The account has only ${naira(room)} not yet given to subheads.` : edit.sub && alloc < floor ? `The allocation cannot be below what is spent and reserved (${naira(floor)}).` : changed && edit.note.trim().length < 3 ? "Write an allocation note for the ledger." : "";
        if (why) { setErr(why); return; }
        void run(changed ? "change the allocation" : null, async () => {
          const c = await db();
          const payload = { code: edit.code.trim() || null, name: edit.name.trim(), dept_id: edit.dept || null, is_active: edit.active };
          let sid = edit.sub?.id || "";
          if (edit.sub) { const { error: e } = await c.from("subheads").update(payload).eq("id", edit.sub.id); if (e) throw new Error(e.message); }
          else { const { data: d, error: e } = await c.from("subheads").insert({ ...payload, approved_allocation: 0, reserved_amount: 0, expenditure: 0, balance: 0 }).select("id").single(); if (e) throw new Error(/duplicate|unique/i.test(e.message) ? "A subhead with this code or name already exists." : e.message); sid = (d as { id: string }).id; }
          if (changed) await call("reqgen_assign_subhead_bank_allocation", { p_subhead_id: sid, p_bank_account_id: edit.account, p_new_allocation: alloc, p_actor_id: me.id, p_note: edit.note.trim() || "Subhead created." });
        }, "Subhead saved.", async () => { setEdit(null); await reload(); });
      }}>
        {edit && data ? (<>
          <label><span className="lbl">Code</span><input className="inp" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} placeholder="e.g. GA-05" /></label>
          <label><span className="lbl">Name</span><input className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
          <label><span className="lbl">Department</span><select className="inp" value={edit.dept} onChange={(e) => setEdit({ ...edit, dept: e.target.value })}><option value="">Choose</option>{data.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label><span className="lbl">Funding account</span><select className="inp" value={edit.account} onChange={(e) => setEdit({ ...edit, account: e.target.value })}><option value="">Choose</option>{data.accounts.map((a) => <option key={a.id} value={a.id}>{accountName(a)} ({naira(accountUnallocated(a))} not given)</option>)}</select></label>
          <label><span className="lbl">Approved allocation (₦)</span><input className="inp" inputMode="decimal" value={edit.alloc} disabled={locked && !!edit.sub} onChange={(e) => setEdit({ ...edit, alloc: fmtAmount(e.target.value) })} /></label>
          <label><span className="lbl">Allocation note (for the ledger)</span><input className="inp" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></label>
          <Chips label="Status" value={edit.active ? "on" : "off"} onChange={(k) => setEdit({ ...edit, active: k === "on" })} items={[{ k: "on", label: "Active" }, { k: "off", label: "Switched off" }]} />
        </>) : null}
      </FormSheet>
    </>
  );
}

// ---- Ledgers and the Transaction Centre ----------------------------------------------------------------------
type Tx = { at: string; kind: string; ref_no: string | null; ref_id: string; source: string; destination: string; amount: number; effect: string; status: string; by_label: string | null; subhead_id: string | null; account_id: string | null; details: string | null };
type Reversal = { id: string; reversal_no: string; source_kind: string; source_no: string; subhead_label: string | null; amount: number; reason: string; status: string; initiated_by: string; initiated_label: string; initiated_at: string; checked_label: string | null; approved_label: string | null };
function range(p: "month" | "quarter" | "fy" | "all") {
  const now = new Date();
  if (p === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  if (p === "quarter") return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  if (p === "fy") { const y = fyOf(now); return { from: new Date(y, 8, 1), to: new Date(y + 1, 8, 1) }; }
  return { from: new Date(2020, 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
}

export function Ledgers({ centre = false }: { centre?: boolean }) {
  const { me } = useApp();
  const { push } = useNav();
  const [p, setP] = useState<"month" | "quarter" | "fy" | "all">("month");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [rev, setRev] = useState<Tx | null>(null);
  const [act, setAct] = useState<null | { r: Reversal; a: "pass" | "return" | "approve" | "reject" | "cancel" }>(null);
  const { data, error, reload } = useLoad(async () => {
    const r = range(p);
    const c = await db();
    const [l, v] = await Promise.all([c.rpc("reqgen_finance_ledger", { p_from: r.from.toISOString(), p_to: r.to.toISOString() }), centre ? c.from("reqgen_finance_reversals").select("*").order("initiated_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] })]);
    if (l.error) throw new Error(l.error.message);
    return { tx: ((l.data || []) as Tx[]).map((x) => ({ ...x, amount: num(x.amount) })), rev: (v.data || []) as Reversal[] };
  }, [p, centre]);
  const kinds = [...new Set((data?.tx || []).map((t) => t.kind))];
  const list = (data?.tx || []).filter((t) => (kind === "all" || t.kind === kind) && (!q.trim() || [t.ref_no, t.source, t.destination, t.details].some((x) => String(x || "").toLowerCase().includes(q.trim().toLowerCase())))).slice().reverse();
  const { shown, more, left } = useMore(list);
  const out = list.filter((t) => t.effect === "Spent").reduce((s, t) => s + t.amount, 0);
  const inn = list.filter((t) => /in|fund|receiv/i.test(t.effect) && t.effect !== "Spent").reduce((s, t) => s + t.amount, 0);
  const maySeek = isOfficerRole(me.role) || isAdminRole(me.role) || isAuditorRole(me.role);
  const { busy, err, setErr, run } = useAction();
  const [reason, setReason] = useState("");
  return (
    <>
      <Head title={centre ? "Transaction Centre" : "Ledgers"} />
      <Body onRefresh={reload}>
        <Chips label="Period" value={p} onChange={setP} items={[{ k: "month", label: "This month" }, { k: "quarter", label: "3 months" }, { k: "fy", label: "This FY" }, { k: "all", label: "All" }]} />
        <Stats items={[{ label: "Movements", value: list.length }, { label: "Spent", value: naira(out), tone: "er" }, { label: "In / given", value: naira(inn) }, { label: "Net", value: naira(inn - out) }]} />
        <select className="inp" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind"><option value="all">Every kind</option>{kinds.map((k) => <option key={k} value={k}>{k}</option>)}</select>
        <SearchBox value={q} onChange={setQ} placeholder="Search reference, account or subhead" />
        <Err text={error} />
        {centre && data?.rev.length ? (<>
          <div className="sect"><b>Reversals</b></div>
          {data.rev.slice(0, 10).map((r) => (
            <Item key={r.id} title={`${r.reversal_no} · ${naira(r.amount)}`} sub={`${r.source_no}${r.subhead_label ? `, ${r.subhead_label}` : ""}: ${r.reason}`} chip={<Chip tone={/approved|reversed/i.test(r.status) ? "ok" : /reject|cancel/i.test(r.status) ? "er" : "wa"}>{r.status}</Chip>}>
              {/auditor/i.test(r.status) && isAuditorRole(me.role) ? <><button type="button" className="btn bs sm" onClick={() => setAct({ r, a: "return" })}>Return</button><button type="button" className="btn bp sm" onClick={() => setAct({ r, a: "pass" })}>Pass</button></> : null}
              {/dg/i.test(r.status) && isDgRole(me.role) ? <><button type="button" className="btn bs sm" onClick={() => setAct({ r, a: "reject" })}>Reject</button><button type="button" className="btn bp sm" onClick={() => setAct({ r, a: "approve" })}>Approve</button></> : null}
              {/with the|returned/i.test(r.status) && r.initiated_by === me.id ? <button type="button" className="btn bs sm" onClick={() => setAct({ r, a: "cancel" })}>Cancel</button> : null}
            </Item>
          ))}
        </>) : null}
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={<Scale size={28} />} title="No movements" text="Nothing moved in this period." /> : shown.map((t, i) => (
          <Item key={`${t.ref_id}-${i}`} title={`${t.kind} · ${naira(t.amount)}`} sub={`${t.ref_no || ""} ${when(t.at)}`} chip={<Chip tone={t.effect === "Spent" ? "er" : "in"}>{t.status || t.effect}</Chip>}
            facts={[["From", t.source || "-"], ["To", t.destination || "-"], t.by_label ? ["By", t.by_label] : null, t.details ? ["Details", t.details] : null]}
            onClick={/voucher/i.test(t.kind) ? () => push(<VoucherRecord id={t.ref_id} />) : t.kind === "Fund released" ? () => push(<Detail id={t.ref_id} meId={me.id} />) : undefined}>
            {centre && maySeek && t.effect === "Spent" && !t.status.startsWith("Reversed") && (t.kind === "Fund released" || t.kind === "Manual voucher") ? <button type="button" className="btn bs sm" onClick={() => { setReason(""); setRev(t); }}><Undo2 size={16} />Ask to reverse</button> : null}
          </Item>
        ))}
        <More more={more} left={left} />
      </Body>
      <FormSheet open={!!rev} title="Ask to reverse?" sub="The Auditor checks it, then the DG approves. Nothing changes until then." onClose={() => setRev(null)} saveLabel="Send for approval" busy={busy} error={err} onSave={() => {
        if (!rev) return;
        if (reason.trim().length < 5) { setErr("Write why it must be reversed."); return; }
        void run("ask for this reversal", () => call("reqgen_reversal_start", { p_kind: rev.kind === "Fund released" ? "release" : "manual", p_source_id: rev.ref_id, p_reason: reason.trim() }), "Sent to the Auditor.", async () => { setRev(null); await reload(); });
      }}><label><span className="lbl">Reason</span><textarea className="inp" value={reason} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 80 }} /></label></FormSheet>
      <FormSheet open={!!act} title={act ? `${act.a[0].toUpperCase()}${act.a.slice(1)} ${act.r.reversal_no}?` : ""} onClose={() => setAct(null)} saveLabel="Confirm" busy={busy} error={err} onSave={() => {
        if (!act) return;
        if (["return", "reject", "cancel"].includes(act.a) && reason.trim().length < 3) { setErr("Write the reason."); return; }
        const r = act.r, a = act.a;
        void run(`${a} this reversal`, () => a === "pass" || a === "return" ? call("reqgen_reversal_check", { p_id: r.id, p_pass: a === "pass", p_comment: reason.trim() }) : a === "approve" || a === "reject" ? call("reqgen_reversal_approve", { p_id: r.id, p_approve: a === "approve", p_comment: reason.trim() }) : call("reqgen_reversal_cancel", { p_id: r.id, p_reason: reason.trim() }), "Saved.", async () => { setAct(null); setReason(""); await reload(); });
      }}><label><span className="lbl">Comment</span><textarea className="inp" value={reason} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 70 }} /></label></FormSheet>
    </>
  );
}

// ---- Transfers --------------------------------------------------------------------------------------------
export function Transfers() {
  const { me } = useApp();
  const may = isOfficerRole(me.role) || isAdminRole(me.role);
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [t, a, s] = await Promise.all([c.from("reqgen_transfers").select("*").order("created_at", { ascending: false }).limit(1000), c.from("iet_accounts").select(ACCOUNT_COLUMNS).order("name"), c.from("subheads").select(SUBHEAD_COLUMNS).order("code")]);
    if (t.error) throw new Error(t.error.message);
    return { list: (t.data || []) as Transfer[], accounts: (a.data || []) as Account[], subs: (s.data || []) as Subhead[] };
  }, []);
  const [form, setForm] = useState<null | { kind: "account" | "subhead"; from: string; to: string; amount: string; narration: string; ref: string }>(null);
  const [act, setAct] = useState<null | { t: Transfer; a: "pass" | "return" | "approve" | "reject" | "cancel" | "resend" }>(null);
  const [comment, setComment] = useState("");
  const { busy, err, setErr, run } = useAction();
  const { shown, more, left } = useMore(data?.list || []);
  const opts = form?.kind === "subhead" ? (data?.subs || []).map((s) => ({ id: s.id, label: `${subheadLabel(s)} (${naira(subheadLeft(s))} left)` })) : (data?.accounts || []).map((a) => ({ id: a.id, label: `${accountName(a)}${a.bank_name ? `, ${a.bank_name}` : ""} (${naira(accountAvailable(a))} free)` }));
  return (
    <>
      <Head title="Transfers" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Move money between IET accounts or between subheads. The Auditor checks each transfer and the DG approves it.</p>
        {may ? <button type="button" className="btn bp block" onClick={() => setForm({ kind: "subhead", from: "", to: "", amount: "", narration: "", ref: "" })}><ArrowLeftRight size={18} />New transfer</button> : null}
        <Err text={error} />
        {!data ? <Skeleton rows={3} /> : !data.list.length ? <Empty icon={<ArrowLeftRight size={28} />} title="No transfers yet" text="Transfers appear here." /> : shown.map((t) => (
          <Item key={t.id} title={`${t.transfer_no} · ${naira(t.amount)}`} sub={`${t.from_label} → ${t.to_label}`} chip={<Chip tone={TONE[TRANSFER_TONE[t.status] || "grey"]}>{t.status}</Chip>}
            facts={[["Kind", t.kind === "account" ? "Between accounts" : "Between subheads"], ["Narration", t.narration], ["By", t.initiated_label || "-"], ["Date", day(t.created_at)], t.returned_reason ? ["Returned", t.returned_reason] : null]}>
            {t.status === "With the Auditor" && isAuditorRole(me.role) ? <><button type="button" className="btn bs sm" onClick={() => setAct({ t, a: "return" })}>Return</button><button type="button" className="btn bp sm" onClick={() => setAct({ t, a: "pass" })}>Pass</button></> : null}
            {t.status === "With the DG" && isDgRole(me.role) ? <><button type="button" className="btn bs sm" onClick={() => setAct({ t, a: "reject" })}>Reject</button><button type="button" className="btn bp sm" onClick={() => setAct({ t, a: "approve" })}>Approve</button></> : null}
            {t.status === "Returned" && t.initiated_by === me.id ? <button type="button" className="btn bp sm" onClick={() => setAct({ t, a: "resend" })}>Send again</button> : null}
            {["With the Auditor", "With the DG", "Returned"].includes(t.status) && (t.initiated_by === me.id || isAdminRole(me.role)) ? <button type="button" className="btn bs sm" onClick={() => setAct({ t, a: "cancel" })}>Cancel</button> : null}
          </Item>
        ))}
        <More more={more} left={left} />
      </Body>
      <FormSheet open={!!form} title="New transfer" onClose={() => setForm(null)} saveLabel="Send to the Auditor" busy={busy} error={err} onSave={() => {
        if (!form) return;
        const amount = parseAmount(form.amount);
        const why = !form.from || !form.to ? "Choose where it comes from and where it goes." : form.from === form.to ? "Choose two different ones." : !(amount > 0) ? "Type the amount." : form.narration.trim().length < 3 ? "Write the narration." : "";
        if (why) { setErr(why); return; }
        void run("send this transfer", () => call("reqgen_transfer_create", { p_kind: form.kind, p_from: form.from, p_to: form.to, p_amount: amount, p_narration: form.narration.trim(), p_reference: form.ref.trim() || null }), "Transfer sent to the Auditor.", async () => { setForm(null); await reload(); });
      }}>
        {form ? (<>
          <Chips label="Kind" value={form.kind} onChange={(k) => setForm({ ...form, kind: k, from: "", to: "" })} items={[{ k: "subhead", label: "Between subheads" }, { k: "account", label: "Between accounts" }]} />
          <label><span className="lbl">From</span><select className="inp" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}><option value="">Choose</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label><span className="lbl">To</span><select className="inp" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}><option value="">Choose</option>{opts.filter((o) => o.id !== form.from).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label><span className="lbl">Amount (₦)</span><input className="inp" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: fmtAmount(e.target.value) })} /></label>
          <label><span className="lbl">Narration</span><input className="inp" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} /></label>
          <label><span className="lbl">Bank reference (optional)</span><input className="inp" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></label>
        </>) : null}
      </FormSheet>
      <FormSheet open={!!act} title={act ? `${act.a === "resend" ? "Send again" : act.a[0].toUpperCase() + act.a.slice(1)}: ${act.t.transfer_no}` : ""} onClose={() => setAct(null)} saveLabel="Confirm" busy={busy} error={err} onSave={() => {
        if (!act) return;
        if (["return", "reject", "cancel"].includes(act.a) && comment.trim().length < 3) { setErr("Write the reason."); return; }
        const t = act.t, a = act.a;
        void run(a === "approve" ? "approve this transfer" : null, () => a === "pass" || a === "return" ? call("reqgen_transfer_check", { p_id: t.id, p_pass: a === "pass", p_comment: comment.trim() }) : a === "approve" || a === "reject" ? call("reqgen_transfer_approve", { p_id: t.id, p_approve: a === "approve", p_comment: comment.trim() }) : a === "cancel" ? call("reqgen_transfer_cancel", { p_id: t.id, p_reason: comment.trim() }) : call("reqgen_transfer_resend", { p_id: t.id, p_amount: t.amount, p_narration: t.narration }), "Saved.", async () => { setAct(null); setComment(""); await reload(); });
      }}><label><span className="lbl">Comment</span><textarea className="inp" value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 70 }} /></label></FormSheet>
    </>
  );
}

// ---- Finance integrity ---------------------------------------------------------------------------------------
type Issue = { kind: string; severity: "high" | "medium" | "low"; subject_id: string; subject: string; item: string; stored: number; supported: number; difference: number; note: string };
export function Integrity() {
  const { me } = useApp();
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [i, p, h] = await Promise.all([c.rpc("reqgen_finance_integrity"), c.rpc("reqgen_finance_powers"), c.from("reqgen_finance_corrections").select("id,correction_no,subject_label,item,before_value,after_value,reason,corrected_label,created_at").order("created_at", { ascending: false }).limit(20)]);
    if (i.error) throw new Error(i.error.message);
    const pw = (p.data || {}) as { can_correct?: boolean };
    return { issues: (i.data || []) as Issue[], canCorrect: !!pw.can_correct || isAdminRole(me.role) || isAuditorRole(me.role), history: (h.data || []) as Array<{ id: string; correction_no: string; subject_label: string; item: string; before_value: number; after_value: number; reason: string; corrected_label: string; created_at: string }> };
  }, [me.role]);
  const [mode, setMode] = useState<null | "subheads" | "accounts" | "opening">(null);
  const [reason, setReason] = useState("");
  const { busy, err, setErr, run } = useAction();
  const subs = (data?.issues || []).filter((x) => x.kind === "subhead" && (x.item === "Spent" || x.item === "Reserved"));
  const accs = (data?.issues || []).filter((x) => x.kind === "account" && ["Given to subheads", "Spent", "Available"].includes(x.item));
  return (
    <>
      <Head title="Finance Integrity" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Every stored total is checked against the records behind it.</p>
        <Err text={error} />
        {!data ? <Skeleton rows={3} /> : !data.issues.length ? <Note tone="ok" icon={<Check size={16} />}>Every total matches its records.</Note> : (<>
          <Stats items={[{ label: "Differences", value: data.issues.length, tone: "er" }, { label: "High", value: data.issues.filter((x) => x.severity === "high").length }]} />
          {data.issues.map((x, i) => (
            <Item key={i} title={`${x.subject}: ${x.item}`} sub={x.note} chip={<Chip tone={x.severity === "high" ? "er" : x.severity === "medium" ? "wa" : "mu"}>{x.severity}</Chip>}
              facts={[["Stored", naira(x.stored)], ["Records say", naira(x.supported)], ["Difference", naira(x.difference)]]} />
          ))}
        </>)}
        {data?.canCorrect ? (
          <div className="grp">
            <Cell icon={<Scale size={18} />} title="Correct subhead totals" sub={`${subs.length} to correct`} onClick={subs.length ? () => setMode("subheads") : undefined} />
            <Cell icon={<Landmark size={18} />} title="Work out IET accounts again" sub={`${accs.length} to correct`} onClick={accs.length ? () => setMode("accounts") : undefined} />
            <Cell icon={<FileText size={18} />} title="Record opening balances" sub="For totals that existed before ReqGen" onClick={() => setMode("opening")} />
          </div>
        ) : null}
        {data?.history.length ? (<><div className="sect"><b>Recent corrections</b></div>
          {data.history.map((h) => <Item key={h.id} title={`${h.correction_no}: ${h.subject_label}`} sub={h.reason} facts={[[h.item, `${naira(h.before_value)} → ${naira(h.after_value)}`], ["By", `${h.corrected_label}, ${when(h.created_at)}`]]} />)}</>) : null}
      </Body>
      <FormSheet open={!!mode} title={mode === "subheads" ? "Correct subhead totals" : mode === "accounts" ? "Work out IET accounts again" : "Record opening balances"} sub="Every correction is written in the Audit Log with your reason." onClose={() => setMode(null)} saveLabel="Correct" busy={busy} error={err} onSave={() => {
        if (reason.trim().length < 5) { setErr("Write the reason."); return; }
        void run("correct the finance totals", () => mode === "subheads" ? call("reqgen_finance_correct", { p_subhead_ids: [...new Set(subs.map((x) => x.subject_id))], p_reason: reason.trim() }) : mode === "accounts" ? call("reqgen_finance_recalculate_accounts", { p_account_ids: [...new Set(accs.map((x) => x.subject_id))], p_reason: reason.trim() }) : call("reqgen_finance_record_opening", { p_reason: reason.trim() }), "Corrected. The Audit Log records it.", async () => { setMode(null); setReason(""); await reload(); });
      }}><label><span className="lbl">Reason</span><textarea className="inp" value={reason} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 70 }} /></label></FormSheet>
    </>
  );
}

// ---- Finance settings -------------------------------------------------------------------------------------
export function FinanceSettings() {
  const { me } = useApp();
  const fy = fyOf();
  const canEdit = isAdminRole(me.role) || isAuditorRole(me.role);
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [y, s, l] = await Promise.all([c.from("reqgen_financial_years").select("*").eq("fy_start", fy).maybeSingle(), c.from("reqgen_finance_settings").select("key,value"), c.from("reqgen_finance_settings_log").select("key,new_value,changed_by_label,changed_at").order("changed_at", { ascending: false }).limit(5)]);
    const m = Object.fromEntries(((s.data || []) as Array<{ key: string; value: string | null }>).map((r) => [r.key, r.value || ""]));
    return { status: String((y.data as { status?: string } | null)?.status || "Open"), method: m.default_payment_method || "Transfer", cash: m.cash_dg_note_above || "200000", log: (l.data || []) as Array<{ key: string; new_value: string; changed_by_label: string; changed_at: string }> };
  }, []);
  const [method, setMethod] = useState<string | null>(null);
  const [cash, setCash] = useState<string | null>(null);
  const [lockNote, setLockNote] = useState<null | "lock" | "unlock" | "close">(null);
  const [note, setNote] = useState("");
  const { busy, err, setErr, run } = useAction();
  const m = method ?? data?.method ?? "Transfer", ch = cash ?? fmtAmount(String(data?.cash || ""));
  return (
    <>
      <Head title="Finance Settings" />
      <Body onRefresh={reload}>
        <Err text={error} />
        {!canEdit ? <Note tone="in">Only the Super Admin and the Auditor change these settings.</Note> : null}
        <div className="card">
          <div className="row"><b>Financial year {fyLabel(fy)}</b><Chip tone={data?.status === "Open" ? "ok" : "wa"}>{data?.status || "…"}</Chip></div>
          <p className="mu" style={{ margin: 0 }}>September to August. A locked budget changes only by transfer.</p>
          {canEdit && data ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {data.status === "Open" ? <button type="button" className="btn bs sm" onClick={() => setLockNote("lock")}><Lock size={16} />Approve and lock</button> : null}
            {data.status === "Locked" ? <><button type="button" className="btn bs sm" onClick={() => setLockNote("unlock")}><Unlock size={16} />Unlock</button><button type="button" className="btn bs sm" onClick={() => setLockNote("close")}>Close the year</button></> : null}
          </div> : null}
        </div>
        <label><span className="lbl">Default payment method</span><select className="inp" value={m} disabled={!canEdit} onChange={(e) => setMethod(e.target.value)}>{["Transfer", "Cheque", "Cash"].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
        <label><span className="lbl">Cash above this needs a DG note (₦)</span><input className="inp" inputMode="decimal" value={ch} disabled={!canEdit} onChange={(e) => setCash(fmtAmount(e.target.value))} /></label>
        {canEdit ? <button type="button" className="btn bp block" disabled={busy} onClick={() => void run(null, async () => { await call("reqgen_save_finance_setting", { p_key: "default_payment_method", p_value: m }); await call("reqgen_save_finance_setting", { p_key: "cash_dg_note_above", p_value: String(parseAmount(ch) || 0) }); }, "Settings saved.", reload)}><Settings size={18} />Save settings</button> : null}
        <Err text={err} />
        {data?.log.length ? (<><div className="sect"><b>Recent changes</b></div><div className="grp">{data.log.map((l, i) => <Cell key={i} icon={<Settings size={18} />} title={`${l.key.replace(/_/g, " ")}: ${l.new_value}`} sub={`${l.changed_by_label}, ${when(l.changed_at)}`} />)}</div></>) : null}
      </Body>
      <FormSheet open={!!lockNote} title={lockNote === "lock" ? "Approve and lock the budget?" : lockNote === "unlock" ? "Unlock the budget?" : "Close the year?"} onClose={() => setLockNote(null)} saveLabel="Confirm" busy={busy} error={err} onSave={() => {
        if (lockNote === "unlock" && note.trim().length < 5) { setErr("Write why it is unlocked."); return; }
        void run(`${lockNote} the budget`, () => lockNote === "lock" ? call("reqgen_fy_lock", { p_fy: fy, p_note: note.trim() || null }) : lockNote === "unlock" ? call("reqgen_fy_unlock", { p_fy: fy, p_reason: note.trim() }) : call("reqgen_fy_close", { p_fy: fy, p_note: null }), "Saved.", async () => { setLockNote(null); setNote(""); await reload(); });
      }}><label><span className="lbl">{lockNote === "unlock" ? "Reason" : "Note (optional)"}</span><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} /></label></FormSheet>
    </>
  );
}

