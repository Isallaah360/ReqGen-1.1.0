"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { confirmFresh } from "@/lib/v4/freshConfirm";
import { nairaExact } from "@/lib/v4/money";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon, { type IconName } from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Card, Chip, Notice, PageHead, Skeleton, Stats, V4Page, downloadCsv, type StatItem } from "@/app/components/v4/ui";

type Issue = { kind: string; severity: "high" | "medium" | "low"; subject_id: string; subject: string; item: string; stored: number; supported: number; difference: number; note: string };
type Correction = { id: string; correction_no: string; subject_label: string; item: string; before_value: number; after_value: number; reason: string; corrected_label: string; created_at: string };
type Action = "subheads" | "accounts" | "opening";

const KIND_TEXT: Record<string, string> = { subhead: "Subhead", account: "IET account", overallocated: "Given more than the fund", opening: "Opening balance", orphan: "Record without its parent", double: "Counted twice" };
const TONE: Record<Issue["severity"], "red" | "amber" | "grey"> = { high: "red", medium: "amber", low: "grey" };
const SEVERITY: Record<Issue["severity"], string> = { high: "Serious", medium: "Check", low: "Minor" };

/** Rows a subhead correction can fix, and rows an account recalculation can fix. */
const subheadFixable = (x: Issue) => x.kind === "subhead" && (x.item === "Spent" || x.item === "Reserved");
const accountFixable = (x: Issue) => x.kind === "account" && (x.item === "Given to subheads" || x.item === "Spent" || x.item === "Available");

const ACTION_TEXT: Record<Action, { title: (n: number) => string; sub: string; purpose: string; button: string; placeholder: string; icon: IconName }> = {
  subheads: {
    title: (n) => `Correct ${n} subhead${n === 1 ? "" : "s"} to the records`,
    sub: "Spent and Reserved are set to what the requests and posted vouchers support. Allocations and bank balances do not change.",
    purpose: "correct the stored finance totals",
    button: "Confirm with 2FA and correct",
    placeholder: "e.g. Test records were deleted by hand in Supabase; no request or voucher supports this amount.",
    icon: "scale",
  },
  accounts: {
    title: (n) => `Recalculate ${n} IET account${n === 1 ? "" : "s"}`,
    sub: "Given to subheads, Spent, Reserved and Available are worked out again from the subheads paid from each account. The total fund does not change.",
    purpose: "recalculate the IET account figures",
    button: "Confirm with 2FA and recalculate",
    placeholder: "e.g. Account figures were left over after test records were deleted by hand.",
    icon: "returned",
  },
  opening: {
    title: () => "Record opening balances",
    sub: "One opening line is written in the ledger for each allocation and each account fund that has none. No amount changes.",
    purpose: "record the opening balances",
    button: "Confirm with 2FA and record",
    placeholder: "e.g. 2026/27 allocations were entered before the ledger was in use.",
    icon: "book",
  },
};

/**
 * Finance › Integrity (v4.6.4): every stored total checked against the records behind it,
 * grouped by what can be done about it. Subhead totals can be corrected to the records, IET
 * account figures worked out again from their subheads, and allocations or funds entered before
 * the ledger recorded as opening lines — by the Auditor or the Super Admin, with a reason and a
 * fresh 2FA code. None of these ever puts money into a bank account.
 */
