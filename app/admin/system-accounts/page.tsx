"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { confirmFresh } from "@/lib/v4/freshConfirm";
import { adminApi, initials, positionsOf, whenText, type AdminPerson } from "@/lib/v4/admin";
import { loadSystemAccounts, type SystemAccountStatus } from "@/lib/v4/developer";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

const OWNER_EMAIL = "isallalah360@gmail.com";

// v4.6.6: ietreqgen@gmail.com is the only Super Admin; neither system account is a staff member
const SA_CAN = [
  "Add, change and deactivate staff; give and remove positions",
  "Set up departments, accounts, subheads and routing",
  "Set security rules: 2FA, passcode, sign-out time; reset a staff member’s 2FA or passcode",
  "See every report and the Audit Log, including the Developer’s actions",
  "Correct finance totals and remove amounts with no record behind them (2FA code)",
  "Run a Financial Reset or restore a backup (verified backup and 2FA code)",
  "Hand the account over to a new keeper",
];
const SA_CANNOT = [
  "Raise, approve, sign or stamp a request or voucher — it is not a staff member, belongs to no department and has no signature",
  "Open the contents of a request that was not routed to it",
  "Edit or delete the Audit Log, or delete a paid voucher",
  "Change the program code or the database structure",
];
const DEV_CAN = [
  "Open every module and every page of ReqGen, in its own Developer Console",
  "Everything the Super Admin can do, including finance corrections, Financial Reset and restore",
  "Switch a module off for maintenance, with a message for staff, and switch it on again",
  "Publish releases — staff read them in What’s new and the Super Admin is told",
  "Run Diagnostics and repair data — each repair needs a written reason",
];
const DEV_CANNOT = [
  "Raise, approve, sign, stamp or pay — money decisions stay with IET officers",
  "Act without a trace: every Developer action stays in the Audit Log (Developer tab), which nobody can change",
];

function List({ items, yes }: { items: string[]; yes: boolean }) {
  return <ul className={`v4-can ${yes ? "v4-yes" : "v4-no"}`}>{items.map((t) => <li key={t}><Icon name={yes ? "check" : "x"} /><span>{t}</span></li>)}</ul>;
}

