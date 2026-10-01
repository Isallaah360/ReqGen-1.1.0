import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen Notification Centre — data layer (v3.0.7).
 * Reads the user's OWN rows from public.notifications, which the database
 * workflow writes at every step (submitted, approved, rejected, reassigned…).
 * Older rows used "body", newer ones "message"; both are supported.
 */
export type NotificationKind = "approved" | "rejected" | "returned" | "reassigned" | "awaiting" | "paid" | "info";

export type ReqGenNotification = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string | null;
  kind: NotificationKind;
};

type Row = {
  id: string | number;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  link?: string | null;
  is_read?: boolean | null;
  read_at?: string | null;
  created_at?: string | null;
};

export const NOTIFICATIONS_CHANGED_EVENT = "reqgen-notifications-changed";

export function kindOf(title: string, message: string): NotificationKind {
  const t = `${title} ${message}`.toLowerCase();
  if (/reject|declin/.test(t)) return "rejected";
  if (/return|query|correction/.test(t)) return "returned";
  if (/reassign|acting|away/.test(t)) return "reassigned";
  if (/paid|payment|voucher|disburs/.test(t)) return "paid";
  if (/await|pending|requires your|for your (approval|action)|assigned to you|new request/.test(t)) return "awaiting";
  if (/approv|complet|success/.test(t)) return "approved";
  return "info";
}

function normalise(row: Row): ReqGenNotification {
  const title = String(row.title || "ReqGen notification").trim();
  const message = String(row.message ?? row.body ?? "").trim();
  return {
    id: String(row.id),
    title,
    message,
    link: row.link ? String(row.link) : null,
    isRead: Boolean(row.is_read) || Boolean(row.read_at),
    createdAt: row.created_at || null,
    kind: kindOf(title, message),
  };
}

/** Only allow in-app links (never open an external address from a notification). */
export function safeLink(link: string | null) {
  if (!link) return null;
  return link.startsWith("/") && !link.startsWith("//") ? link : null;
}

export async function fetchNotifications(userId: string, opts: { limit?: number; unreadOnly?: boolean } = {}) {
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 30);
  if (opts.unreadOnly) query = query.eq("is_read", false);
  const { data, error } = await query;
  if (error) return { items: [] as ReqGenNotification[], error: error.message };
  return { items: ((data || []) as Row[]).map(normalise), error: null as string | null };
}

export async function countUnread(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return error ? null : count ?? 0;
}

/** Mark specific notifications read, or all of the user's when ids is omitted. */
export async function markNotificationsRead(ids?: string[]) {
  const rpc = await supabase.rpc("reqgen_mark_notifications_read", { p_ids: ids && ids.length ? ids : null });
  if (rpc.error) {
    // Fallback before v3_0_7_notifications.sql has run: direct update of own rows.
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    let q = supabase.from("notifications").update({ is_read: true }).eq("user_id", auth.user.id);
    if (ids && ids.length) q = q.in("id", ids);
    await q;
  }
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function timeAgo(iso: string | null) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
