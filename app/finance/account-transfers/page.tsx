"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { promptDialog } from "@/lib/dialog";
import { confirmFresh } from "@/lib/v4/freshConfirm";
import { ACCOUNT_COLUMNS, SUBHEAD_COLUMNS, TRANSFER_TONE, accountUnallocated, subheadLabel, subheadLeft, type Account, type Subhead, type Transfer } from "@/lib/v4/finance";
import { formatAmountInput, nairaExact, nairaInWords, parseAmount } from "@/lib/v4/money";
import { shortDate } from "@/lib/v4/requestText";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Skeleton, Stats, Tabs, V4Page, downloadCsv, naira, type StatItem } from "@/app/components/v4/ui";

type Kind = "all" | "account" | "subhead";

export default function TransfersPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={6} /></V4Page>}><Transfers /></Suspense>;
}

/** Finance › Transfers (mock-up 44): Account Officer → Auditor → DG approves and stamps. */
function Transfers() {
  const me = useIdentity();
  const params = useSearchParams();
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const isOfficer = ["account", "accounts", "accountofficer"].includes(role);
  const isAuditor = role === "auditor";
  const isDG = role === "dg" || role === "generalsecretary";
  const [rows, setRows] = useState<Transfer[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);
  const [msg, setMsg] = useState<{ tone: "red" | "green" | "amber"; text: string } | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const [open, setOpen] = useState<Transfer | null>(null);
  const [form, setForm] = useState<{ kind: "account" | "subhead"; from: string; to: string; amount: string; narration: string; ref: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notReady, setNotReady] = useState(false);

  const load = useCallback(async () => {
    const [t, a, s] = await Promise.all([
      supabase.from("reqgen_transfers").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("iet_accounts").select(ACCOUNT_COLUMNS).order("name"),
      supabase.from("subheads").select(SUBHEAD_COLUMNS).order("code"),
    ]);
    if (t.error) {
      if (/does not exist|schema cache/i.test(t.error.message)) setNotReady(true);
      else setMsg({ tone: "red", text: t.error.message });
    }
    const list = (t.data || []) as Transfer[];
    setRows(list);
    setAccounts((a.data || []) as Account[]);
    setSubs((s.data || []) as Subhead[]);
    const want = params.get("open");
    if (want) setOpen((cur) => cur || list.find((x) => x.id === want) || null);
  }, [params]);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const q = (params.get("q") || "").toLowerCase();
  const myTurn = useCallback((t: Transfer) => (isAuditor && t.status === "With the Auditor") || (isDG && t.status === "With the DG") || (isOfficer && t.status === "Returned" && t.initiated_by === me.userId), [isAuditor, isDG, isOfficer, me.userId]);
  const shown = useMemo(() => (rows || []).filter((t) => (kind === "all" || t.kind === kind) && (!onlyWaiting || ["With the Auditor", "With the DG"].includes(t.status)) && (!q || t.transfer_no.toLowerCase().includes(q))), [rows, kind, onlyWaiting, q]);
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = (rows || []).filter((t) => t.created_at.startsWith(month));
  const waiting = (rows || []).filter((t) => ["With the Auditor", "With the DG"].includes(t.status));
  const approved = (rows || []).filter((t) => t.status === "Approved");
  const mine = (rows || []).filter(myTurn);

  const stats: StatItem[] = [
    { label: "Transfers this month", value: rows ? thisMonth.length : "…", note: rows ? naira(thisMonth.reduce((t, r) => t + Number(r.amount), 0)) : undefined, icon: "arrows", tone: "blue", pressed: !onlyWaiting, onClick: () => setOnlyWaiting(false) },
    { label: "Waiting", value: rows ? waiting.length : "…", note: "Auditor or DG", icon: "clock", tone: "amber", pressed: onlyWaiting, onClick: () => setOnlyWaiting(!onlyWaiting) },
    { label: "Approved", value: rows ? approved.length : "…", note: "Stamped by the DG", icon: "check", tone: "green" },
  ];

  async function create() {
    if (!form) return;
    const amount = parseAmount(form.amount);
    if (!form.from || !form.to || form.from === form.to) { setMsg({ tone: "red", text: "Choose two different " + (form.kind === "account" ? "accounts." : "subheads.") }); return; }
    if (!(amount > 0)) { setMsg({ tone: "red", text: "Type the amount." }); return; }
    if (form.narration.trim().length < 5) { setMsg({ tone: "red", text: "Write what the transfer is for." }); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("reqgen_transfer_create", { p_kind: form.kind, p_from: form.from, p_to: form.to, p_amount: amount, p_narration: form.narration.trim(), p_reference: form.ref.trim() || null });
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    setMsg({ tone: "green", text: `${(data as { transfer_no?: string })?.transfer_no || "Transfer"} sent to the Auditor for checking. Nothing changes in the ledgers until the Director General approves.` });
    setForm(null);
    await load();
  }

  async function act(t: Transfer, action: "pass" | "return" | "approve" | "reject" | "cancel" | "resend") {
    setMsg(null);
    let comment: string | null = null;
    if (action === "return" || action === "reject" || action === "cancel") {
      comment = await promptDialog({ title: action === "return" ? "Return to the Account Officer?" : action === "reject" ? "Reject this transfer?" : "Cancel this transfer?", label: "Reason", confirmLabel: action === "return" ? "Return" : action === "reject" ? "Reject" : "Cancel transfer", tone: "danger" });
      if (!comment) return;
    }
    if (action === "approve") {
      const why = await confirmFresh("approve and stamp this transfer");
      if (why) { if (why !== "cancelled") setMsg({ tone: "red", text: why }); return; }
    }
    setBusy(true);
    const call = action === "pass" || action === "return" ? supabase.rpc("reqgen_transfer_check", { p_id: t.id, p_pass: action === "pass", p_comment: comment })
      : action === "approve" || action === "reject" ? supabase.rpc("reqgen_transfer_approve", { p_id: t.id, p_approve: action === "approve", p_comment: comment })
      : action === "cancel" ? supabase.rpc("reqgen_transfer_cancel", { p_id: t.id, p_reason: comment })
      : supabase.rpc("reqgen_transfer_resend", { p_id: t.id, p_amount: t.amount, p_narration: t.narration });
    const { error } = await call;
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    setMsg({ tone: "green", text: action === "approve" ? `${t.transfer_no} approved and stamped. The ledgers are updated; ask the bank to move the money.` : action === "pass" ? `${t.transfer_no} checked and sent to the Director General.` : `${t.transfer_no} updated.` });
    setOpen(null);
    await load();
  }

  const acctOpts = accounts.filter((a) => a.is_active !== false).map((a) => ({ value: a.id, label: a.name, hint: `${a.bank_name || ""} · free ${nairaExact(accountUnallocated(a))}` }));
  const subOpts = subs.filter((s) => s.is_active !== false).map((s) => ({ value: s.id, label: subheadLabel(s), hint: `free ${nairaExact(subheadLeft(s))}` }));
  const fromFree = form ? (form.kind === "account" ? accountUnallocated(accounts.find((a) => a.id === form.from) || ({} as Account)) : subheadLeft(subs.find((s) => s.id === form.from) || ({} as Subhead))) : 0;
  const amt = form ? parseAmount(form.amount) : NaN;

  return (
    <V4Page>
      <PageHead title="Transfers" sub="Record a move of money between IET accounts or between subheads. ReqGen does not move money — it records the decision. The bank does the transfer."
        actions={[
          { label: "Export CSV", icon: "download", kind: "secondary", disabled: !shown.length, onClick: () => downloadCsv("Transfers.csv", shown.map((t) => ({ Transfer: t.transfer_no, Date: shortDate(t.created_at), Kind: t.kind === "account" ? "Between IET accounts" : "Between subheads", From: t.from_label, To: t.to_label, Amount: Number(t.amount), Status: t.status, "Started by": t.initiated_label || "", "Checked by": t.checked_label || "", "Approved by": t.approved_label || "" }))) },
          ...(isOfficer ? [{ label: "New transfer", icon: "plus", kind: "primary" as const, onClick: () => setForm({ kind: "account", from: "", to: "", amount: "", narration: "", ref: "" }) }] : []),
        ]} />
      {notReady ? <Notice tone="amber" title="Transfers are switched on by the v4.2.0 database step.">Ask the Super Admin to run database/v4_2_0_finance.sql in Supabase.</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <section className="v4-card v4-card-pad"><h2 className="v4-h3" style={{ marginBottom: 10 }}>Every transfer follows the same order</h2>
        <ol className="v4-chain">
          <li className={isOfficer ? "v4-now" : "v4-done"}><span className="v4-st">1 · Initiated</span><strong>Account Officer</strong><span className="v4-r">Fills the form and signs</span></li>
          <li className={isAuditor ? "v4-now" : "v4-done"}><span className="v4-st">2 · Checked</span><strong>Auditor</strong><span className="v4-r">Patricia Michael</span></li>
          <li className={isDG ? "v4-now" : "v4-wait"}><span className="v4-st">3 · Approved</span><strong>Director General</strong><span className="v4-r">Signs and applies the IET stamp (General Secretary when the DG is away)</span></li>
          <li className="v4-wait"><span className="v4-st">4 · Recorded</span><strong>Ledgers updated</strong><span className="v4-r">Only after the DG approves</span></li>
        </ol>
      </section>
      {mine.length ? <Notice tone="amber">{mine.length} transfer{mine.length === 1 ? " is" : "s are"} waiting for you.</Notice> : null}
      <Stats items={stats} />
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={kind} onChange={setKind} label="Kind" items={[
            { key: "all", label: "All", count: (rows || []).length },
            { key: "account", label: "Between IET accounts", count: (rows || []).filter((t) => t.kind === "account").length },
            { key: "subhead", label: "Between subheads", count: (rows || []).filter((t) => t.kind === "subhead").length },
          ]} />
        </div>
        {rows === null ? <Skeleton lines={5} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Transfer</th><th className="v4-r">Amount</th><th>From → To</th><th>Status</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id}>
                    <td><span className="v4-strong">{t.transfer_no}</span><span className="v4-sub">{shortDate(t.created_at)} · {t.kind === "account" ? "Between IET accounts" : "Between subheads"}</span></td>
                    <td className="v4-r v4-num v4-strong">{nairaExact(t.amount)}</td>
                    <td data-label="From → To">{t.from_label} → {t.to_label}</td>
                    <td><Chip tone={TRANSFER_TONE[t.status] || "grey"}>{t.status === "Approved" ? "Approved · stamped" : t.status}</Chip></td>
                    <td className="v4-r"><button type="button" className={`v4-btn ${myTurn(t) ? "v4-btn-primary" : "v4-btn-secondary"}`} style={{ minHeight: 38, padding: "0 12px" }} onClick={() => setOpen(t)}>{myTurn(t) ? "Act" : "Open"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No transfer yet.</p>}
      </Card>

      <Modal open={!!form} wide title="New transfer" sub="Your signature is added. The Auditor checks it next, then the Director General approves and stamps." onClose={() => setForm(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void create()} disabled={busy}><Icon name="send" />{busy ? "Sending…" : "Sign and send to the Auditor"}</button></>}>
        {form ? (
          <>
            <div className="v4-segmented" role="tablist" aria-label="Transfer kind">
              <button type="button" role="tab" aria-selected={form.kind === "account"} onClick={() => setForm({ ...form, kind: "account", from: "", to: "" })}>Between IET accounts</button>
              <button type="button" role="tab" aria-selected={form.kind === "subhead"} onClick={() => setForm({ ...form, kind: "subhead", from: "", to: "" })}>Between subheads</button>
            </div>
            <div className="v4-form-grid">
              <div className="v4-field"><label className="v4-flabel" htmlFor="tr-from" style={{ fontSize: 13, fontWeight: 700 }}>From <span className="v4-req">*</span></label>
                <Select id="tr-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} options={form.kind === "account" ? acctOpts : subOpts} placeholder={form.kind === "account" ? "Choose the account" : "Choose the subhead"} menuMinWidth={300} /></div>
              <div className="v4-field"><label className="v4-flabel" htmlFor="tr-to" style={{ fontSize: 13, fontWeight: 700 }}>To <span className="v4-req">*</span></label>
                <Select id="tr-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} options={(form.kind === "account" ? acctOpts : subOpts).filter((o) => o.value !== form.from)} placeholder={form.kind === "account" ? "Choose the account" : "Choose the subhead"} menuMinWidth={300} /></div>
              <label className="v4-field"><span className="v4-flabel">Amount (₦) <span className="v4-req">*</span></span><input className="v4-input v4-num" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: formatAmountInput(e.target.value) })} />
                <span className="v4-help">{amt > 0 ? nairaInWords(amt) : form.from ? `Free to move: ${nairaExact(fromFree)}` : ""}</span></label>
              <label className="v4-field"><span className="v4-flabel">Bank reference</span><input className="v4-input" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Optional" /></label>
              <label className="v4-field v4-span-2"><span className="v4-flabel">What is it for? <span className="v4-req">*</span></span><input className="v4-input" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} placeholder="e.g. Project support for Q1" /></label>
            </div>
            {form.from && amt > fromFree ? <Notice tone="red">Only {nairaExact(fromFree)} is free to move from the source{form.kind === "account" ? " (money already given to subheads stays)" : " (spent and reserved money stays)"}.</Notice> : null}
          </>
        ) : null}
      </Modal>

      <Modal open={!!open} wide title={open ? `${open.transfer_no} · ${nairaExact(open.amount)}` : ""} sub={open ? `${open.kind === "account" ? "Between IET accounts" : "Between subheads"} · ${open.from_label} → ${open.to_label}` : undefined} onClose={() => setOpen(null)} busy={busy}
        footer={open ? (
          <>
            <button type="button" className="v4-btn v4-btn-ghost" onClick={() => setOpen(null)} disabled={busy}>Close</button>
            {isAuditor && open.status === "With the Auditor" ? <><button type="button" className="v4-btn v4-btn-secondary" onClick={() => void act(open, "return")} disabled={busy}>Return</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void act(open, "pass")} disabled={busy}><Icon name="check" />Checked — send to the DG</button></> : null}
            {isDG && open.status === "With the DG" ? <><button type="button" className="v4-btn v4-btn-secondary" onClick={() => void act(open, "reject")} disabled={busy}>Reject</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void act(open, "approve")} disabled={busy}><Icon name="shield" />Approve, sign and stamp</button></> : null}
            {open.initiated_by === me.userId && ["With the Auditor", "Returned"].includes(open.status) ? <button type="button" className="v4-btn v4-btn-ghost" style={{ color: "var(--v4-red)" }} onClick={() => void act(open, "cancel")} disabled={busy}>Cancel transfer</button> : null}
            {open.initiated_by === me.userId && open.status === "Returned" ? <button type="button" className="v4-btn v4-btn-primary" onClick={() => void act(open, "resend")} disabled={busy}>Send again</button> : null}
          </>
        ) : null}>
        {open ? (
          <>
            <Chip tone={TRANSFER_TONE[open.status] || "grey"}>{open.status === "Approved" ? "Approved · stamped" : open.status}</Chip>
            <p style={{ margin: 0 }}>{open.narration}{open.external_reference ? ` · Bank ref ${open.external_reference}` : ""}</p>
            <p className="v4-help">{nairaInWords(open.amount)}</p>
            <ol className="v4-chain">
              <li className="v4-done"><span className="v4-st">Initiated</span><strong>{open.initiated_label || "Account Officer"}</strong><em>{shortDate(open.initiated_at)}</em></li>
              <li className={open.checked_at ? (open.status === "Returned" ? "v4-now" : "v4-done") : open.status === "With the Auditor" ? "v4-now" : "v4-wait"}><span className="v4-st">Checked</span><strong>{open.checked_label || "Auditor"}</strong><em>{open.checked_at ? shortDate(open.checked_at) : "Waiting"}</em>{open.check_comment ? <span className="v4-r">“{open.check_comment}”</span> : null}</li>
              <li className={open.approved_at ? "v4-done" : open.status === "With the DG" ? "v4-now" : "v4-wait"}><span className="v4-st">Approved</span><strong>{open.approved_label || "Director General"}</strong><em>{open.approved_at ? shortDate(open.approved_at) : "Waiting"}</em>
                {open.stamped ? (
                  <span className="v4-ink v4-stamp-host" style={{ position: "relative", height: 44 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {open.approved_signature ? <img src={open.approved_signature} alt="DG signature" style={{ maxHeight: 34, maxWidth: 110, objectFit: "contain" }} /> : null}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="v4-iet-stamp" src="/v4/iet-stamp.png" alt="IET stamp" style={{ right: -6, top: -12, width: 58 }} />
                  </span>
                ) : null}</li>
            </ol>
            {open.returned_reason && ["Returned", "Rejected", "Cancelled"].includes(open.status) ? <Notice tone="amber">{open.status}: “{open.returned_reason || open.approve_comment}”</Notice> : null}
            {open.status === "Approved" ? <Notice tone="green">Recorded in the ledgers on {shortDate(open.approved_at)}. The bank moves the money.</Notice> : null}
            {isDG && open.status === "With the DG" ? <p className="v4-help"><Icon name="fingerprint" size="sm" /> You confirm with your fingerprint or 2FA code; your signature and the IET stamp are applied.</p> : null}
          </>
        ) : null}
      </Modal>
    </V4Page>
  );
}
