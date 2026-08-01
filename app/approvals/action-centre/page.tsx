"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ActionButton,
  EmptyState,
  EnterpriseHero,
  EnterpriseShell,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/app/components/enterprise/EnterpriseUI";
import {
  dateText,
  normalizeRows,
  text,
} from "@/app/components/enterprise/data";

type NotificationRow = {
  id: string;
  title: string;
  detail: string;
  link: string;
  read: boolean;
  createdAt: string;
};

type ApprovalRow = {
  id: string;
  requestNo: string;
  title: string;
  stage: string;
  status: string;
  createdAt: string;
};

type ActionTab = "actions" | "updates" | "priority";

const CLOSED_STATUSES = [
  "completed",
  "paid",
  "rejected",
  "cancelled",
  "deleted",
];

export default function ActionCentrePage() {
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [updates, setUpdates] = useState<NotificationRow[]>([]);
  const [tab, setTab] = useState<ActionTab>("actions");
  const [userId, setUserId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setWarning(null);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      const uid = authData.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setApprovals([]);
        setUpdates([]);
        setWarning("Your session could not be verified. Please sign in again.");
        return;
      }

      const [requestResult, notificationResult] = await Promise.all([
        supabase
          .from("requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (requestResult.error) {
        console.error(
          "Unable to load requests for Action Centre:",
          requestResult.error
        );
      }

      if (notificationResult.error) {
        console.error(
          "Unable to load notifications for Action Centre:",
          notificationResult.error
        );
      }

      if (requestResult.error || notificationResult.error) {
        setWarning(
          "Some Action Centre records could not be loaded. Available records are still displayed."
        );
      }

      const requestRows = normalizeRows(requestResult.data);

      const actionRows = requestRows.filter((row) => {
        const status = text(row.status).toLowerCase();

        const ownerValues = [
          row.current_owner_id,
          row.assigned_to,
          row.assigned_user_id,
          row.current_assignee_id,
        ]
          .map((value) => text(value))
          .filter(Boolean);

        const assignedToCurrentUser = ownerValues.includes(uid);
        const isClosed = CLOSED_STATUSES.some((closedStatus) =>
          status.includes(closedStatus)
        );

        return assignedToCurrentUser && !isClosed;
      });

      setApprovals(
        actionRows.map((row) => ({
          id: text(row.id),
          requestNo: text(row.request_no, "Request"),
          title: text(row.title, "Untitled request"),
          stage: text(row.current_stage, "Pending"),
          status: text(row.status, "Pending"),
          createdAt: text(row.created_at),
        }))
      );

      setUpdates(
        normalizeRows(notificationResult.data).map((row) => ({
          id: text(row.id),
          title: text(row.title, "Workflow update"),
          detail: text(
            text(row.body) || text(row.message),
            "Open the related record for details."
          ),
          link: text(row.link, "/dashboard"),
          read: Boolean(row.is_read),
          createdAt: text(row.created_at),
        }))
      );
    } catch (error) {
      console.error("Unable to load Action Centre:", error);
      setApprovals([]);
      setUpdates([]);
      setWarning("Unable to load the Action Centre at this time.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("reqgen-action-centre-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => void load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const unread = useMemo(() => updates.filter((item) => !item.read).length, [updates]);
  const priorityApprovals = useMemo(() => approvals.filter((item) => /urgent|high|overdue/i.test(`${item.status} ${item.stage}`)), [approvals]);
  const visibleApprovals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = tab === "priority" ? priorityApprovals : approvals;
    return q ? source.filter((item) => [item.requestNo,item.title,item.stage,item.status].join(" ").toLowerCase().includes(q)) : source;
  }, [approvals, priorityApprovals, search, tab]);

  async function markRead(item: NotificationRow) {
    if (!userId || item.read) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", item.id)
      .eq("user_id", userId);

    if (error) {
      console.error("Unable to mark notification as read:", error);
      setWarning("The notification could not be marked as read.");
      return;
    }

    setUpdates((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, read: true } : row
      )
    );
  }

  async function markAllRead() {
    if (!userId) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("Unable to mark all notifications as read:", error);
      setWarning("Notifications could not be marked as read.");
      return;
    }

    setUpdates((current) =>
      current.map((row) => ({ ...row, read: true }))
    );
  }

  return (
    <EnterpriseShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <EnterpriseHero
          eyebrow="ReqGen Productivity"
          title="Central Action Centre"
          description="One real-time workspace for requests waiting for your action and operational updates addressed to your account."
          actions={
            <>
              <ActionButton tone="cyan" onClick={() => void load()}>
                {loading ? "Refreshing..." : "Refresh"}
              </ActionButton>

              <Link
                href="/approvals"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-violet-800 to-purple-600 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-violet-200"
              >
                Open Approval Inbox
              </Link>
            </>
          }
        />

        <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Action Centre navigation">
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/approvals/action-centre" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-md ring-4 ring-violet-100 transition hover:-translate-y-0.5 hover:shadow-lg">
              Action Centre
            </Link>
            <Link href="/approvals" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-700 to-cyan-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
              Approvals Inbox
            </Link>
            <Link href="/dashboard" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
              Main Dashboard
            </Link>
          </div>
        </section>

        {warning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            {warning}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Waiting for Action"
            value={loading ? "—" : approvals.length}
            note="Assigned records requiring attention"
            tone="amber"
          />
          <StatCard
            label="Unread Updates"
            value={loading ? "—" : unread}
            note="Workflow and system notifications"
            tone="rose"
          />
          <StatCard
            label="Recent Updates"
            value={loading ? "—" : updates.length}
            note="Latest notifications retained"
            tone="blue"
          />
        </section>

        <SectionCard
          title="My Action Workspace"
          eyebrow="Real-time operational queue"
          action={
            tab === "updates" && unread > 0 ? (
              <ActionButton
                tone="emerald"
                onClick={() => void markAllRead()}
              >
                Mark All Read
              </ActionButton>
            ) : undefined
          }
        >
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setTab("actions")}
              className={`min-h-12 rounded-xl px-4 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                tab === "actions"
                  ? "bg-blue-700 ring-4 ring-blue-200"
                  : "bg-slate-700 hover:bg-slate-800"
              }`}
            >
              WAITING FOR ACTION ({approvals.length})
            </button>

            <button
              type="button"
              onClick={() => setTab("updates")}
              className={`min-h-12 rounded-xl px-4 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-violet-200 ${
                tab === "updates"
                  ? "bg-violet-700 ring-4 ring-violet-200"
                  : "bg-slate-700 hover:bg-slate-800"
              }`}
            >
              RECENT UPDATES ({unread} UNREAD)
            </button>
            <button
              type="button"
              onClick={() => setTab("priority")}
              className={`min-h-12 rounded-xl px-4 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-rose-200 ${
                tab === "priority"
                  ? "bg-rose-700 ring-4 ring-rose-200"
                  : "bg-slate-700 hover:bg-slate-800"
              }`}
            >
              PRIORITY ACTIONS ({priorityApprovals.length})
            </button>

          </div>


          {tab !== "updates" ? <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search request number, title, stage or status..." className="mb-5 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /> : null}
          {tab === "actions" || tab === "priority" ? (
            visibleApprovals.length === 0 ? (
              <EmptyState
                title={loading ? "Loading action queue" : "No pending action"}
                description={
                  loading
                    ? "Please wait while ReqGen checks your assignments."
                    : "There is no request currently assigned to your account."
                }
              />
            ) : (
              <div className="space-y-3">
                {visibleApprovals.map((item) => (
                  <Link
                    href={`/requests/${item.id}`}
                    key={item.id}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <div className="font-black text-slate-950">
                        {item.requestNo} · {item.title}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">
                        Stage: {item.stage} · {dateText(item.createdAt)}
                      </div>
                    </div>
                    <StatusBadge tone="amber">{item.status}</StatusBadge>
                  </Link>
                ))}
              </div>
            )
          ) : updates.length === 0 ? (
            <EmptyState
              title={loading ? "Loading updates" : "No recent update"}
              description={
                loading
                  ? "Please wait while ReqGen checks your notifications."
                  : "Notifications addressed to your account will appear here."
              }
            />
          ) : (
            <div className="space-y-3">
              {updates.map((item) => (
                <Link
                  onClick={() => void markRead(item)}
                  href={item.link || "/dashboard"}
                  key={item.id}
                  className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                    item.read
                      ? "border-slate-200 bg-white"
                      : "border-blue-200 bg-blue-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-950">
                        {item.title}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {item.detail}
                      </p>
                      <p className="mt-2 text-xs font-bold text-slate-400">
                        {dateText(item.createdAt)}
                      </p>
                    </div>
                    <StatusBadge tone={item.read ? "slate" : "blue"}>
                      {item.read ? "Read" : "Unread"}
                    </StatusBadge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </EnterpriseShell>
  );
}