export default function FinanceIntegrityPage() {
  const me = useIdentity();
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const canCorrect = role === "auditor" || role === "admin";
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [history, setHistory] = useState<Correction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [pickedSubs, setPickedSubs] = useState<Set<string>>(new Set());
  const [pickedAccs, setPickedAccs] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{ action: Action; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [i, h] = await Promise.all([
      supabase.rpc("reqgen_finance_integrity"),
      supabase.from("reqgen_finance_corrections").select("id,correction_no,subject_label,item,before_value,after_value,reason,corrected_label,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setError(i.error ? (/does not exist|schema cache/i.test(i.error.message) ? "The integrity check is switched on by the database steps v4_6_3_finance_integrity_reset.sql and v4_6_4_finance_opening_balances.sql." : i.error.message) : null);
    setIssues(((i.data || []) as Issue[]).map((x) => ({ ...x, stored: Number(x.stored), supported: Number(x.supported), difference: Number(x.difference) })));
    setHistory((h.data || []) as Correction[]);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const list = issues || [];
  const subheads = list.filter((x) => x.kind === "subhead");
  const accounts = list.filter((x) => x.kind === "account");
  const over = list.filter((x) => x.kind === "overallocated");
  const opening = list.filter((x) => x.kind === "opening");
  const other = list.filter((x) => !["subhead", "account", "overallocated", "opening"].includes(x.kind));
  const subIds = [...new Set(subheads.filter(subheadFixable).map((x) => x.subject_id))];
  const accIds = [...new Set(accounts.filter(accountFixable).map((x) => x.subject_id))];
  const problems = list.length - opening.length;

  const stats: StatItem[] = [
    { label: "Differences found", value: issues ? problems : "…", note: issues && !problems ? "Every total matches its records" : "Stored totals against records", icon: problems ? "alert" : "check", tone: problems ? "red" : "green" },
    { label: "Unsupported spending", value: issues ? nairaExact(subheads.filter((x) => x.item === "Spent").reduce((t, x) => t + Math.max(0, x.difference), 0)) : "…", note: "Recorded as spent, no record behind it", icon: "trend", tone: "brand" },
    { label: "Opening lines to record", value: issues ? opening.length : "…", note: opening.length ? nairaExact(opening.reduce((t, x) => t + x.stored, 0)) + " entered before the ledger" : "Every allocation has its ledger line", icon: "book", tone: "amber" },
    { label: "Corrections made", value: history.length, note: history[0] ? `Last: ${history[0].correction_no}` : "None yet", icon: "history", tone: "blue" },
  ];

  function toggle(which: "subs" | "accs", id: string) {
    const set = which === "subs" ? setPickedSubs : setPickedAccs;
    set((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function run() {
    if (!form) return;
    const reason = form.reason.trim();
    if (reason.length < 10) { setMsg({ tone: "red", text: "Write the reason (at least 10 characters)." }); return; }
    const why = await confirmFresh(ACTION_TEXT[form.action].purpose);
    if (why) { if (why !== "cancelled") setMsg({ tone: "red", text: why }); return; }
    setBusy(true);
    let text = "";
    let failed: string | null = null;
    if (form.action === "subheads") {
      const { data, error: e } = await supabase.rpc("reqgen_finance_correct", { p_subhead_ids: [...pickedSubs], p_reason: reason });
      failed = e?.message || null;
      text = `${(data as { corrected?: number })?.corrected ?? 0} subhead(s) now match their records.`;
    } else if (form.action === "accounts") {
      const { data, error: e } = await supabase.rpc("reqgen_finance_recalculate_accounts", { p_account_ids: [...pickedAccs], p_reason: reason });
      failed = e?.message || null;
      text = `${(data as { recalculated?: number })?.recalculated ?? 0} IET account(s) worked out again from their subheads.`;
    } else {
      const { data, error: e } = await supabase.rpc("reqgen_finance_record_opening", { p_reason: reason });
      failed = e?.message || null;
      const d = (data || {}) as { subheads?: number; accounts?: number };
      text = `Opening lines recorded: ${d.subheads ?? 0} subhead allocation(s) and ${d.accounts ?? 0} account fund(s).`;
    }
    setBusy(false);
    if (failed) { setMsg({ tone: "red", text: failed }); return; }
    setMsg({ tone: "green", text: `${text} The change is in the Audit Log and under "Corrections made".` });
    setForm(null); setPickedSubs(new Set()); setPickedAccs(new Set());
    await load();
  }

  const table = (rows: Issue[], pick?: { which: "subs" | "accs"; set: Set<string>; fixable: (x: Issue) => boolean }) => (
    <div className="v4-table-wrap">
      <table className="v4-data v4-stack">
        <thead><tr>{pick && canCorrect ? <th aria-label="Choose" /> : null}<th>Record</th><th>Item</th><th className="v4-r">Stored</th><th className="v4-r">{rows[0]?.kind === "overallocated" ? "Total fund" : "Records support"}</th><th className="v4-r">Difference</th><th className="v4-hide-md">Why</th></tr></thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={`${x.kind}-${x.subject_id}-${x.item}-${i}`}>
              {pick && canCorrect ? <td>{pick.fixable(x) ? <input type="checkbox" aria-label={`Choose ${x.subject}`} checked={pick.set.has(x.subject_id)} onChange={() => toggle(pick.which, x.subject_id)} /> : null}</td> : null}
              <td><span className="v4-strong">{x.subject}</span><span className="v4-sub">{KIND_TEXT[x.kind] || x.kind} · <Chip tone={TONE[x.severity]}>{SEVERITY[x.severity]}</Chip></span></td>
              <td data-label="Item">{x.item}</td>
              <td className="v4-r v4-num" data-label="Stored">{nairaExact(x.stored)}</td>
              <td className="v4-r v4-num" data-label={x.kind === "overallocated" ? "Total fund" : "Records support"}>{nairaExact(x.supported)}</td>
              <td className="v4-r v4-num" data-label="Difference"><span className="v4-strong" style={{ color: x.difference && x.severity !== "low" ? "var(--v4-red)" : undefined }}>{nairaExact(x.difference)}</span></td>
              <td className="v4-hide-md">{x.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const bar = (children: ReactNode) => (
    <div className="v4-card-body" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--v4-line-2)" }}>{children}</div>
  );

  return (
    <V4Page>
      <PageHead title="Finance Integrity" sub="Every stored total checked against the records behind it: subheads, IET accounts, the ledger and vouchers."
        actions={[
          { label: "Export CSV", icon: "download", kind: "secondary", disabled: !list.length, onClick: () => downloadCsv(`ReqGen_Finance_Integrity_${new Date().toISOString().slice(0, 10)}.csv`, list.map((x) => ({ What: KIND_TEXT[x.kind] || x.kind, Record: x.subject, Item: x.item, Stored: x.stored, "Records support": x.supported, Difference: x.difference, Note: x.note }))) },
          { label: "Check again", icon: "returned", kind: "secondary", onClick: () => { setIssues(null); void load(); } },
        ]} />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Stats items={stats} />

      {issues === null ? <Card title="Checking"><div className="v4-card-body"><Skeleton lines={5} /></div></Card> : null}
      {issues !== null && !list.length ? <Card title="What does not match"><div className="v4-card-body"><Notice tone="green">Every subhead, IET account and voucher matches the records behind it.</Notice></div></Card> : null}

      {subheads.length ? (
        <Card title={`Subheads (${subheads.length})`} link={{ href: "/finance/transactions-centre", label: "Open the Transaction Centre" }}>
          <div className="v4-card-body" style={{ paddingBottom: 0 }}>
            <Notice tone="amber" title="Before you correct">
              A difference means a total was changed without its record, for example records deleted by hand in the database. If the money was really paid, do not correct it: record the payment properly instead. Correcting changes only the stored total; it never puts money back into a bank account.
            </Notice>
          </div>
          {table(subheads, { which: "subs", set: pickedSubs, fixable: subheadFixable })}
          {canCorrect && subIds.length ? bar(<>
            <button className="v4-btn v4-btn-secondary" type="button" onClick={() => setPickedSubs(new Set(pickedSubs.size === subIds.length ? [] : subIds))}><Icon name="checkall" />{pickedSubs.size === subIds.length ? "Clear the choice" : "Choose every subhead"}</button>
            <button className="v4-btn v4-btn-primary" type="button" disabled={!pickedSubs.size || busy} onClick={() => setForm({ action: "subheads", reason: "" })}><Icon name="scale" />Correct {pickedSubs.size || ""} subhead{pickedSubs.size === 1 ? "" : "s"} to the records</button>
          </>) : null}
        </Card>
      ) : null}

      {accounts.length ? (
        <Card title={`IET accounts (${accounts.length})`}>
          <div className="v4-card-body" style={{ paddingBottom: 0 }}>
            <Notice tone="blue">An account&rsquo;s Given to subheads, Spent and Available are worked out from the subheads paid from it. When they differ, recalculate the account: only those figures change, never its total fund.</Notice>
          </div>
          {table(accounts, { which: "accs", set: pickedAccs, fixable: accountFixable })}
          {canCorrect && accIds.length ? bar(<>
            <button className="v4-btn v4-btn-secondary" type="button" onClick={() => setPickedAccs(new Set(pickedAccs.size === accIds.length ? [] : accIds))}><Icon name="checkall" />{pickedAccs.size === accIds.length ? "Clear the choice" : "Choose every account"}</button>
            <button className="v4-btn v4-btn-primary" type="button" disabled={!pickedAccs.size || busy} onClick={() => setForm({ action: "accounts", reason: "" })}><Icon name="returned" />Recalculate {pickedAccs.size || ""} account{pickedAccs.size === 1 ? "" : "s"}</button>
          </>) : null}
        </Card>
      ) : null}

      {over.length ? (
        <Card title={`Given more than the fund (${over.length})`}>
          <div className="v4-card-body" style={{ paddingBottom: 0 }}>
            <Notice tone="red" title="Subheads hold more than the account has.">
              Nothing here is corrected automatically. Set each account&rsquo;s fund from the bank statement in <Link href="/finance/manage-accounts">Bank Accounts</Link>, or reduce the allocations in <Link href="/finance/subheads">Budget &amp; Subheads</Link>. This line goes away when the fund covers what the subheads were given.
            </Notice>
          </div>
          {table(over)}
        </Card>
      ) : null}

      {opening.length ? (
        <Card title={`Opening balances to record (${opening.length})`}>
          <div className="v4-card-body" style={{ paddingBottom: 0 }}>
            <Notice tone="blue">These allocations and funds were entered before the ledger had a line for them. They are not errors. If the amounts are right, record them once as opening lines so the ledger and the Transaction Centre show where every figure came from.</Notice>
          </div>
          {table(opening)}
          {canCorrect ? bar(
            <button className="v4-btn v4-btn-primary" type="button" disabled={busy} onClick={() => setForm({ action: "opening", reason: "" })}><Icon name="book" />Record opening balances</button>,
          ) : null}
        </Card>
      ) : null}

      {other.length ? <Card title={`Other records to check (${other.length})`} link={{ href: "/finance/transactions-centre", label: "Open the Transaction Centre" }}>{table(other)}</Card> : null}

      <Card title="Corrections made">
        {history.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Correction</th><th>Record</th><th>Item</th><th className="v4-r">Before</th><th className="v4-r">After</th><th className="v4-hide-md">Reason</th><th className="v4-hide-sm">By</th></tr></thead>
              <tbody>
                {history.map((c) => (
                  <tr key={c.id}>
                    <td><span className="v4-strong">{c.correction_no}</span><span className="v4-sub">{new Date(c.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></td>
                    <td data-label="Record">{c.subject_label}</td>
                    <td data-label="Item">{c.item}</td>
                    <td className="v4-r v4-num" data-label="Before">{nairaExact(Number(c.before_value))}</td>
                    <td className="v4-r v4-num" data-label="After">{nairaExact(Number(c.after_value))}</td>
                    <td className="v4-hide-md">{c.reason}</td>
                    <td className="v4-hide-sm">{c.corrected_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No correction has been made.</p>}
      </Card>
      {!canCorrect ? <Notice tone="blue">Only the Auditor or the Super Admin can correct stored totals, recalculate accounts or record opening balances. <Link href="/profile/access">Check your position</Link>.</Notice> : null}

      <Modal open={!!form} title={form ? ACTION_TEXT[form.action].title(form.action === "subheads" ? pickedSubs.size : pickedAccs.size) : ""} sub={form ? ACTION_TEXT[form.action].sub : undefined} onClose={() => setForm(null)} busy={busy}
        footer={form ? <>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => setForm(null)}>Cancel</button>
          <button className="v4-btn v4-btn-primary" type="button" disabled={busy} onClick={() => void run()}><Icon name={ACTION_TEXT[form.action].icon} />{busy ? "Working…" : ACTION_TEXT[form.action].button}</button>
        </> : null}>
        {form ? (
          <label className="v4-field"><span className="v4-flabel">Reason <span className="v4-req">*</span></span>
            <textarea className="v4-input" rows={3} value={form.reason} placeholder={ACTION_TEXT[form.action].placeholder} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <span className="v4-help">Kept with the change and shown in the Audit Log.</span>
          </label>
        ) : null}
      </Modal>
    </V4Page>
  );
}
