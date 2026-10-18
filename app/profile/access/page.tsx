"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { switchActiveRole } from "@/lib/activeRole";
import { canAccessPath } from "@/lib/permissions";
import { normalizeRole } from "@/lib/roles";
import { canSeeBudgetBalances } from "@/lib/v4/budgetVisibility";
import { MODULES } from "@/lib/v4/modules";
import { positionName } from "@/app/components/v4/RoleSelect";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Held = { key: string; name: string; since: string | null; primary: boolean };

/** My Account › My Access (mock-up 19): the positions you hold and what each lets you open. */
export default function MyAccessPage() {
  const me = useIdentity();
  const [held, setHeld] = useState<Held[] | null>(null);
  const [systemAccount, setSystemAccount] = useState<string | null>(null);
  const [onRoutes, setOnRoutes] = useState<string[]>([]);
  const [away, setAway] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  useEffect(() => {
    if (!me.ready || !me.userId) return;
    let alive = true;
    queueMicrotask(async () => {
      const [roles, profile, officers, availability] = await Promise.all([
        supabase.from("profile_roles").select("role_key,role_name,is_active,is_primary,created_at,assigned_at").eq("profile_id", me.userId),
        supabase.from("profiles").select("role,system_account").eq("id", me.userId).maybeSingle(),
        supabase.from("reqgen_department_stage_officers").select("stage,dept_id").eq("user_id", me.userId),
        supabase.from("reqgen_officer_availability").select("is_away,away_until").eq("user_id", me.userId).maybeSingle(),
      ]);
      if (!alive) return;
      const sa = (profile.data as { system_account?: string | null } | null)?.system_account || null;
      setSystemAccount(sa);
      const seen = new Set<string>();
      const list: Held[] = [];
      for (const r of (roles.data || []) as Array<{ role_key: string | null; role_name: string | null; is_active: boolean | null; is_primary: boolean | null; created_at: string | null; assigned_at: string | null }>) {
        if (r.is_active === false) continue;
        const k = normalizeRole(r.role_key || r.role_name);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        list.push({ key: k, name: positionName(k, r.role_name || k, sa), since: r.assigned_at || r.created_at, primary: !!r.is_primary });
      }
      const fallback = normalizeRole((profile.data as { role?: string | null } | null)?.role);
      if (!seen.has("staff") && !sa) list.unshift({ key: "staff", name: "Staff", since: null, primary: !list.some((x) => x.primary) && fallback === "staff" });
      setHeld(list);
      const stages = [...new Set(((officers.data || []) as Array<{ stage: string }>).map((o) => o.stage === "HR" ? "HR Coordinator" : o.stage))];
      setOnRoutes(stages);
      const a = availability.data as { is_away?: boolean; away_until?: string | null } | null;
      setAway(a?.is_away ? (a.away_until ? `Away until ${new Date(a.away_until).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Marked away") : null);
    });
    return () => { alive = false; };
  }, [me.ready, me.userId]);

  async function actAs(key: string) {
    if (busy || normalizeRole(key) === normalizeRole(me.role)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await switchActiveRole(key);
      window.dispatchEvent(new CustomEvent("reqgen-active-role-changed", { detail: { roleKey: r.active_role_key, roleName: r.active_role_name } }));
      setMsg({ tone: "green", text: `You are now acting as ${positionName(r.active_role_key, r.active_role_name, systemAccount)}. The menu and tiles follow this choice.` });
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof Error ? e.message : "Could not change the position." });
    } finally { setBusy(false); }
  }

  const acting = normalizeRole(me.role);
  const actingName = positionName(acting, me.roleName, systemAccount);
  const seesBalances = canSeeBudgetBalances(acting);
  const isRegistry = acting === "registry";

  return (
    <V4Page>
      <PageHead title="My Access" sub="The positions you hold and what each lets you open. Only the Super Admin can change positions." />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      <section className="v4-card v4-card-pad">
        <h2 className="v4-h2" style={{ marginBottom: 6 }}>Acting as</h2>
        <p className="v4-help" style={{ margin: "0 0 12px" }}>Pick the position you are working in now. The menu, tiles and Approvals follow this choice.</p>
        {held === null ? <Skeleton lines={1} /> : (
          <div className="v4-segmented" role="tablist" aria-label="Acting as">
            {held.map((h) => (
              <button key={h.key} type="button" role="tab" aria-selected={normalizeRole(h.key) === acting} disabled={busy} onClick={() => void actAs(h.key)}>{h.name}</button>
            ))}
          </div>
        )}
      </section>

      <div className="v4-cols">
        <Card title="My positions">
          {held === null ? <Skeleton lines={3} /> : (
            <div className="v4-table-wrap">
              <table className="v4-data v4-stack">
                <thead><tr><th>Position</th><th>Since</th><th>Type</th></tr></thead>
                <tbody>
                  {held.map((h) => (
                    <tr key={h.key}>
                      <td><span className="v4-strong">{h.name}</span>{h.primary ? <span className="v4-sub">Main position</span> : null}</td>
                      <td data-label="Since">{h.since ? new Date(h.since).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                      <td>{h.key === "staff" ? <Chip tone="brand">Everyone</Chip> : systemAccount ? <Chip tone="blue">System account</Chip> : <Chip tone="grey">Position</Chip>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="My place on approval routes" pad>
          <dl className="v4-kv">
            <dt>Approval steps</dt>
            <dd className={onRoutes.length ? undefined : "v4-muted"} style={onRoutes.length ? undefined : { fontWeight: 600 }}>{onRoutes.length ? onRoutes.join(" · ") : "None in a department route"}</dd>
            <dt>Subhead balances</dt>
            <dd>{seesBalances ? "Shown" : "Hidden"}</dd>
            <dt>Request contents</dt>
            <dd>{isRegistry ? "Closed — numbers only" : "Your own, and those on your step"}</dd>
            <dt>Away cover</dt>
            <dd className={away ? undefined : "v4-muted"} style={away ? undefined : { fontWeight: 600 }}>{away || "Not away"}</dd>
          </dl>
        </Card>
      </div>

      <section className="v4-card v4-card-pad">
        <h2 className="v4-h2" style={{ marginBottom: 4 }}>What you can open</h2>
        <p className="v4-help" style={{ margin: "0 0 14px" }}>
          Acting as {actingName}.{!seesBalances ? " Subhead balances stay closed in this position." : ""}{isRegistry ? " Request contents stay closed to Registry." : ""}
        </p>
        <div className="v4-access">
          {MODULES.map((m) => {
            const ok = canAccessPath(m.href, new Set([acting]));
            return <div key={m.key} className={ok ? "v4-yes" : "v4-no"}><Icon name={ok ? "check" : "x"} />{m.label}</div>;
          })}
        </div>
      </section>
    </V4Page>
  );
}