/** Administration › System Accounts (mock-up 80). */
export default function SystemAccountsPage() {
  const me = useIdentity();
  const [people, setPeople] = useState<AdminPerson[] | null>(null);
  const [keeper, setKeeper] = useState<string>("");
  const [status, setStatus] = useState<SystemAccountStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dlg, setDlg] = useState<{ keeper: string; confirm: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [p, k, st] = await Promise.all([
      supabase.rpc("reqgen_admin_people"),
      supabase.from("app_settings").select("value").eq("key", "SUPERADMIN_KEEPER").maybeSingle(),
      loadSystemAccounts(),
    ]);
    setStatus(st.rows);
    setError(p.error?.message || null);
    setPeople((p.data || []) as AdminPerson[]);
    setKeeper(String((k.data as { value?: string } | null)?.value || ""));
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const sa = (people || []).find((p) => p.system_account === "superadmin");
  const dev = (people || []).find((p) => p.system_account === "developer");
  const owner = (people || []).find((p) => p.email.toLowerCase() === OWNER_EMAIL);
  const saStatus = status.find((x) => x.kind === "Super Admin");
  const devStatus = status.find((x) => x.kind === "Developer");
  const ready = (x: SystemAccountStatus | undefined) => (x ? <span className={`v4-chip ${x.signin === "Ready" && x.marked ? "v4-chip-green" : "v4-chip-red"}`}>{x.signin === "Ready" && x.marked ? "Can sign in" : x.signin === "Ready" ? "Not set up — run v4_6_6_system_accounts.sql" : x.signin}</span> : null);
  const iAmSuperAdmin = !!sa && sa.id === me.userId;

  async function handOver() {
    if (!dlg) return;
    if (dlg.keeper.trim().length < 3) { setMsg({ tone: "red", text: "Write the full name of the new keeper." }); return; }
    if (dlg.confirm.trim().toUpperCase() !== "HAND OVER") { setMsg({ tone: "red", text: "Type HAND OVER to confirm." }); return; }
    const fresh = await confirmFresh("hand over the Super Admin account", { codeOnly: true });
    if (fresh) { if (fresh !== "cancelled") setMsg({ tone: "red", text: fresh }); return; }
    setBusy(true);
    const res = await adminApi("/api/admin/handover", "POST", { keeper: dlg.keeper, confirm: dlg.confirm });
    setBusy(false);
    if (!res.ok) { setMsg({ tone: "red", text: res.error || "The hand-over failed." }); return; }
    setDlg(null);
    await supabase.auth.signOut({ scope: "local" });
    window.location.assign("/login?reason=handed-over");
  }

  return (
    <V4Page>
      <PageHead title="System Accounts" sub="Two accounts sit above everyday staff: the Trust’s Super Admin (ietreqgen@gmail.com) and the Developer (info@barderians.com.ng). Each signs in on the normal sign-in page with its own email, password and 2FA." />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {people === null ? <Skeleton lines={8} /> : (
        <>
          <section className="v4-sysacc">
            <article className="v4-acc-card v4-sa">
              <div className="v4-ah"><span className="v4-ava">SA</span><span><strong>Super Admin</strong><span>The Trust’s account · {sa?.email || "ietreqgen@gmail.com"}</span></span></div>
              <div className="v4-ab">
                <p className="v4-help" style={{ margin: 0 }}>Runs ReqGen for the Trust: people, positions, departments, routing, budgets set-up and security.{keeper ? <> Kept by <b>{keeper}</b>.</> : null}</p>
                <span className="v4-can-h">Can</span><List items={SA_CAN} yes />
                <span className="v4-can-h">Cannot</span><List items={SA_CANNOT} yes={false} />
              </div>
              <div className="v4-card-pad" style={{ borderTop: "1px solid var(--v4-line-2)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {iAmSuperAdmin ? <button className="v4-btn v4-btn-primary" type="button" onClick={() => { setMsg(null); setDlg({ keeper: "", confirm: "" }); }}><Icon name="send" />Hand over…</button> : null}
                <Link className="v4-btn v4-btn-secondary" href={`/audit-centre/logs?q=${encodeURIComponent(sa?.full_name || "Super Admin")}&range=30`}><Icon name="history" />See its activity</Link>
                {ready(saStatus)}
                <span className={`v4-chip ${(saStatus?.has_2fa ?? sa?.has_2fa) ? "v4-chip-green" : "v4-chip-amber"}`}>{(saStatus?.has_2fa ?? sa?.has_2fa) ? "2FA on" : "2FA not set"} · Last sign-in {whenText(saStatus?.last_sign_in ?? sa?.last_sign_in)}</span>
              </div>
            </article>
            <article className="v4-acc-card v4-dev">
              <div className="v4-ah"><span className="v4-ava"><Icon name="settings" /></span><span><strong>Developer</strong><span>Barderian Enterprises · {dev?.email || "info@barderians.com.ng"}</span></span></div>
              <div className="v4-ab">
                <p className="v4-help" style={{ margin: 0 }}>Keeps ReqGen running: releases, database changes, repairs and diagnostics. The highest technical level.</p>
                <span className="v4-can-h">Can</span><List items={DEV_CAN} yes />
                <span className="v4-can-h">Cannot</span><List items={DEV_CANNOT} yes={false} />
              </div>
              <div className="v4-card-pad" style={{ borderTop: "1px solid var(--v4-line-2)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Link className="v4-btn v4-btn-secondary" href="/audit-centre/logs?tab=developer&range=30"><Icon name="history" />See its activity</Link>
                {ready(devStatus)}
                <span className="v4-chip v4-chip-blue">Last sign-in {whenText(devStatus?.last_sign_in ?? dev?.last_sign_in)}</span>
              </div>
            </article>
          </section>
          <section className="v4-card v4-card-pad">
            <h2 className="v4-h2" style={{ marginBottom: 6 }}>Personal accounts are staff accounts</h2>
            <p className="v4-help" style={{ margin: "0 0 14px" }}>Nobody’s personal name or email sits on the Super Admin account. A personal account never holds the Super Admin position.</p>
            {owner ? (
              <div className="v4-who-card">
                <span className="v4-avatar">{initials(owner.full_name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}><strong>{owner.full_name}</strong><span>{owner.email}</span></span>
                <span className="v4-pos"><span className="v4-pchip v4-staff">Staff</span>{positionsOf(owner).map((p) => <span key={p.def.code} className={`v4-pchip v4-${p.def.chip}`}>{p.def.name}</span>)}</span>
              </div>
            ) : <p className="v4-muted" style={{ margin: 0 }}>The owner’s staff account ({OWNER_EMAIL}) is not in ReqGen yet.</p>}
          </section>
        </>
      )}
      <Modal open={!!dlg} title="Hand over the Super Admin account" sub="The account stays the Trust’s own. Only its keeper changes." onClose={() => setDlg(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setDlg(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-danger" onClick={() => void handOver()} disabled={busy}><Icon name="send" />{busy ? "Handing over…" : "Hand over"}</button></>}>
        {dlg ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <ul className="v4-can v4-yes">
              {["Every passcode and fingerprint on this account stops working", "Its 2FA is removed — the new keeper sets up their own authenticator", "The new keeper chooses a new password at the next sign-in", "Every session of this account is signed out, including this one", "The hand-over is written to the Audit Log"].map((t) => <li key={t}><Icon name="check" /><span>{t}</span></li>)}
            </ul>
            <label className="v4-field"><span className="v4-flabel">New keeper’s full name <span className="v4-req">*</span></span><input className="v4-input" value={dlg.keeper} onChange={(e) => setDlg({ ...dlg, keeper: e.target.value })} /></label>
            <label className="v4-field"><span className="v4-flabel">Type HAND OVER to confirm <span className="v4-req">*</span></span><input className="v4-input" value={dlg.confirm} autoComplete="off" onChange={(e) => setDlg({ ...dlg, confirm: e.target.value })} /></label>
            <Notice tone="amber">You will be asked for your 2FA code. Give the new keeper the password in person, then they change it.</Notice>
          </div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
