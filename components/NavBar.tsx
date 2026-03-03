"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type Notif = { id: string; title: string; link: string | null; is_read: boolean; created_at: string };

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [openBell, setOpenBell] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  async function refreshRoleAndNotifs() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      setSignedIn(false);
      setIsAdmin(false);
      setUserId(null);
      setUnreadCount(0);
      setItems([]);
      return;
    }

    setSignedIn(true);
    setUserId(user.id);

    // role
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    setIsAdmin((prof?.role || "") === "Admin");

    // notifications
    const { data: n } = await supabase
      .from("notifications")
      .select("id,title,link,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    setItems((n || []) as Notif[]);
    setUnreadCount((n || []).filter((x: any) => !x.is_read).length);
  }

  useEffect(() => {
    refreshRoleAndNotifs();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshRoleAndNotifs();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Auto refresh using realtime (fast + modern)
  useEffect(() => {
    if (!userId) return;

    const ch = supabase
      .channel("notif-ch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => refreshRoleAndNotifs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function markAllRead() {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    setOpenBell(false);
    await refreshRoleAndNotifs();
  }

  async function openNotif(n: Notif) {
    // mark as read (single)
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    setOpenBell(false);
    if (n.link) router.push(n.link);
    else router.push("/approvals");
  }

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-xl text-sm font-semibold transition ${
      pathname === href ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-extrabold text-lg tracking-tight text-slate-900">
          ReqGen <span className="text-slate-400">1.1.0</span>
        </Link>

        {signedIn ? (
          <nav className="flex items-center gap-2 relative">
            <Link className={linkClass("/approvals")} href="/approvals">
              Approvals
            </Link>
            <Link className={linkClass("/dashboard")} href="/dashboard">
              Dashboard
            </Link>
            <Link className={linkClass("/requests")} href="/requests">
              My Requests
            </Link>
            <Link className={linkClass("/requests/new")} href="/requests/new">
              New Request
            </Link>

            {isAdmin && (
              <Link className={linkClass("/admin")} href="/admin">
                Admin
              </Link>
            )}

            {/* 🔔 Notification Bell */}
            <button
              onClick={() => setOpenBell((v) => !v)}
              className="ml-2 relative rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {openBell && (
              <div className="absolute right-0 top-12 w-80 rounded-2xl border bg-white shadow-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                  <div className="font-bold text-slate-900">Notifications</div>
                  <button onClick={markAllRead} className="text-xs font-semibold text-blue-700 hover:underline">
                    Mark all read
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="p-4 text-sm text-slate-600">No notifications.</div>
                ) : (
                  <div className="max-h-96 overflow-auto">
                    {items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => openNotif(n)}
                        className={`w-full text-left px-4 py-3 border-t hover:bg-slate-50 ${
                          n.is_read ? "bg-white" : "bg-blue-50"
                        }`}
                      >
                        <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                        <div className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={logout}
              className="ml-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
            >
              Logout
            </button>
          </nav>
        ) : (
          <div />
        )}
      </div>
    </header>
  );
}