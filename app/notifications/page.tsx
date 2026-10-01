"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { NotificationRow } from "@/app/components/notifications/NotificationCentre";
import {
  NOTIFICATIONS_CHANGED_EVENT, fetchNotifications, markNotificationsRead, safeLink, type ReqGenNotification,
} from "@/lib/notifications";

/** Notifications (v3.0.7): every workflow update addressed to the signed-in user. */
export default function NotificationsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ReqGenNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (uid: string, max: number) => {
    const res = await fetchNotifications(uid, { limit: max });
    setItems(res.items);
    setError(res.error ? "Notifications are not available yet. Ask Admin to run the v3.0.7 database update." : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (!data.user) { router.replace("/login?next=/notifications"); return; }
      setUserId(data.user.id);
    });
    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    queueMicrotask(() => { void load(userId, limit); });
    const again = () => { void load(userId, limit); };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, again);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, again);
  }, [userId, limit, load]);

  const shown = useMemo(() => (filter === "unread" ? items.filter((n) => !n.isRead) : items), [items, filter]);
  const unread = items.filter((n) => !n.isRead).length;

  const open = (n: ReqGenNotification) => {
    if (!n.isRead) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      void markNotificationsRead([n.id]);
    }
    const href = safeLink(n.link);
    if (href) router.push(href);
  };

  return (
    <main className="rg-notif-page">
      <header className="rg-page-head">
        <div>
          <h1>Notifications</h1>
          <p>Every update on requests you created or that were routed to you. Select one to open it.</p>
        </div>
        <div className="rg-page-actions">
          <button type="button" className="rg-btn rg-btn-secondary" disabled={!unread}
            onClick={() => { setItems((l) => l.map((x) => ({ ...x, isRead: true }))); void markNotificationsRead(); }}>
            <CheckCheck size={16} /> Mark all read
          </button>
        </div>
      </header>

      <nav data-rg-tabs="true" role="tablist" aria-label="Notification filter" className="mt-4">
        <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All ({items.length})</button>
        <button type="button" role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "is-active" : ""} onClick={() => setFilter("unread")}>Unread ({unread})</button>
      </nav>

      {error ? <div className="rg-alert is-error" role="status">{error}</div> : null}

      <section className="rg-notif-pagelist" aria-busy={loading}>
        {loading ? <p className="rg-notif-empty">Loading notifications…</p> : null}
        {!loading && !shown.length ? <p className="rg-notif-empty">{filter === "unread" ? "You have no unread notifications." : "No notifications yet."}</p> : null}
        {shown.map((n) => <NotificationRow key={n.id} n={n} onOpen={open} />)}
      </section>

      {items.length >= limit ? (
        <div className="rg-page-actions" style={{ justifyContent: "center", marginTop: 14 }}>
          <button type="button" className="rg-btn rg-btn-secondary" onClick={() => setLimit((l) => l + 50)}>Load older notifications</button>
        </div>
      ) : null}
    </main>
  );
}
