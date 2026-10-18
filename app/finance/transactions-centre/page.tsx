"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { useFinancePowers } from "@/lib/v4/financePowers";
import { promptDialog } from "@/lib/dialog";
import { confirmFresh } from "@/lib/v4/freshConfirm";
import { nairaExact } from "@/lib/v4/money";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Pager, Skeleton, Stats, Tabs, V4Page, downloadCsv, type StatItem } from "@/app/components/v4/ui";

type Tx = { at: string; kind: string; ref_no: string | null; ref_id: string; source: string; destination: string; amount: number; effect: string; status: string; by_label: string | null; subhead_id: string | null; account_id: string | null; details: string | null };
type Reversal = { id: string; reversal_no: string; source_kind: "release" | "manual"; source_id: string; source_no: string; subhead_label: string | null; amount: number; reason: string; status: string; initiated_by: string; initiated_label: string; initiated_at: string; checked_label: string | null; check_comment: string | null; approved_label: string | null; approve_comment: string | null };
type Unsupported = { subject_id: string; subject: string; item: string; stored: number; supported: number; difference: number; note: string };
type Period = "month" | "quarter" | "fy" | "all";
type Sort = "new" | "old" | "high" | "low";
const PAGE = 25;
const EFFECT_TONE: Record<string, "green" | "red" | "blue" | "amber" | "grey" | "brand"> = { "Money in": "green", "Money out": "red", Spent: "brand", Payment: "blue", Allocation: "amber", Moved: "blue", Record: "grey" };
const REV_TONE: Record<string, "amber" | "blue" | "green" | "red" | "grey"> = { "With the Auditor": "amber", "With the DG": "blue", Approved: "green", Returned: "red", Rejected: "red", Cancelled: "grey" };

function rangeOf(p: Period) {
  const to = new Date(); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0);
  const from = new Date(); from.setHours(0, 0, 0, 0);
  if (p === "month") from.setDate(1);
  else if (p === "quarter") from.setMonth(from.getMonth() - 3);
  else if (p === "fy") { const y = from.getMonth() >= 8 ? from.getFullYear() : from.getFullYear() - 1; from.setFullYear(y, 8, 1); }
  else from.setFullYear(from.getFullYear() - 10);
  return { from, to };
}
const linkOf = (t: Tx) => (t.kind === "Fund released" ? `/finance/request/${t.ref_id}` : /voucher/i.test(t.kind) ? `/payment-vouchers/${t.ref_id}` : /transfer/i.test(t.kind) ? `/finance/account-transfers?open=${t.ref_id}` : null);
const reversible = (t: Tx) => t.effect === "Spent" && !t.status.startsWith("Reversed") && (t.kind === "Fund released" || t.kind === "Manual voucher");

export default function TransactionCentrePage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><Centre /></Suspense>;
}

/**
 * Finance › Transaction Centre (v4.6.3, v4.6.5): every money movement in one list — fund releases,
 * vouchers, transfers, funding, allocations and corrections — with reversals that follow
 * Account Officer → Auditor → DG. Real records are never edited or deleted directly.
 * v4.6.5: amounts a subhead shows as spent or reserved with NO record behind them (for example
 * after records were deleted by hand in the database) are listed here too, and the Auditor or the
 * Super Admin can remove them: the amount goes back to the subhead's balance, with a reason, a
 * fresh 2FA code and a correction number in the Audit Log.
 */
