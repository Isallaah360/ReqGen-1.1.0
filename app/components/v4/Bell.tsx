"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import {
  NOTIFICATIONS_CHANGED_EVENT, countUnread, fetchNotifications, markNotificationsRead, safeLink, timeAgo,
  type NotificationKind, type ReqGenNotification,
} from "@/lib/notifications";
import type { Tone } from "@/lib/v4/modules";
import Icon from "./Icon";

export const KIND_LOOK: Record<NotificationKind, { icon: string; tone: Tone }> = {
  approved: { icon: "check", tone: "green" },
  rejected: { icon: "x", tone: "red" },
  returned: { icon: "returned", tone: "amber" },
  reassigned: { icon: "shuffle", tone: "blue" },
  awaiting: { icon: "pen", tone: "brand" },
  paid: { icon: "wallet", tone: "blue" },
  info: { icon: "info", tone: "blue" },
};

/** One notification line, shared by the bell panel and the Notifications page. */
export function NoticeLine({ n, onOpen }: { n: ReqGenNotification; onOpen: (n: ReqGenNotification) => void }) {
  const look = KIND_LOOK[n.kind];
  return (
    <li className={n.isRead ? undefined : "v4-unread"}>
      <button type="button" className="v4-row-link" onClick={() => onOpen(n)}>
        <span className={`v4-ri v4-t-${look.tone}`}><Icon name={look.icon} /></span>
        <span className="v4-rt"><strong>{n.title}</strong>{n.message ? <span>{n.message}</span> : null}</span>
        <span className="v4-rr"><span className="v4-time">{timeAgo(n.createdAt)}</span></span>
      </button>
    </li>
  );
}

/**
 * Top-bar bell (v4). Unread count, the panel of recent alerts, pop-up toasts
 * for alerts that arrive while ReqGen is open, and an attention dialog for
 * anything that needs the person's action. Realtime with a 60-second safety
 * poll, exactly as in v3.
 */
export default function Bell({ userId, pendingApprovalCount, onUnread }: { userId: string | null; pendingApprovalCount: number; onUnread?: (n: number) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReqGenNotification[]>([]);
  const [unread, setUnread] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<ReqGenNotification[]>([]);
  const [attention, setAttention] = useState<ReqGenNotification | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [list, count] = await Promise.all([fetchNotifications(userId, { limit: 12 }), countUnread(userId)]);
    if (!list.error) {
      if (seen.current === null) {
        seen.current = new Set(list.items.map((n) => n.id));
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

  useEffect(() => { onUnread?.(unread ?? 0); }, [unread, onUnread]);

  useEffect(() => {
    if (!userId) return;
    const schedule = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { void refresh(); }, 300);
    };
    queueMicrotask(() => { void refresh(); });
    const channel = supabase
      .channel(`reqgen-v4-notifications-${userId}`)
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

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const badge = unread === null ? pendingApprovalCount : unread;
  const label = unread === null
    ? `Notifications, ${pendingApprovalCount} awaiting your approval`
    : `Notifications, ${unread} unread`;

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
    <div className="v4-topwrap" ref={wrapRef}>
      <button
        type="button"
        className="v4-icon-btn"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); if (!open) { setLoading(items.length === 0); void refresh(); } }}
      >
        <Icon name="bell" />
        {badge > 0 ? <span className="v4-dot">{badge > 99 ? "99+" : badge}</span> : null}
      </button>

      {mounted && open ? createPortal(
        <div className="v4-ui v4-bell-panel v4-show" role="dialog" aria-label="Notifications" ref={panelRef}>
          <header>
            <strong>Notifications {unread ? <span className="v4-count">{unread}</span> : null}</strong>
            {unread ? <button type="button" className="v4-btn v4-btn-ghost" style={{ minHeight: 32, padding: "0 10px", fontSize: 13 }} onClick={markAll}>Mark all read</button> : null}
          </header>
          {pendingApprovalCount ? (
            <ul className="v4-rows">
              <li>
                <Link href="/approvals" className="v4-row-link" onClick={() => setOpen(false)}>
                  <span className="v4-ri v4-t-brand"><Icon name="audit" /></span>
                  <span className="v4-rt"><strong>{pendingApprovalCount} waiting for your action</strong><span>Open Approvals</span></span>
                </Link>
              </li>
            </ul>
          ) : null}
          <ul className="v4-rows">
            {loading ? <li><span className="v4-muted">Loading…</span></li> : null}
            {!loading && items.length === 0 ? <li><span className="v4-muted">No notifications yet. Updates on your requests and vouchers will appear here.</span></li> : null}
            {items.map((n) => <NoticeLine key={n.id} n={n} onOpen={openItem} />)}
          </ul>
          <footer><Link href="/notifications" onClick={() => setOpen(false)}>Open all notifications <Icon name="right" size="sm" /></Link></footer>
        </div>, document.body
      ) : null}

      {mounted && toasts.length ? createPortal(
        <div className="v4-toast-dock" role="region" aria-label="New notifications">
          {toasts.map((n) => (
            <div key={n.id} className="v4-toast" role="status" aria-live="polite">
              <span className="v4-ico" style={{ background: "#B83E00" }}><Icon name="bell" /></span>
              <span style={{ flex: 1 }}>
                <strong>{n.title}</strong>
                {n.message ? <span>{n.message}</span> : null}
                <button type="button" onClick={() => { setToasts((c) => c.filter((x) => x.id !== n.id)); openItem(n); }} style={{ display: "block", marginTop: 6, padding: 0, border: 0, background: "none", color: "#F7B48A", fontWeight: 700, cursor: "pointer" }}>Open</button>
              </span>
              <button type="button" aria-label="Dismiss" onClick={() => setToasts((c) => c.filter((x) => x.id !== n.id))} style={{ border: 0, background: "none", color: "#D7DCE6", fontSize: 20, lineHeight: 1, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>, document.body
      ) : null}

      {mounted && attention ? createPortal(
        <div className="v4-ui v4-attention" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-labelledby="v4-attention-title">
            <span className="v4-ico v4-t-brand"><Icon name="bell" /></span>
            <h2 id="v4-attention-title">{attention.title}</h2>
            {attention.message ? <p>{attention.message}</p> : null}
            <div className="v4-btns">
              <button type="button" className="v4-btn v4-btn-secondary" onClick={() => setAttention(null)}>Later</button>
              {safeLink(attention.link) ? (
                <button type="button" className="v4-btn v4-btn-primary" autoFocus onClick={() => { const n = attention; setAttention(null); openItem(n); }}>Open now</button>
              ) : null}
            </div>
          </section>
        </div>, document.body
      ) : null}
    </div>
  );
}
