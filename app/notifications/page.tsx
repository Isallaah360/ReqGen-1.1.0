"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  NOTIFICATIONS_CHANGED_EVENT, fetchNotifications, markNotificationsRead, safeLink, type ReqGenNotification,
} from "@/lib/notifications";
import { NoticeLine } from "@/app/components/v4/Bell";
import { Card, Notice, PageHead, Skeleton, Tabs, V4Page } from "@/app/components/v4/ui";

type Filter = "all" | "action" | "updates" | "unread";

function dayGroup(iso: string | null) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "Earlier";
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const t = d.getTime();
  if (t >= start.getTime()) return "Today";
  if (t >= start.getTime() - 86_400_000) return "Yesterday";
  if (t >= start.getTime() - 6 * 86_400_000) return "Earlier this week";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

const needsAction = (n: ReqGenNotification) => n.kind === "awaiting" || n.kind === "reassigned" || n.kind === "returned";

/** Notifications (v4.0.0): everything ReqGen told you, newest first. */
export default function NotificationsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ReqGenNotification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (uid: string, max: number) => {
    const res = await fetchNotifications(uid, { limit: max });
    setItems(res.items);
    setError(res.error ? "Notifications could not be loaded. Please refresh the page." : null);
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

  const counts = useMemo(() => ({
    all: items.length,
    action: items.filter(needsAction).length,
    updates: items.filter((n) => !needsAction(n)).length,
    unread: items.filter((n) => !n.isRead).length,
  }), [items]);

  const shown = useMemo(() => items.filter((n) =>
    filter === "unread" ? !n.isRead : filter === "action" ? needsAction(n) : filter === "updates" ? !needsAction(n) : true), [items, filter]);

  const groups = useMemo(() => {
    const out: Array<{ label: string; rows: ReqGenNotification[] }> = [];
    for (const n of shown) {
      const label = dayGroup(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(n); else out.push({ label, rows: [n] });
    }
    return out;
  }, [shown]);

  const open = (n: ReqGenNotification) => {
    if (!n.isRead) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      void markNotificationsRead([n.id]);
    }
    const href = safeLink(n.link);
    if (href) router.push(href);
  };

  return (
    <V4Page>
      <PageHead
        title="Notifications"
        sub="Everything ReqGen told you, newest first. Select one to open the request or voucher."
        actions={[{ label: "Mark all as read", icon: "checkall", kind: "secondary", disabled: !counts.unread, onClick: () => { setItems((l) => l.map((x) => ({ ...x, isRead: true }))); void markNotificationsRead(); } }]}
      />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={filter} onChange={setFilter} label="Show" items={[
            { key: "all", label: "All", count: counts.all },
            { key: "action", label: "Needs action", count: counts.action },
            { key: "updates", label: "Updates", count: counts.updates },
            { key: "unread", label: "Unread", count: counts.unread },
          ]} />
        </div>
        {loading ? <Skeleton lines={5} /> : null}
        {!loading && !shown.length ? (
          <p className="v4-muted" style={{ padding: "20px", margin: 0 }}>
            {filter === "unread" ? "You have no unread notifications." : filter === "action" ? "Nothing needs your action." : "No notifications yet. Updates on your requests and vouchers will appear here."}
          </p>
        ) : null}
        {groups.map((g) => (
          <div key={g.label}>
            <div className="v4-day">{g.label}</div>
            <ul className="v4-rows">{g.rows.map((n) => <NoticeLine key={n.id} n={n} onOpen={open} />)}</ul>
          </div>
        ))}
        {items.length >= limit ? (
          <div style={{ padding: "14px 20px", textAlign: "center", borderTop: "1px solid var(--v4-line-2)" }}>
            <button className="v4-btn v4-btn-secondary" type="button" onClick={() => setLimit((l) => l + 50)}>Load older notifications</button>
          </div>
        ) : null}
      </Card>
    </V4Page>
  );
}
