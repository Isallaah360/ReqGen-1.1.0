"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { canAccessPath } from "@/lib/permissions";
import { isAwaitingUser, isClosedRequest, APPROVAL_QUEUE_CHANGED_EVENT, type ApprovalQueueRow } from "@/lib/approvalQueue";
import { countUnread, fetchNotifications, timeAgo, NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications";
import { currentFyStart, fyLabel } from "@/lib/financialYear";
import { nairaShort } from "@/lib/v4/summaries";
import { stageKey, stageWords, statusChip, waitedFor } from "@/lib/v4/requestText";
import { roleDisplayName } from "@/lib/roles";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { DayIcon, dayPart, firstNameOf } from "@/app/components/v4/Greeting";
import { Btn, Card, Chip, PageHead, Skeleton, Stats, Tabs, V4Page, naira, type StatItem } from "@/app/components/v4/ui";

type Req = ApprovalQueueRow & { id: string; request_no: string | null; title: string | null; amount: number | null; created_at: string | null; created_by?: string | null };
type Pv = { id: string; voucher_no: string | null; payee_name: string | null; amount: number | null; status: string | null; signing_stage: string | null; created_at: string | null };
type Act = { id: string; request_id: string | null; action_type: string | null; comment: string | null; created_at: string | null };

const STAGE_ORDER = ["SUBMITTED", "PO", "PD", "DOD", "DIRECTOR", "DINADMIN", "REGISTRAR", "HOD", "HR", "DG", "ACCOUNT", "HRFILING", "COMPLETED"];

/** A 5-segment progress bar from the stage the request is at. */
function trackFor(r: Req) {
  const k = stageKey(r.current_stage);
  const s = String(r.status || "").toLowerCase();
  if (/paid|complet/.test(s) || k === "COMPLETED") return 5;
  if (k === "ACCOUNT") return 4;
  if (k === "DG") return 3;
  const i = STAGE_ORDER.indexOf(k);
  return i <= 0 ? 1 : 2;
}

const SHORTCUTS = [
  { href: "/requests/new", label: "New request", icon: "plus", tone: "brand" },
  { href: "/requests/mine", label: "My requests", icon: "list", tone: "blue" },
  { href: "/approvals/vouchers", label: "Vouchers to sign", icon: "pen", tone: "brand" },
  { href: "/reports/centre", label: "Reports", icon: "chart", tone: "green" },
  { href: "/requests/printable", label: "Print register", icon: "printer", tone: "blue" },
  { href: "/profile/details#signature", label: "My signature", icon: "pentool", tone: "amber" },
  { href: "/registry/centre", label: "Registry", icon: "archive", tone: "amber" },
  { href: "/finance/processing", label: "Finance processing", icon: "clock", tone: "brand" },
] as const;



/** Home (Dashboard) — v4.0.0: what needs you today. */
export default function DashboardPage() {
  const me = useIdentity();
  const [mine, setMine] = useState<Req[] | null>(null);
  const [queue, setQueue] = useState<Req[] | null>(null);
  const [vouchers, setVouchers] = useState<Pv[] | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [newest, setNewest] = useState<string | null>(null);
  const [acts, setActs] = useState<Act[] | null>(null);
  const [tab, setTab] = useState<"all" | "requests" | "vouchers">("all");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => { queueMicrotask(() => setNow(new Date())); }, []);

  useEffect(() => {
    if (!me.ready || !me.userId) return;
    let alive = true;
    const load = async () => {
      const [own, visible, pv, count, list, history] = await Promise.all([
        supabase.from("requests").select("id,request_no,title,amount,status,current_stage,current_owner,created_at").eq("created_by", me.userId).order("created_at", { ascending: false }).limit(300),
        supabase.from("requests").select("id,request_no,title,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_user_id,created_at").order("created_at", { ascending: true }).limit(2000),
        supabase.rpc("get_payment_vouchers_assigned_to_me"),
        countUnread(me.userId),
        fetchNotifications(me.userId, { limit: 1 }),
        supabase.rpc("reqgen_treated_by_me", { p_limit: 5 }),
      ]);
      if (!alive) return;
      setMine(own.error ? [] : (own.data || []) as Req[]);
      setQueue(visible.error ? [] : ((visible.data || []) as Req[]).filter((r) => isAwaitingUser(r, me.userId, me.role)));
      setVouchers(pv.error ? [] : ((pv.data || []) as Pv[]).filter((v) => String(v.status || "").startsWith("Pending")));
      setUnread(count);
      setNewest(list.items[0]?.createdAt || null);
      setActs(history.error ? [] : ((history.data || []) as Array<{ item_id: string; item_no: string | null; title: string | null; action_type: string | null; acted_at: string | null }>).map((h, i) => ({
        id: `${h.item_id}-${i}`, request_id: h.item_id, action_type: `${h.action_type || "Action"} · ${h.item_no || ""}`, comment: h.title, created_at: h.acted_at,
      })));
    };
    void load();
    const again = () => void load();
    window.addEventListener(APPROVAL_QUEUE_CHANGED_EVENT, again);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, again);
    return () => {
      alive = false;
      window.removeEventListener(APPROVAL_QUEUE_CHANGED_EVENT, again);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, again);
    };
  }, [me.ready, me.userId, me.role]);

  const allowed = (href: string) => me.ready && canAccessPath(href.split(/[?#]/)[0], me.roleSet);

  const open = useMemo(() => (mine || []).filter((r) => !isClosedRequest(r)), [mine]);
  const withDg = open.filter((r) => stageKey(r.current_stage) === "DG").length;
  const monthStart = now ? new Date(now.getFullYear(), now.getMonth(), 1).getTime() : 0;
  const approvedMonth = (mine || []).filter((r) => /approv|paid|complet/.test(String(r.status || "").toLowerCase()) && new Date(r.created_at || 0).getTime() >= monthStart);
  const waitingTotal = (queue?.length || 0) + (vouchers?.length || 0);

  const stats: StatItem[] = [
    { label: "Waiting for me", value: queue && vouchers ? waitingTotal : "…", note: `${queue?.length ?? 0} request${queue?.length === 1 ? "" : "s"} · ${vouchers?.length ?? 0} voucher${vouchers?.length === 1 ? "" : "s"}`, icon: "pen", tone: "brand", href: "/approvals" },
    { label: "My requests in progress", value: mine ? open.length : "…", note: withDg ? `${withDg} with the DG` : open.length ? "Moving through approval" : "Nothing in progress", icon: "file", tone: "blue", href: "/requests/mine" },
    { label: "Approved this month", value: mine ? approvedMonth.length : "…", note: nairaShort(approvedMonth.reduce((s, r) => s + Number(r.amount || 0), 0)), icon: "check", tone: "green" },
    { label: "Unread notifications", value: unread === null ? "—" : unread, note: newest ? `Newest ${timeAgo(newest)}` : "You are up to date", icon: "bell", tone: "amber", href: "/notifications" },
  ];

  const reqRows = (queue || []).map((r) => ({
    key: `r-${r.id}`,
    icon: "file",
    tone: "blue" as const,
    title: `${r.request_no || "Request"} · Approve as ${roleDisplayName(me.role)}`,
    sub: `${r.title || "Untitled"} · waiting ${waitedFor(r.created_at)}`,
    amount: r.amount,
    href: `/requests/${r.id}`,
    action: "Open",
    at: r.created_at || "",
  }));
  const pvRows = (vouchers || []).map((v) => ({
    key: `v-${v.id}`,
    icon: "pen",
    tone: "brand" as const,
    title: `${v.voucher_no || "Voucher"} · ${v.signing_stage || "Sign"}`,
    sub: `${v.payee_name || "Payee"} · waiting ${waitedFor(v.created_at)}`,
    amount: v.amount,
    href: `/approvals/vouchers/${v.id}`,
    action: "Sign",
    at: v.created_at || "",
  }));
  const waitingRows = (tab === "requests" ? reqRows : tab === "vouchers" ? pvRows : [...pvRows, ...reqRows].sort((a, b) => a.at.localeCompare(b.at))).slice(0, 6);

  const hour = now?.getHours() ?? 9;
  const dateText = now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  const fy = fyLabel(currentFyStart());

  return (
    <V4Page>
      <PageHead
        title={`${dayPart(hour).text}${firstNameOf(me.name) ? `, ${firstNameOf(me.name)}` : ""}`}
        icon={<DayIcon hour={hour} size={30} />}
        sub={<>{dateText}{dateText ? " · " : ""}Financial year {fy} · Here is what needs you today.</>}
        actions={[
          ...(allowed("/reports") ? [{ href: "/reports", label: "Reports", icon: "chart", kind: "secondary" as const }] : []),
          { href: "/requests/new", label: "New request", icon: "plus", kind: "primary" as const },
        ]}
      />
      <Stats items={stats} label="Today" />

      <div className="v4-cols">
        <Card title="Waiting for me" link={{ href: "/approvals", label: "Open Approvals" }}>
          <div style={{ padding: "0 12px" }}>
            <Tabs value={tab} onChange={setTab} label="Show" items={[
              { key: "all", label: "All", count: waitingTotal },
              { key: "requests", label: "Requests", count: queue?.length ?? 0 },
              { key: "vouchers", label: "Vouchers", count: vouchers?.length ?? 0 },
            ]} />
          </div>
          {queue === null || vouchers === null ? <Skeleton /> : waitingRows.length ? (
            <ul className="v4-rows">
              {waitingRows.map((r) => (
                <li key={r.key}>
                  <span className={`v4-ri v4-t-${r.tone}`}><Icon name={r.icon} /></span>
                  <span className="v4-rt"><strong>{r.title}</strong><span>{r.sub}</span></span>
                  <span className="v4-rr"><span className="v4-amt">{naira(r.amount)}</span><Btn small a={{ href: r.href, label: r.action, kind: "primary" }} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>Nothing is waiting for you right now.</p>}
          {waitingTotal > 6 ? <div style={{ padding: "12px 20px", borderTop: "1px solid var(--v4-line-2)" }}><Link href="/approvals">See all {waitingTotal} <Icon name="right" size="sm" /></Link></div> : null}
        </Card>

        <Card title="My requests" link={{ href: "/requests/mine", label: "All my requests" }}>
          {mine === null ? <Skeleton /> : mine.length ? (
            <ul className="v4-rows">
              {mine.slice(0, 4).map((r) => {
                const chip = statusChip(r.status, r.current_stage);
                const step = trackFor(r);
                const paid = /paid|complet/.test(String(r.status || "").toLowerCase());
                return (
                  <li key={r.id} style={{ display: "block" }}>
                    <Link href={`/requests/${r.id}`} style={{ color: "inherit", textDecoration: "none", display: "block" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <span className="v4-rt"><strong>{r.request_no || "Draft"} · {r.title || "Untitled"}</strong><span>{stageWords(r.current_stage)}</span></span>
                        <Chip tone={chip.tone}>{chip.label}</Chip>
                      </div>
                      <div className="v4-track" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i < step || (paid && i <= step) ? "v4-done" : i === step ? "v4-now" : undefined} />)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>You have not made a request yet.</p>}
        </Card>
      </div>

      <div className="v4-cols">
        <Card title="Shortcuts" pad>
          <div className="v4-minitiles">
            {SHORTCUTS.filter((s) => allowed(s.href)).slice(0, 6).map((s) => (
              <Link key={s.href} className="v4-minitile" href={s.href}><span className={`v4-ico v4-t-${s.tone}`}><Icon name={s.icon} /></span>{s.label}</Link>
            ))}
          </div>
          <p className="v4-help" style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--v4-muted)" }}>Only pages your position can open are shown here.</p>
        </Card>
        <Card title="Recent activity" pad link={{ href: "/profile/activity", label: "My Activity" }}>
          {acts === null ? <Skeleton /> : acts.length ? (
            <ul className="v4-timeline">
              {acts.map((a) => {
                const t = String(a.action_type || "").toLowerCase();
                const tone = /reject|return/.test(t) ? "red" : /approv|paid|complet/.test(t) ? "green" : /sign/.test(t) ? "brand" : "blue";
                return (
                  <li key={a.id}>
                    <span className={`v4-ti v4-t-${tone}`}><Icon name={/approv/.test(t) ? "check" : /reject|return/.test(t) ? "returned" : /sign/.test(t) ? "pen" : "activity"} /></span>
                    <span><strong>{a.action_type || "Action"}</strong><span>{a.comment || ""}</span></span>
                    <span className="v4-time">{timeAgo(a.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="v4-muted" style={{ margin: 0 }}>Your approvals, signatures and edits will appear here.</p>}
        </Card>
      </div>
    </V4Page>
  );
}
