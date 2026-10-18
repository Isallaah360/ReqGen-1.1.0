"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { REQGEN_VERSION } from "@/lib/version";
import { loadModuleSwitches, type ModuleSwitch } from "@/lib/v4/moduleSwitches";
import { DEVELOPER_MODULE, MODULES } from "@/lib/v4/modules";
import { loadReleases, loadSystemAccounts, whenText, type Release, type SystemAccountStatus } from "@/lib/v4/developer";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Card, Chip, Notice, PageHead, Skeleton, Stats, Tiles, V4Page, type StatItem } from "@/app/components/v4/ui";

type Diagnostics = { tables: number; rls_on: number; rls_off: string[]; audit_events_today: number; response_ms: number; last_nightly: { at: string | null } | null; checks: Array<{ label: string; count: number }> };

/**
 * Developer Console (v4.6.6): the Developer system account's own home. Everything about the
 * running system at a glance, and the way into every module of the Trust's ReqGen.
 * The Developer can open every page; money decisions (raise, approve, sign, stamp, pay) stay
 * with IET officers, and every Developer action is written to the Audit Log.
 */
export default function DeveloperConsolePage() {
  const me = useIdentity();
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [switches, setSwitches] = useState<ModuleSwitch[] | null>(null);
  const [accounts, setAccounts] = useState<SystemAccountStatus[] | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [differences, setDifferences] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, sw, acc, rel, integ] = await Promise.all([
      supabase.rpc("reqgen_diagnostics"),
      loadModuleSwitches(true),
      loadSystemAccounts(),
      loadReleases(),
      supabase.rpc("reqgen_finance_integrity"),
    ]);
    setDiagError(d.error?.message || null);
    setDiag((d.data || null) as Diagnostics | null);
    setSwitches(sw);
    setAccounts(acc.rows);
    setError(acc.error || rel.error);
    setReleases(rel.rows);
    setDifferences(integ.error ? null : ((integ.data || []) as Array<{ kind: string }>).filter((x) => x.kind !== "opening").length);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const off = (switches || []).filter((s) => !s.enabled);
  const sa = (accounts || []).find((a) => a.kind === "Super Admin");
  const latest = releases[0];
  const dataChecks = (diag?.checks || []).reduce((t, c) => t + Number(c.count || 0), 0);
  const stats: StatItem[] = [
    { label: "Running version", value: REQGEN_VERSION, note: latest ? (latest.version === REQGEN_VERSION ? "Published to the Trust" : `Last published: ${latest.version}`) : "Not published yet", icon: "monitor", tone: "blue", href: "/developer/releases" },
    { label: "Modules", value: switches ? `${switches.length - off.length} of ${switches.length} on` : "…", note: off.length ? `Off: ${off.map((s) => s.label).join(", ")}` : "Everything is on", icon: "grid", tone: off.length ? "amber" : "green", href: "/developer/modules" },
    { label: "Super Admin account", value: sa ? sa.signin : "…", note: sa ? `${sa.has_2fa ? "2FA on" : "2FA not set"} · last sign-in ${whenText(sa.last_sign_in)}` : "ietreqgen@gmail.com", icon: "shield", tone: sa?.signin === "Ready" ? "green" : "red", href: "/developer/accounts" },
    { label: "Data checks", value: diag ? dataChecks : "…", note: differences === null ? "Records needing attention" : `${differences} finance difference${differences === 1 ? "" : "s"}`, icon: "activity", tone: dataChecks || differences ? "amber" : "green", href: "/admin/system-health" },
  ];

  return (
    <V4Page>
      <PageHead title="Developer Console" sub={`Signed in as the Developer (${me.email || "info@barderians.com.ng"}). Everything about the running system, and the way into every module.`}
        actions={[{ label: "Check again", icon: "returned", kind: "secondary", onClick: () => { setDiag(null); void load(); } }, { label: "Trust Dashboard", icon: "dashboard", kind: "secondary", href: "/dashboard?view=trust" }]} />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Stats items={stats} />

      <Tiles label="Developer tools" items={DEVELOPER_MODULE.tiles.map((t) => ({ ...t, tone: t.tone }))} />

      <div className="v4-cols">
        <Card title="System" link={{ href: "/admin/system-health", label: "Diagnostics" }}>
          {diag ? (
            <dl className="v4-kv" style={{ padding: "6px 18px 16px" }}>
              <dt>Database tables</dt><dd className="v4-mono">{diag.tables} · {diag.rls_on} protected</dd>
              <dt>Tables without row security</dt><dd>{diag.rls_off?.length ? <Chip tone="amber">{diag.rls_off.length}</Chip> : <Chip tone="green">None</Chip>}</dd>
              <dt>Audit events today</dt><dd className="v4-mono">{diag.audit_events_today}</dd>
              <dt>Last nightly backup</dt><dd>{whenText(diag.last_nightly?.at)}</dd>
              <dt>Database answered in</dt><dd className="v4-mono">{diag.response_ms} ms</dd>
            </dl>
          ) : diagError ? <div className="v4-card-body"><Notice tone="amber">{diagError}</Notice></div> : <div className="v4-card-body"><Skeleton lines={5} /></div>}
        </Card>
        <Card title="Data checks" link={{ href: "/finance/integrity", label: "Finance Integrity" }}>
          {diag ? (
            <ul className="v4-can v4-yes" style={{ padding: "8px 18px 16px", margin: 0 }}>
              {diag.checks.map((c) => <li key={c.label}><Icon name={c.count ? "alert" : "check"} /><span>{c.label}: <b>{c.count}</b></span></li>)}
              <li><Icon name={differences ? "alert" : "check"} /><span>Finance totals that differ from their records: <b>{differences ?? "—"}</b></span></li>
            </ul>
          ) : <div className="v4-card-body"><Skeleton lines={6} /></div>}
        </Card>
      </div>

      <Card title="Every module of the Trust's ReqGen">
        <div className="v4-card-body">
          <p className="v4-help" style={{ marginTop: 0 }}>You can open every page. Money decisions — raising, approving, signing, stamping and paying — stay with the Trust&rsquo;s officers, and everything this account does is written to the Audit Log.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MODULES.map((m) => {
              const isOff = off.some((s) => s.label === m.label || (s.module_key === "vouchers" && m.key === "payment-vouchers"));
              return <Link key={m.key} className="v4-btn v4-btn-secondary" href={m.key === "dashboard" ? "/dashboard?view=trust" : m.href}><Icon name={m.icon} />{m.label}{isOff ? <Chip tone="red">Off</Chip> : null}</Link>;
            })}
          </div>
        </div>
      </Card>
    </V4Page>
  );
}
