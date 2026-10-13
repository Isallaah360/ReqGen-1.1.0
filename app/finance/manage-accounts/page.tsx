"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { ACCOUNT_COLUMNS, NIGERIAN_BANKS, accountAvailable, accountName, accountSub, num, type Account, type Assignment, type Person } from "@/lib/v4/finance";
import { formatAmountInput, nairaExact, parseAmount } from "@/lib/v4/money";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Pager, Skeleton, Stats, V4Page, downloadCsv, naira, type StatItem } from "@/app/components/v4/ui";

const PAGE = 12;

/** Finance › Bank Accounts (mock-up 39). Names only; the bank in grey. */
export default function BankAccountsPage() {
  const me = useIdentity();
  const role = normalizeRole(me.role);
  const canManage = role === "admin" || role === "auditor";
  const [rows, setRows] = useState<Account[] | null>(null);
  const [assign, setAssign] = useState<Assignment[]>([]);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "red" | "green"; text: string } | null>(null);
  const [q, setQ] = useState("");
  const [bank, setBank] = useState("all");
  const [status, setStatus] = useState("all");
  const [filter, setFilter] = useState<"" | "noofficer">("");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<{ mode: "new" | "edit"; id?: string; name: string; bank: string; active: boolean } | null>(null);
  const [fund, setFund] = useState<{ acc: Account; total: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, s, p] = await Promise.all([
      supabase.from("iet_accounts").select(ACCOUNT_COLUMNS).order("name", { ascending: true }),
      supabase.from("iet_account_officer_assignments").select("id,account_id,officer_user_id,created_at"),
      supabase.from("profiles").select("id,full_name,email,role"),
    ]);
    if (a.error) setMsg({ tone: "red", text: "Accounts could not be loaded: " + a.error.message });
    setRows((a.data || []) as Account[]);
    setAssign((s.data || []) as Assignment[]);
    setPeople(Object.fromEntries(((p.data || []) as Person[]).map((x) => [x.id, x.full_name || x.email || "—"])));
  }, []);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const officerOf = useMemo(() => new Map(assign.map((x) => [x.account_id, people[x.officer_user_id] || "—"])), [assign, people]);
  const banks = useMemo(() => [...new Set((rows || []).map((r) => r.bank_name).filter(Boolean) as string[])].sort(), [rows]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((r) =>
      (!t || `${r.name} ${r.code} ${r.bank_name}`.toLowerCase().includes(t)) &&
      (bank === "all" || r.bank_name === bank) &&
      (status === "all" || (status === "active" ? r.is_active !== false : r.is_active === false)) &&
      (filter !== "noofficer" || (r.is_active !== false && !officerOf.has(r.id))));
  }, [rows, q, bank, status, filter, officerOf]);
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);
  const active = (rows || []).filter((r) => r.is_active !== false);

  const stats: StatItem[] = [
    { label: "Accounts", value: rows ? rows.length : "…", note: rows ? `${active.length} active` : undefined, icon: "landmark", tone: "blue", pressed: !filter && status === "all", onClick: () => { setFilter(""); setStatus("all"); setPage(1); } },
    { label: "Total fund", value: rows ? naira(active.reduce((t, r) => t + num(r.total_fund), 0), { compact: true }) : "…", note: "Set by the Super Admin or Auditor", icon: "wallet", tone: "green" },
    { label: "Available", value: rows ? naira(active.reduce((t, r) => t + accountAvailable(r), 0), { compact: true }) : "…", note: "After spending and reservations", icon: "trend", tone: "brand" },
    { label: "Without officer", value: rows ? active.filter((r) => !officerOf.has(r.id)).length : "…", note: "Assign one", icon: "users", tone: "amber", pressed: filter === "noofficer", onClick: () => { setFilter(filter === "noofficer" ? "" : "noofficer"); setPage(1); } },
  ];

  async function saveAccount() {
    if (!edit) return;
    if (edit.name.trim().length < 2 || !edit.bank.trim()) { setMsg({ tone: "red", text: "Type the account name and choose the bank." }); return; }
    if (/^(pos|cash|cheque|transfer)$/i.test(edit.name.trim())) { setMsg({ tone: "red", text: "An account name cannot be a payment word (POS, Cash, Cheque or Transfer)." }); return; }
    setBusy(true);
    const payload = { name: edit.name.trim(), bank_name: edit.bank.trim(), is_active: edit.active };
    let error: { message: string; code?: string } | null = null;
    if (edit.mode === "edit" && edit.id) ({ error } = await supabase.from("iet_accounts").update(payload).eq("id", edit.id));
    else {
      const used = new Set((rows || []).map((r) => String(r.code || "").toUpperCase()));
      let n = 1; while (used.has(`IET${String(n).padStart(3, "0")}`)) n += 1;
      ({ error } = await supabase.from("iet_accounts").insert({ ...payload, code: `IET${String(n).padStart(3, "0")}` }));
    }
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    setMsg({ tone: "green", text: edit.mode === "new" ? `Account “${payload.name}” added.` : "Account saved." });
    setEdit(null);
    await load();
  }

  async function saveFund() {
    if (!fund) return;
    const total = parseAmount(fund.total);
    if (!Number.isFinite(total) || total < 0) { setMsg({ tone: "red", text: "Type the new total fund (numbers only)." }); return; }
    if (fund.note.trim().length < 3) { setMsg({ tone: "red", text: "Write a short note for the ledger (e.g. Q1 budget release)." }); return; }
    if (total < num(fund.acc.allocated_amount)) { setMsg({ tone: "red", text: `The fund cannot be less than what is already given to subheads (${nairaExact(fund.acc.allocated_amount)}).` }); return; }
    setBusy(true);
    const { error } = await supabase.rpc("reqgen_set_iet_account_fund", { p_bank_account_id: fund.acc.id, p_total_fund: total, p_actor_id: me.userId, p_note: fund.note.trim() });
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    setMsg({ tone: "green", text: `${fund.acc.name}: total fund set to ${nairaExact(total)}. The ledger records the change.` });
    setFund(null);
    await load();
  }

  function exportCsv() {
    downloadCsv("IET_Bank_Accounts.csv", filtered.map((r) => ({
      Code: r.code || "", Account: r.name, Bank: r.bank_name || "", "Total fund": num(r.total_fund), "Given to subheads": num(r.allocated_amount),
      Available: accountAvailable(r), Officer: officerOf.get(r.id) || "", Status: r.is_active === false ? "Inactive" : "Active",
    })));
  }

  const bankOptions = [...new Set([...NIGERIAN_BANKS, ...banks])].sort().map((b) => ({ value: b, label: b }));

  return (
    <V4Page>
      <PageHead title="Bank Accounts" sub="IET accounts and their funds. Account numbers are not stored here."
        actions={[
          { label: "Export CSV", icon: "download", kind: "secondary", onClick: exportCsv, disabled: !filtered.length },
          ...(canManage ? [{ label: "Add account", icon: "plus", kind: "primary" as const, onClick: () => setEdit({ mode: "new", name: "", bank: "", active: true }) }] : []),
        ]} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {!canManage && me.ready ? <Notice tone="blue">Only the Super Admin and the Auditor can add accounts or set funds. You are acting as {me.roleName}.</Notice> : null}
      <Stats items={stats} />
      <Card>
        <div className="v4-toolbar v4-t3">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Account or bank" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Bank</span><Select size="compact" ariaLabel="Bank" value={bank} onChange={(v) => { setBank(v); setPage(1); }} options={[{ value: "all", label: "All banks" }, ...banks.map((b) => ({ value: b, label: b }))]} /></div>
          <div className="v4-field"><span className="v4-flabel">Status</span><Select size="compact" ariaLabel="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setBank("all"); setStatus("all"); setFilter(""); setPage(1); }}><Icon name="returned" />Reset</button>
        </div>
        {rows === null ? <Skeleton lines={6} /> : paged.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Account</th><th className="v4-r">Available</th><th>Officer</th><th className="v4-r v4-hide-sm">Total fund</th><th>Status</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {paged.map((r) => {
                  const officer = officerOf.get(r.id);
                  return (
                    <tr key={r.id}>
                      <td><span className="v4-strong">{accountName(r)}</span><span className="v4-sub">{accountSub(r)}</span></td>
                      <td className="v4-r v4-num v4-strong">{naira(accountAvailable(r))}</td>
                      <td data-label="Officer">{officer || "—"}</td>
                      <td className="v4-r v4-num v4-hide-sm">{naira(r.total_fund)}</td>
                      <td>{r.is_active === false ? <Chip tone="grey">Inactive</Chip> : officer ? <Chip tone="green">Active</Chip> : <Chip tone="amber">No officer</Chip>}</td>
                      <td className="v4-r">
                        {canManage ? (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38, padding: "0 12px" }} onClick={() => setFund({ acc: r, total: formatAmountInput(String(num(r.total_fund))), note: "" })}>Set fund</button>
                            <button className="v4-btn v4-btn-ghost" type="button" style={{ minHeight: 38, padding: "0 10px" }} aria-label={`Edit ${r.name}`} onClick={() => setEdit({ mode: "edit", id: r.id, name: r.name, bank: r.bank_name || "", active: r.is_active !== false })}><Icon name="pen" /></button>
                          </span>
                        ) : <span className="v4-muted" style={{ fontSize: 13 }}>View only</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No account matches these filters.</p>}
        <Pager page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} label="accounts" />
      </Card>

      <Modal open={!!edit} title={edit?.mode === "new" ? "Add an IET account" : "Edit account"} sub="The account name only — never a payment word. The bank shows in grey under it." onClose={() => setEdit(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setEdit(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void saveAccount()} disabled={busy}>{busy ? "Saving…" : "Save account"}</button></>}>
        {edit ? (
          <>
            <label className="v4-field"><span className="v4-flabel">Account name <span className="v4-req">*</span></span><input className="v4-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Admin" /></label>
            <div className="v4-field"><label className="v4-flabel" htmlFor="acc-bank" style={{ fontSize: 13, fontWeight: 700 }}>Bank <span className="v4-req">*</span></label>
              <Select id="acc-bank" value={edit.bank} onChange={(v) => setEdit({ ...edit, bank: v })} options={bankOptions} placeholder="Choose the bank" searchable /></div>
            <label className="v4-check"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active (can fund subheads and payments)</label>
          </>
        ) : null}
      </Modal>

      <Modal open={!!fund} title={fund ? `Set the fund of ${fund.acc.name}` : ""} sub="The total money IET has placed in this account for the year. The change is written in the account ledger." onClose={() => setFund(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setFund(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void saveFund()} disabled={busy}>{busy ? "Saving…" : "Set fund"}</button></>}>
        {fund ? (
          <>
            <dl className="v4-kv"><dt>Total fund now</dt><dd>{nairaExact(fund.acc.total_fund)}</dd><dt>Given to subheads</dt><dd>{nairaExact(fund.acc.allocated_amount)}</dd><dt>Available</dt><dd>{nairaExact(accountAvailable(fund.acc))}</dd></dl>
            <label className="v4-field"><span className="v4-flabel">New total fund (₦) <span className="v4-req">*</span></span><input className="v4-input v4-num" inputMode="decimal" value={fund.total} onChange={(e) => setFund({ ...fund, total: formatAmountInput(e.target.value) })} />
              <span className="v4-help">{Number.isFinite(parseAmount(fund.total)) ? `Change: ${parseAmount(fund.total) - num(fund.acc.total_fund) >= 0 ? "+" : "−"} ${nairaExact(Math.abs(parseAmount(fund.total) - num(fund.acc.total_fund)))}` : ""}</span></label>
            <label className="v4-field"><span className="v4-flabel">Note for the ledger <span className="v4-req">*</span></span><input className="v4-input" value={fund.note} onChange={(e) => setFund({ ...fund, note: e.target.value })} placeholder="e.g. Q1 budget release" /></label>
          </>
        ) : null}
      </Modal>
    </V4Page>
  );
}
