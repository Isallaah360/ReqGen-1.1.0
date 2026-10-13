"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { confirmDialog } from "@/lib/dialog";
import { accountName, accountSub, type Account, type Assignment } from "@/lib/v4/finance";
import { shortDate } from "@/lib/v4/requestText";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Modal from "@/app/components/v4/Modal";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Skeleton, Stats, V4Page, downloadCsv, type StatItem } from "@/app/components/v4/ui";

type Officer = { id: string; full_name: string | null; email: string | null; section: string };

const OFFICER_KEYS = ["account", "accounts", "accountofficer"];

/** Finance › Officer Assignment (mock-up 40): one Account Officer per IET account. */
export default function OfficerAssignmentPage() {
  const me = useIdentity();
  const role = normalizeRole(me.role);
  const canManage = role === "admin" || role === "auditor";
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [assign, setAssign] = useState<Assignment[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [msg, setMsg] = useState<{ tone: "red" | "green"; text: string } | null>(null);
  const [only, setOnly] = useState<"" | "none">("");
  const [dlg, setDlg] = useState<{ acc: Account; officer: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, s, pr, p] = await Promise.all([
      supabase.from("iet_accounts").select("id,code,name,bank_name,is_active").order("name"),
      supabase.from("iet_account_officer_assignments").select("id,account_id,officer_user_id,created_at"),
      supabase.from("profile_roles").select("profile_id,role_key,is_active").eq("is_active", true),
      supabase.from("profiles").select("id,full_name,email,role"),
    ]);
    if (a.error) setMsg({ tone: "red", text: a.error.message });
    setAccounts((a.data || []) as Account[]);
    setAssign((s.data || []) as Assignment[]);
    const holders = new Set(((pr.data || []) as Array<{ profile_id: string; role_key: string }>).filter((r) => OFFICER_KEYS.includes(normalizeRole(r.role_key))).map((r) => r.profile_id));
    const ppl = (p.data || []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }>;
    ppl.filter((x) => OFFICER_KEYS.includes(normalizeRole(x.role))).forEach((x) => holders.add(x.id));
    setOfficers(ppl.filter((x) => holders.has(x.id)).map((x) => ({ id: x.id, full_name: x.full_name, email: x.email, section: "" })).sort((x, y) => String(x.full_name).localeCompare(String(y.full_name))));
  }, []);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const byAccount = useMemo(() => new Map(assign.map((x) => [x.account_id, x])), [assign]);
  const nameOf = useMemo(() => new Map(officers.map((o) => [o.id, o.full_name || o.email || "—"])), [officers]);
  const accountsOf = useMemo(() => {
    const m = new Map<string, string[]>();
    assign.forEach((x) => { const a = (accounts || []).find((y) => y.id === x.account_id); if (a) m.set(x.officer_user_id, [...(m.get(x.officer_user_id) || []), a.name]); });
    return m;
  }, [assign, accounts]);
  const active = (accounts || []).filter((a) => a.is_active !== false);
  const shown = active.filter((a) => only !== "none" || !byAccount.has(a.id));

  const stats: StatItem[] = [
    { label: "Account Officers", value: officers.length, note: "With the Account Officer position", icon: "users", tone: "blue" },
    { label: "Accounts assigned", value: accounts ? active.filter((a) => byAccount.has(a.id)).length : "…", note: accounts ? `of ${active.length}` : undefined, icon: "check", tone: "green", pressed: !only, onClick: () => setOnly("") },
    { label: "Without officer", value: accounts ? active.filter((a) => !byAccount.has(a.id)).length : "…", note: "Payments cannot be treated", icon: "alert", tone: "amber", pressed: only === "none", onClick: () => setOnly(only === "none" ? "" : "none") },
  ];

  async function save() {
    if (!dlg) return;
    if (!dlg.officer) { setMsg({ tone: "red", text: "Choose the Account Officer." }); return; }
    setBusy(true);
    const { error } = await supabase.from("iet_account_officer_assignments").upsert({ account_id: dlg.acc.id, officer_user_id: dlg.officer }, { onConflict: "account_id" });
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    setMsg({ tone: "green", text: `${nameOf.get(dlg.officer)} now treats payments from ${dlg.acc.name}.` });
    setDlg(null);
    await load();
  }

  async function remove(acc: Account) {
    const cur = byAccount.get(acc.id);
    if (!cur) return;
    const ok = await confirmDialog({ title: `Remove the officer from ${acc.name}?`, message: "Requests paid from this account cannot be treated until another officer is assigned.", confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    const { error } = await supabase.from("iet_account_officer_assignments").delete().eq("id", cur.id);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    setMsg({ tone: "green", text: `${acc.name} has no officer now.` });
    await load();
  }

  return (
    <V4Page>
      <PageHead title="Officer Assignment" sub="Each IET account has one Account Officer who treats its payments."
        actions={[{ label: "Export CSV", icon: "download", kind: "secondary", onClick: () => downloadCsv("Officer_Assignment.csv", active.map((a) => ({ Account: a.name, Bank: a.bank_name || "", Officer: nameOf.get(byAccount.get(a.id)?.officer_user_id || "") || "", Since: shortDate(byAccount.get(a.id)?.created_at) }))) }]} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {!canManage && me.ready ? <Notice tone="blue">Only the Super Admin and the Auditor change assignments. You are acting as {me.roleName}.</Notice> : null}
      <Stats items={stats} />
      <Card>
        {accounts === null ? <Skeleton lines={6} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Account</th><th>Officer</th><th className="v4-hide-sm">Since</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {shown.map((a) => {
                  const cur = byAccount.get(a.id);
                  const others = cur ? (accountsOf.get(cur.officer_user_id) || []).filter((n) => n !== a.name) : [];
                  return (
                    <tr key={a.id}>
                      <td><span className="v4-strong">{accountName(a)}</span><span className="v4-sub">{accountSub(a)}</span></td>
                      <td data-label="Officer">{cur ? <><span className="v4-strong">{nameOf.get(cur.officer_user_id) || "—"}</span><span className="v4-sub">Account Officer{others.length ? ` · also ${others.slice(0, 3).join(", ")}` : ""}</span></> : <Chip tone="amber">No officer</Chip>}</td>
                      <td className="v4-hide-sm">{cur ? shortDate(cur.created_at) : "—"}</td>
                      <td className="v4-r">{canManage ? (
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <button type="button" className={`v4-btn ${cur ? "v4-btn-secondary" : "v4-btn-primary"}`} style={{ minHeight: 38, padding: "0 12px" }} onClick={() => setDlg({ acc: a, officer: cur?.officer_user_id || "" })}>{cur ? "Change" : "Assign"}</button>
                          {cur ? <button type="button" className="v4-btn v4-btn-ghost" style={{ minHeight: 38, padding: "0 10px", color: "var(--v4-red)" }} onClick={() => void remove(a)}>Remove</button> : null}
                        </span>
                      ) : <span className="v4-muted" style={{ fontSize: 13 }}>View only</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>{only === "none" ? "Every active account has an officer." : "No active account yet. Add one in Bank Accounts."}</p>}
      </Card>

      <Modal open={!!dlg} title={dlg ? `${byAccount.has(dlg.acc.id) ? "Change" : "Assign"} the officer for ${dlg.acc.name}` : ""} sub="The officer treats every payment from this account and prepares its vouchers." onClose={() => setDlg(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setDlg(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save"}</button></>}>
        {dlg ? (
          <div className="v4-field"><label className="v4-flabel" htmlFor="oa-officer" style={{ fontSize: 13, fontWeight: 700 }}>Account Officer <span className="v4-req">*</span></label>
            <Select id="oa-officer" value={dlg.officer} onChange={(v) => setDlg({ ...dlg, officer: v })} placeholder={officers.length ? "Choose the officer" : "No one holds the Account Officer position"}
              options={officers.map((o) => ({ value: o.id, label: o.full_name || o.email || "—", hint: (accountsOf.get(o.id) || []).length ? `Has ${(accountsOf.get(o.id) || []).join(", ")}` : "No account yet" }))} />
            <span className="v4-help">Only people holding the Account Officer position are listed (Administration › Staff & Positions).</span></div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
