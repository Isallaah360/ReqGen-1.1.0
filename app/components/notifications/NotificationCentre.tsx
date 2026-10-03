"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  // v3.1.3 pop-up notifications: only items that ARRIVE after ReqGen opens.
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<ReqGenNotification[]>([]);
  const [attention, setAttention] = useState<ReqGenNotification | null>(null);
  // Pop-ups render at the top level of the page (portal), so the top bar's
  // blur effect can never trap them; mounted guards server rendering.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [list, count] = await Promise.all([fetchNotifications(userId, { limit: 12 }), countUnread(userId)]);
    if (!list.error) {
      if (seen.current === null) {
        seen.current = new Set(list.items.map((n) => n.id)); // first load: no pop-ups for old items
      } else {
        const fresh = list.items.filter((n) => !n.isRead && !seen.current!.has(n.id));
        fresh.forEach((n) => seen.current!.add(n.id));
        if (fresh.length) {
          const needsAction = fresh.find((n) => n.kind === "awaiting" || n.kind === "reassigned");
          if (needsAction) setAttention((cur) => cur ?? needsAction);
          setToasts((cur) => [...fresh.filter((n) => n !== needsAction), ...cur].slice(0, 3));
        }
      }
    }
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

  useEffect(() => {
    if (!toasts.length) return;
    const t = window.setTimeout(() => setToasts((cur) => cur.slice(0, -1)), 8000);
    return () => window.clearTimeout(t);
  }, [toasts]);

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

      {mounted && toasts.length ? createPortal(
        <div className="rg-toast-stack" role="region" aria-label="New notifications">
          {toasts.map((n) => (
            <div key={n.id} className={`rg-toast is-${n.kind}`} role="status" aria-live="polite">
              <button type="button" className="rg-toast-body" onClick={() => { setToasts((c) => c.filter((x) => x.id !== n.id)); openItem(n); }}>
                <strong>{n.title}</strong>
                {n.message ? <span>{n.message}</span> : null}
              </button>
              <button type="button" className="rg-toast-close" aria-label="Dismiss notification" onClick={() => setToasts((c) => c.filter((x) => x.id !== n.id))}>×</button>
            </div>
          ))}
        </div>, document.body
      ) : null}

      {mounted && attention ? createPortal(
        <div className="rg-modal-backdrop rg-attention-backdrop" role="presentation">
          <section className="rg-attention" role="alertdialog" aria-modal="true" aria-labelledby="rg-attention-title" aria-describedby="rg-attention-msg">
            <span className="rg-attention-icon" aria-hidden="true"><Bell size={22} /></span>
            <h2 id="rg-attention-title">{attention.title}</h2>
            {attention.message ? <p id="rg-attention-msg">{attention.message}</p> : null}
            <div className="rg-attention-actions">
              <button type="button" className="rg-btn rg-btn-secondary" onClick={() => setAttention(null)}>OK</button>
              {safeLink(attention.link) ? (
                <button type="button" className="rg-btn rg-btn-primary" autoFocus onClick={() => { const n = attention; setAttention(null); openItem(n); }}>Open request</button>
              ) : null}
            </div>
          </section>
        </div>, document.body
      ) : null}
    </div>
  );
}
