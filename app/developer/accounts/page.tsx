"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { loadSystemAccounts, whenText, type SystemAccountStatus } from "@/lib/v4/developer";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

/** Developer Console › System Accounts (v4.6.6): both system accounts, live. */
export default function DeveloperAccountsPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<SystemAccountStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await loadSystemAccounts(); setRows(r.rows); setError(r.error); }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  return (
    <V4Page>
      <PageHead title="System Accounts" sub="The Trust's Super Admin and the Developer. Each signs in on the normal sign-in page with its own email, password and 2FA."
        actions={[{ label: "Check again", icon: "returned", kind: "secondary", onClick: () => { setRows(null); void load(); } }]} />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Card>
        {rows === null ? <div className="v4-card-body"><Skeleton lines={4} /></div> : (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Account</th><th>Sign-in</th><th>Marked</th><th>Position</th><th>2FA</th><th className="v4-hide-sm">Last sign-in</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.kind}>
                    <td><span className="v4-strong">{r.kind}</span><span className="v4-sub">{r.email}{r.full_name ? ` · ${r.full_name}` : ""}</span></td>
                    <td data-label="Sign-in"><Chip tone={r.signin === "Ready" ? "green" : "red"}>{r.signin}</Chip></td>
                    <td data-label="Marked">{r.marked ? <Chip tone="blue">{r.marked}</Chip> : <Chip tone="red">Not marked</Chip>}{r.full_name && !r.active ? <Chip tone="red">Deactivated</Chip> : null}</td>
                    <td data-label="Position">{r.positions || "—"}<span className="v4-sub">Acting as {r.acting || "—"}</span></td>
                    <td data-label="2FA">{r.has_2fa ? <Chip tone="green">On</Chip> : <Chip tone="amber">Not set</Chip>}</td>
                    <td className="v4-hide-sm">{whenText(r.last_sign_in)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Notice tone="blue" title="If an account shows Not created">
        Open Supabase › Authentication › Users › Add user, type the email and a password, tick Auto Confirm, then run v4_6_6_system_accounts.sql again. It gives the account its staff record and position.
      </Notice>
      <Link className="v4-btn v4-btn-secondary" href="/admin/system-accounts" style={{ alignSelf: "flex-start" }}><Icon name="shield" />What each account can and cannot do</Link>
    </V4Page>
  );
}
