"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, EmptyState, EnterpriseHero, EnterpriseShell, SectionCard, StatCard, StatusBadge } from "@/app/components/enterprise/EnterpriseUI";
import { dateText, normalizeRows, text, type GenericRow } from "@/app/components/enterprise/data";

type NotificationRow = { id: string; title: string; detail: string; link: string; read: boolean; createdAt: string };
type ApprovalRow = { id: string; requestNo: string; title: string; stage: string; status: string; createdAt: string };

export default function ActionCentrePage() {
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [updates, setUpdates] = useState<NotificationRow[]>([]);
  const [tab, setTab] = useState<"actions" | "updates">("actions");
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const [requestResult, notificationResult] = await Promise.all([
        supabase.from("requests").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(100),
      ]);
      const requestRows = normalizeRows(requestResult.data);
      const actionRows = requestRows.filter((row) => {
        const status = text(row.status).toLowerCase();
        const ownerValues = [row.current_owner_id, row.assigned_to, row.assigned_user_id, row.current_assignee_id].map(text);
        const assigned = ownerValues.includes(uid);
        return assigned && !["completed", "paid", "rejected", "cancelled", "deleted"].some((v) => status.includes(v));
      });
      setApprovals(actionRows.map((row) => ({
        id: text(row.id), requestNo: text(row.request_no, "Request"), title: text(row.title, "Untitled request"), stage: text(row.current_stage, "Pending"), status: text(row.status, "Pending"), createdAt: text(row.created_at),
      })));
      setUpdates(normalizeRows(notificationResult.data).map((row) => ({
        id: text(row.id), title: text(row.title, "Workflow update"), detail: text(row.body || row.message, "Open the related record for details."), link: text(row.link, "/dashboard"), read: Boolean(row.is_read), createdAt: text(row.created_at),
      })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("reqgen-action-centre-page").on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const unread = useMemo(() => updates.filter((item) => !item.read).length, [updates]);

  async function markRead(item: NotificationRow) {
    if (!userId || item.read) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", item.id).eq("user_id", userId);
    setUpdates((current) => current.map((row) => row.id === item.id ? { ...row, read: true } : row));
  }

  async function markAllRead() {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    setUpdates((current) => current.map((row) => ({ ...row, read: true })));
  }

  return <EnterpriseShell><div className="mx-auto max-w-[1400px] space-y-6">
    <EnterpriseHero eyebrow="ReqGen Productivity" title="Central Action Centre" description="One real-time workspace for requests waiting for your action and operational updates addressed to your account." actions={<><ActionButton tone="cyan" onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh"}</ActionButton><Link href="/approvals" className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-violet-800 to-purple-600 px-4 py-2.5 text-sm font-black text-white shadow-md">Open Approval Inbox</Link></>} />
    <section className="grid gap-4 sm:grid-cols-3"><StatCard label="Waiting for Action" value={approvals.length} note="Assigned records requiring attention" tone="amber" /><StatCard label="Unread Updates" value={unread} note="Workflow and system notifications" tone="rose" /><StatCard label="Recent Updates" value={updates.length} note="Latest notifications retained" tone="blue" /></section>
    <SectionCard title="My Action Workspace" eyebrow="Real-time operational queue" action={tab === "updates" && unread > 0 ? <ActionButton tone="emerald" onClick={() => void markAllRead()}>Mark All Read</ActionButton> : undefined}>
      <div className="mb-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setTab("actions")} className={`min-h-12 rounded-xl px-4 text-sm font-black text-white shadow-md ${tab === "actions" ? "bg-blue-700 ring-4 ring-blue-200" : "bg-slate-700"}`}>WAITING FOR ACTION ({approvals.length})</button><button type="button" onClick={() => setTab("updates")} className={`min-h-12 rounded-xl px-4 text-sm font-black text-white shadow-md ${tab === "updates" ? "bg-violet-700 ring-4 ring-violet-200" : "bg-slate-700"}`}>RECENT UPDATES ({unread} UNREAD)</button></div>
      {tab === "actions" ? (approvals.length === 0 ? <EmptyState title="No pending action" description="There is no request currently assigned to your account." /> : <div className="space-y-3">{approvals.map((item) => <Link href={`/requests/${item.id}`} key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="font-black text-slate-950">{item.requestNo} · {item.title}</div><div className="mt-1 text-sm font-semibold text-slate-600">Stage: {item.stage} · {dateText(item.createdAt)}</div></div><StatusBadge tone="amber">{item.status}</StatusBadge></Link>)}</div>) : (updates.length === 0 ? <EmptyState title="No recent update" description="Notifications addressed to your account will appear here." /> : <div className="space-y-3">{updates.map((item) => <Link onClick={() => void markRead(item)} href={item.link || "/dashboard"} key={item.id} className={`block rounded-2xl border p-4 transition hover:shadow-md ${item.read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}><div className="flex items-start justify-between gap-3"><div><div className="font-black text-slate-950">{item.title}</div><p className="mt-1 text-sm font-semibold text-slate-600">{item.detail}</p><p className="mt-2 text-xs font-bold text-slate-400">{dateText(item.createdAt)}</p></div><StatusBadge tone={item.read ? "slate" : "blue"}>{item.read ? "Read" : "Unread"}</StatusBadge></div></Link>)}</div>)}
    </SectionCard>
  </div></EnterpriseShell>;
}
