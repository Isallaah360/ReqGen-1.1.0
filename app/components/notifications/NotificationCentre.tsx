"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, CheckCircle2, ClipboardCheck, Info, RotateCcw, Shuffle, Wallet, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  NOTIFICATIONS_CHANGED_EVENT, countUnread, fetchNotifications, markNotificationsRead, safeLink, timeAgo,
  type NotificationKind, type ReqGenNotification,
} from "@/lib/notifications";

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  approved: CheckCircle2, rejected: XCircle, returned: RotateCcw, reassigned: Shuffle,
  awaiting: ClipboardCheck, paid: Wallet, info: Info,
};

/** One notification row — shared by the bell panel and the Notifications page. */
export function NotificationRow({ n, onOpen }: { n: ReqGenNotification; onOpen: (n: ReqGenNotification) => void }) {
  const Icon = KIND_ICON[n.kind];
  return (
    <button type="button" className={`rg-notif-row is-${n.kind} ${n.isRead ? "" : "is-unread"}`} onClick={() => onOpen(n)}>
      <span className="rg-notif-icon" aria-hidden="true"><Icon size={17} /></span>
      <span className="rg-notif-text">
        <strong>{n.title}</strong>
        {n.message ? <span>{n.message}</span> : null}
        <small>{timeAgo(n.createdAt)}{n.isRead ? "" : " · Unread"}</small>
      </span>
      {n.isRead ? null : <i className="rg-notif-dot" aria-label="Unread" />}
    </button>
  );
}

/**
 * Top-bar bell with the Notification Centre panel (v3.0.7).
 * Badge = the user's unread notifications. If the notifications table is not
 * readable yet (before v3_0_7_notifications.sql), it falls back to the number
 * of requests awaiting the user's action, as before.
 */
export default function NotificationCentre({ userId, pendingApprovalCount }: { userId: string | null; pendingApprovalCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReqGenNotification[]>([]);
  const [unread, setUnread] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [list, count] = await Promise.all([fetchNotifications(userId, { limit: 12 }), countUnread(userId)]);
    setItems(list.items);
    setUnread(list.error ? null : count);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const schedule = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { void refresh(); }, 300);
    };
    queueMicrotask(() => { void refresh(); });
    const channel = supabase
      .channel(`reqgen-notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, schedule)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") schedule(); };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, schedule);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", onVisible);
    const poll = window.setInterval(schedule, 60_000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      window.clearInterval(poll);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, schedule);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const badge = unread === null ? pendingApprovalCount : unread;
  const label = unread === null
    ? `${pendingApprovalCount} request${pendingApprovalCount === 1 ? "" : "s"} awaiting your approval`
    : `${unread} unread notification${unread === 1 ? "" : "s"}`;

  const openItem = (n: ReqGenNotification) => {
    if (!n.isRead) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((u) => (u === null ? u : Math.max(0, u - 1)));
      void markNotificationsRead([n.id]);
    }
    const href = safeLink(n.link);
    setOpen(false);
    if (href) router.push(href);
  };

  const markAll = () => {
    setItems((list) => list.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    void markNotificationsRead();
  };

  return (
    <div className="rg-notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="rg-icon-btn rg-bell"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); if (!open) { setLoading(items.length === 0); void refresh(); } }}
      >
        <Bell size={20} />
        {badge > 0 ? <b>{badge > 99 ? "99+" : badge}</b> : null}
      </button>

      {open ? (
        <section className="rg-notif-panel" role="dialog" aria-label="Notifications">
          <header className="rg-notif-head">
            <h2>Notifications</h2>
            {unread ? (
              <button type="button" className="rg-notif-link" onClick={markAll}><CheckCheck size={15} /> Mark all read</button>
            ) : null}
          </header>

          <Link href="/approvals" className={`rg-notif-action ${pendingApprovalCount ? "has-items" : ""}`} onClick={() => setOpen(false)}>
            <ClipboardCheck size={18} aria-hidden="true" />
            <span>
              <strong>{pendingApprovalCount ? `${pendingApprovalCount} awaiting your action` : "Nothing awaiting your action"}</strong>
              <small>{pendingApprovalCount ? "Open Approvals" : "You are up to date"}</small>
            </span>
          </Link>

          <div className="rg-notif-list">
            {loading ? <p className="rg-notif-empty">Loading…</p> : null}
            {!loading && items.length === 0 ? <p className="rg-notif-empty">No notifications yet. Workflow updates will appear here.</p> : null}
            {items.map((n) => <NotificationRow key={n.id} n={n} onOpen={openItem} />)}
          </div>

          <footer className="rg-notif-foot">
            <Link href="/notifications" onClick={() => setOpen(false)}>View all notifications</Link>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