function Centre() {
  const me = useIdentity();
  const params = useSearchParams();
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const isOfficer = ["account", "accounts", "accountofficer"].includes(role);
  const isAuditor = role === "auditor";
  const isDG = role === "dg" || role === "directorgeneral" || role === "generalsecretary";
  const [rows, setRows] = useState<Tx[] | null>(null);
  const [revs, setRevs] = useState<Reversal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [tab, setTab] = useState<"all" | "reversals">(() => (params.get("reversal") ? "reversals" : "all"));
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [effect, setEffect] = useState(() => params.get("effect") || "all");
  const powers = useFinancePowers(me.userId, me.role);
  const [unsupported, setUnsupported] = useState<Unsupported[]>([]);
  const [removing, setRemoving] = useState<{ row: Unsupported; reason: string } | null>(null);
  const [period, setPeriod] = useState<Period>("fy");
  const [sort, setSort] = useState<Sort>("new");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Tx | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = rangeOf(period);
    const [t, v, i] = await Promise.all([
      supabase.rpc("reqgen_finance_ledger", { p_from: r.from.toISOString(), p_to: r.to.toISOString() }),
      supabase.from("reqgen_finance_reversals").select("*").order("initiated_at", { ascending: false }).limit(200),
      supabase.rpc("reqgen_finance_integrity"),
    ]);
    setUnsupported(((i.error ? [] : i.data || []) as Array<Unsupported & { kind: string }>)
      .filter((x) => x.kind === "subhead" && (x.item === "Spent" || x.item === "Reserved") && Number(x.difference) > 0)
      .map((x) => ({ subject_id: x.subject_id, subject: x.subject, item: x.item, stored: Number(x.stored), supported: Number(x.supported), difference: Number(x.difference), note: x.note })));
    setError(t.error ? (/does not exist|schema cache/i.test(t.error.message) ? "The Transaction Centre is switched on by the v4.6.3 database step (database/v4_6_3_finance_integrity_reset.sql)." : t.error.message) : null);
    setRows(((t.data || []) as Tx[]).map((x) => ({ ...x, amount: Number(x.amount) })));
    setRevs(((v.data || []) as Reversal[]).map((x) => ({ ...x, amount: Number(x.amount) })));
  }, [period]);
  useEffect(() => { if (me.ready) queueMicrotask(() => { setRows(null); void load(); }); }, [me.ready, load]);

  const all = rows || [];
  const kinds = [...new Set(all.map((x) => x.kind))].sort();
  const term = q.trim().toLowerCase();
  const shown = all
    .filter((x) => (kind === "all" || x.kind === kind) && (effect === "all" || x.effect === effect)
      && (!term || `${x.ref_no || ""} ${x.source} ${x.destination} ${x.by_label || ""} ${x.details || ""}`.toLowerCase().includes(term)))
    .sort((a, b) => (sort === "new" ? b.at.localeCompare(a.at) : sort === "old" ? a.at.localeCompare(b.at) : sort === "high" ? b.amount - a.amount : a.amount - b.amount));
  const sum = (f: (x: Tx) => boolean) => all.filter(f).reduce((t, x) => t + x.amount, 0);
  const myRev = (v: Reversal) => (isAuditor && v.status === "With the Auditor") || (isDG && v.status === "With the DG") || (isOfficer && v.initiated_by === me.userId && ["With the Auditor", "Returned"].includes(v.status));
  const unspent = unsupported.filter((x) => x.item === "Spent").reduce((t, x) => t + x.difference, 0);
  const stats: StatItem[] = [
    { label: "Money in", value: rows ? nairaExact(sum((x) => x.effect === "Money in")) : "…", note: "Funding and transfers in", icon: "landmark", tone: "green", onClick: () => { setTab("all"); setEffect("Money in"); } },
    { label: "Spent", value: rows ? nairaExact(sum((x) => x.effect === "Spent" && !x.status.startsWith("Reversed"))) : "…", note: unspent ? `Plus ${nairaExact(unspent)} with no record` : "Releases and manual vouchers", icon: "trend", tone: "brand", onClick: () => { setTab("all"); setEffect("Spent"); } },
    { label: "Records", value: rows ? all.length : "…", note: "In this period", icon: "list", tone: "blue", onClick: () => { setTab("all"); setEffect("all"); setKind("all"); } },
    { label: "Reversals waiting", value: revs.filter((v) => ["With the Auditor", "With the DG"].includes(v.status)).length, note: revs.some(myRev) ? "Some need you" : "Auditor or DG", icon: "returned", tone: "amber", onClick: () => setTab("reversals") },
  ];

  async function startReversal(t: Tx) {
    const reason = await promptDialog({ title: `Reverse ${t.ref_no}?`, message: "The subhead gets the money back as unspent budget. The bank balance does not change: if the bank returned the money, record that separately. The Auditor checks and the Director General approves.", label: "Reason", confirmLabel: "Send to the Auditor", tone: "danger" });
    if (!reason) return;
    setBusy(true);
    const { data, error: e } = await supabase.rpc("reqgen_reversal_start", { p_kind: t.kind === "Fund released" ? "release" : "manual", p_source_id: t.ref_id, p_reason: reason });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    setMsg({ tone: "green", text: `${(data as { reversal_no?: string })?.reversal_no || "Reversal"} sent to the Auditor. Nothing changes until the Director General approves.` });
    setOpen(null); setTab("reversals");
    await load();
  }

  async function removeUnsupported() {
    if (!removing) return;
    const reason = removing.reason.trim();
    if (reason.length < 10) { setMsg({ tone: "red", text: "Write why this amount is being removed (at least 10 characters)." }); return; }
    const why = await confirmFresh("remove the amount that has no record");
    if (why) { if (why !== "cancelled") setMsg({ tone: "red", text: why }); return; }
    setBusy(true);
    const { error: e } = await supabase.rpc("reqgen_finance_correct", { p_subhead_ids: [removing.row.subject_id], p_reason: reason });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    setMsg({ tone: "green", text: `${nairaExact(removing.row.difference)} removed from ${removing.row.subject}. The subhead's balance now shows it as unspent, and the change is in the Audit Log.` });
    setRemoving(null);
    await load();
  }

  async function act(v: Reversal, action: "pass" | "return" | "approve" | "reject" | "cancel") {
    setMsg(null);
    let comment: string | null = null;
    if (action !== "pass" && action !== "approve") {
      comment = await promptDialog({ title: action === "return" ? "Return to the Account Officer?" : action === "reject" ? "Reject this reversal?" : "Cancel this reversal?", label: "Reason", confirmLabel: action === "return" ? "Return" : action === "reject" ? "Reject" : "Cancel reversal", tone: "danger" });
      if (!comment) return;
    }
    if (action === "approve") {
      const why = await confirmFresh("approve and stamp this reversal");
      if (why) { if (why !== "cancelled") setMsg({ tone: "red", text: why }); return; }
    }
    setBusy(true);
    const call = action === "pass" || action === "return" ? supabase.rpc("reqgen_reversal_check", { p_id: v.id, p_pass: action === "pass", p_comment: comment })
      : action === "approve" || action === "reject" ? supabase.rpc("reqgen_reversal_approve", { p_id: v.id, p_approve: action === "approve", p_comment: comment })
      : supabase.rpc("reqgen_reversal_cancel", { p_id: v.id, p_reason: comment });
    const { error: e } = await call;
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    setMsg({ tone: "green", text: action === "approve" ? `${v.reversal_no} approved and stamped. ${v.source_no} is reversed and the subhead is updated.` : `${v.reversal_no} updated.` });
    await load();
  }

  return (
    <V4Page>
      <PageHead title="Transaction Centre" sub="Every money movement in one place: releases, vouchers, transfers, funding, allocations and corrections. Real records are never deleted — mistakes are reversed with approval. Amounts with no record behind them can be removed by the Auditor or the Super Admin."
        actions={[{ label: "Export CSV", icon: "download", kind: "secondary", disabled: !shown.length, onClick: () => downloadCsv(`ReqGen_Transactions_${new Date().toISOString().slice(0, 10)}.csv`, shown.map((x) => ({ Date: new Date(x.at).toLocaleString("en-GB"), Kind: x.kind, Reference: x.ref_no || "", From: x.source, To: x.destination, Amount: x.amount, Effect: x.effect, Status: x.status, By: x.by_label || "", Details: x.details || "" }))) },
          { label: "Integrity", icon: "scale", kind: "secondary", href: "/finance/integrity" }]} />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Stats items={stats} />
      {tab === "all" && (effect === "all" || effect === "Spent") && unsupported.length ? (
        <Card title={`Recorded with no record behind it (${unsupported.length})`} link={{ href: "/finance/integrity", label: "Open Finance Integrity" }}>
          <div className="v4-card-body" style={{ paddingBottom: 0 }}>
            <Notice tone="amber">These amounts sit on a subhead as spent or reserved, but no request, voucher or ledger line supports them, usually because records were deleted by hand in the database. If the money was really paid, do not remove it: record the payment properly. Removing it puts the amount back into the subhead&rsquo;s balance; no bank account changes.</Notice>
          </div>
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Subhead</th><th>Shown as</th><th className="v4-r">Amount with no record</th><th className="v4-hide-md">Why</th>{powers.canCorrect ? <th>Action</th> : null}</tr></thead>
              <tbody>
                {unsupported.map((x) => (
                  <tr key={`${x.subject_id}-${x.item}`}>
                    <td><span className="v4-strong">{x.subject}</span><span className="v4-sub">Stored {nairaExact(x.stored)} · records support {nairaExact(x.supported)}</span></td>
                    <td data-label="Shown as"><Chip tone={x.item === "Spent" ? "red" : "amber"}>{x.item}</Chip></td>
                    <td className="v4-r v4-num" data-label="Amount"><span className="v4-strong" style={{ color: "var(--v4-red)" }}>{nairaExact(x.difference)}</span></td>
                    <td className="v4-hide-md">{x.note}</td>
                    {powers.canCorrect ? <td data-label="Action"><button className="v4-btn v4-btn-primary" type="button" disabled={busy} onClick={() => setRemoving({ row: x, reason: "" })}><Icon name="scale" />Remove {nairaExact(x.difference)}</button></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {powers.ready && !powers.canCorrect && powers.reason ? <div className="v4-card-body"><Notice tone="blue">{powers.reason}</Notice></div> : null}
        </Card>
      ) : null}
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={(t) => setTab(t)} label="Show" items={[{ key: "all", label: "All transactions", count: rows ? all.length : undefined }, { key: "reversals", label: "Reversals", count: revs.filter(myRev).length || undefined }]} />
        </div>
        {tab === "all" ? (
          <>
            <div className="v4-toolbar">
              <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Number, subhead, payee or officer" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
              <div className="v4-field"><span className="v4-flabel">Kind</span><Select size="compact" ariaLabel="Kind" value={kind} onChange={(v) => { setKind(v); setPage(1); }} options={[{ value: "all", label: "Every kind" }, ...kinds.map((k) => ({ value: k, label: k }))]} /></div>
              <div className="v4-field"><span className="v4-flabel">Effect</span><Select size="compact" ariaLabel="Effect" value={effect} onChange={(v) => { setEffect(v); setPage(1); }} options={[{ value: "all", label: "Any effect" }, ...Object.keys(EFFECT_TONE).map((k) => ({ value: k, label: k }))]} /></div>
              <div className="v4-field v4-f-extra"><span className="v4-flabel">Period</span><Select size="compact" ariaLabel="Period" value={period} onChange={(v) => { setPeriod(v as Period); setPage(1); }} options={[{ value: "month", label: "This month" }, { value: "quarter", label: "Last 3 months" }, { value: "fy", label: "This financial year" }, { value: "all", label: "Everything" }]} /></div>
              <div className="v4-field v4-f-extra"><span className="v4-flabel">Sort</span><Select size="compact" ariaLabel="Sort" value={sort} onChange={(v) => setSort(v as Sort)} options={[{ value: "new", label: "Newest first" }, { value: "old", label: "Oldest first" }, { value: "high", label: "Largest amount" }, { value: "low", label: "Smallest amount" }]} /></div>
            </div>
            {rows === null ? <div className="v4-card-body"><Skeleton lines={8} /></div> : shown.length ? (
              <div className="v4-table-wrap">
                <table className="v4-data v4-stack">
                  <thead><tr><th>Date</th><th>Kind</th><th>Reference</th><th className="v4-hide-md">From → To</th><th className="v4-r">Amount</th><th>Status</th><th className="v4-hide-sm">By</th></tr></thead>
                  <tbody>
                    {shown.slice((page - 1) * PAGE, page * PAGE).map((x, i) => (
                      <tr key={`${x.ref_id}-${x.kind}-${i}`} className="v4-clickable" onClick={() => setOpen(x)}>
                        <td className="v4-num">{new Date(x.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td data-label="Kind"><span className="v4-strong">{x.kind}</span><span className="v4-sub"><Chip tone={EFFECT_TONE[x.effect] || "grey"}>{x.effect}</Chip></span></td>
                        <td data-label="Reference"><button type="button" className="v4-link" onClick={(e) => { e.stopPropagation(); setOpen(x); }}>{x.ref_no || "Details"}</button></td>
                        <td className="v4-hide-md">{x.source || "—"} → {x.destination || "—"}</td>
                        <td className="v4-r v4-num" data-label="Amount"><span className="v4-strong">{nairaExact(x.amount)}</span></td>
                        <td data-label="Status">{x.status.startsWith("Reversed") ? <Chip tone="red">{x.status}</Chip> : x.status}</td>
                        <td className="v4-hide-sm">{x.by_label || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No transaction matches.</p>}
            <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="transactions" />
          </>
        ) : revs.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Reversal</th><th>Of</th><th className="v4-r">Amount</th><th>Status</th><th className="v4-hide-md">Reason</th><th>Action</th></tr></thead>
              <tbody>
                {revs.map((v) => (
                  <tr key={v.id} style={params.get("reversal") === v.id ? { background: "var(--v4-brand-soft)" } : undefined}>
                    <td><span className="v4-strong">{v.reversal_no}</span><span className="v4-sub">{v.initiated_label} · {new Date(v.initiated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></td>
                    <td data-label="Of">{v.source_no}<span className="v4-sub">{v.source_kind === "release" ? "Fund release" : "Manual voucher"}{v.subhead_label ? ` · ${v.subhead_label}` : ""}</span></td>
                    <td className="v4-r v4-num" data-label="Amount">{nairaExact(v.amount)}</td>
                    <td data-label="Status"><Chip tone={REV_TONE[v.status] || "grey"}>{v.status}</Chip>{v.check_comment || v.approve_comment ? <span className="v4-sub">{v.approve_comment || v.check_comment}</span> : null}</td>
                    <td className="v4-hide-md">{v.reason}</td>
                    <td data-label="Action">
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {isAuditor && v.status === "With the Auditor" && v.initiated_by !== me.userId ? <>
                          <button className="v4-btn v4-btn-primary" type="button" disabled={busy} onClick={() => void act(v, "pass")}>Checked — send to the DG</button>
                          <button className="v4-btn v4-btn-ghost" type="button" disabled={busy} onClick={() => void act(v, "return")}>Return</button></> : null}
                        {isDG && v.status === "With the DG" ? <>
                          <button className="v4-btn v4-btn-primary" type="button" disabled={busy} onClick={() => void act(v, "approve")}><Icon name="pentool" />Approve and stamp</button>
                          <button className="v4-btn v4-btn-ghost" type="button" disabled={busy} onClick={() => void act(v, "reject")}>Reject</button></> : null}
                        {isOfficer && v.initiated_by === me.userId && ["With the Auditor", "Returned"].includes(v.status) ? <button className="v4-btn v4-btn-ghost" type="button" disabled={busy} onClick={() => void act(v, "cancel")}>Cancel</button> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No reversal has been started.</p>}
      </Card>
      <Notice tone="blue">A reversal gives a subhead its budget back; it never adds money to a bank account. Money returned by the bank is recorded separately by the Account Officer.</Notice>

      <Modal open={!!removing} title={removing ? `Remove ${nairaExact(removing.row.difference)} from ${removing.row.subject}` : ""} sub="The subhead's Spent and Reserved are set to what its requests and posted vouchers support, so the amount goes back into its balance. The allocation and every bank balance stay as they are." onClose={() => setRemoving(null)} busy={busy}
        footer={removing ? <>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="v4-btn v4-btn-primary" type="button" disabled={busy} onClick={() => void removeUnsupported()}><Icon name="check" />{busy ? "Removing…" : "Confirm with 2FA and remove"}</button>
        </> : null}>
        {removing ? (
          <label className="v4-field"><span className="v4-flabel">Reason <span className="v4-req">*</span></span>
            <textarea className="v4-input" rows={3} value={removing.reason} placeholder="e.g. Pilot test records were deleted by hand in Supabase; nothing supports this amount." onChange={(e) => setRemoving({ ...removing, reason: e.target.value })} />
            <span className="v4-help">Kept with the correction and shown in the Audit Log.</span>
          </label>
        ) : null}
      </Modal>

      <Modal open={!!open} title={open ? `${open.kind}${open.ref_no ? ` · ${open.ref_no}` : ""}` : ""} onClose={() => setOpen(null)} busy={busy}
        footer={open ? <>
          {linkOf(open) ? <Link className="v4-btn v4-btn-secondary" href={linkOf(open) as string}><Icon name="eye" />Open the record</Link> : null}
          {isOfficer && reversible(open) ? <button className="v4-btn v4-btn-primary" type="button" disabled={busy} onClick={() => void startReversal(open)}><Icon name="returned" />Start a reversal</button> : null}
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => setOpen(null)}>Close</button>
        </> : null}>
        {open ? (
          <dl className="v4-kv">
            <dt>Date</dt><dd>{new Date(open.at).toLocaleString("en-GB")}</dd>
            <dt>Amount</dt><dd>{nairaExact(open.amount)}</dd>
            <dt>Effect</dt><dd>{open.effect}</dd>
            <dt>From</dt><dd>{open.source || "—"}</dd>
            <dt>To</dt><dd>{open.destination || "—"}</dd>
            <dt>Status</dt><dd>{open.status}</dd>
            <dt>By</dt><dd>{open.by_label || "—"}</dd>
            {open.details ? <><dt>Details</dt><dd style={{ textAlign: "left", fontWeight: 500 }}>{open.details}</dd></> : null}
          </dl>
        ) : null}
      </Modal>
    </V4Page>
  );
}
