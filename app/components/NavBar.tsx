"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Notif = {
  id: string;
  title: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "") // "Account Officer" -> "accountofficer"
    .replace(/_/g, ""); // "account_officer" -> "accountofficer"
}

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const [signedIn, setSignedIn] = useState(false);

  // roles
  const [myRole, setMyRole] = useState<string>("Staff");
  const rk = roleKey(myRole);

  const isAdmin = rk === "admin";

  // ✅ Finance allowed ONLY for Admin, Auditor, Accounts
  const canFinance = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);

  // notifications
  const [openBell, setOpenBell] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // mobile menu
  const [openMenu, setOpenMenu] = useState(false);

  const bellRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const links = useMemo(() => {
    const base = [
      { href: "/approvals", label: "Approvals" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/requests", label: "My Requests" },
      { href: "/requests/new", label: "New Request" },
    ];

    if (canFinance) base.push({ href: "/finance/subheads", label: "Finance" });
    if (isAdmin) base.push({ href: "/admin", label: "Admin" });

    return base;
  }, [canFinance, isAdmin]);

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-xl text-sm font-semibold transition ${
      pathname === href ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
    }`;

  async function refreshAll() {
    const { data: sess, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !sess.session?.user) {
      setSignedIn(false);
      setUserId(null);
      setMyRole("Staff");
      setUnreadCount(0);
      setItems([]);
      return;
    }

    const uid = sess.session.user.id;
    setSignedIn(true);
    setUserId(uid);

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();

    if (!profErr && prof?.role) setMyRole(prof.role);
    else setMyRole("Staff");

    const { data: n } = await supabase
      .from("notifications")
      .select("id,title,link,is_read,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(8);

    const list = (n || []) as Notif[];
    setItems(list);
    setUnreadCount(list.filter((x) => !x.is_read).length);
  }

  useEffect(() => {
    refreshAll();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setOpenBell(false);
      setOpenMenu(false);
      refreshAll();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;

    const ch = supabase
      .channel("notif-ch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => refreshAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    setOpenBell(false);
    setOpenMenu(false);
  }, [pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (openBell && bellRef.current && !bellRef.current.contains(t)) setOpenBell(false);
      if (openMenu && menuRef.current && !menuRef.current.contains(t)) setOpenMenu(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openBell, openMenu]);

  async function logout() {
    await supabase.auth.signOut();
    setOpenBell(false);
    setOpenMenu(false);
    router.push("/");
    router.refresh();
  }

  async function markAllRead() {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);

    setOpenBell(false);
    await refreshAll();
  }

  async function openNotif(n: Notif) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    setOpenBell(false);
    router.push(n.link || "/approvals");
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-extrabold text-lg tracking-tight text-slate-900">
          ReqGen <span className="text-slate-400">1.1.0</span>
        </Link>

        {!signedIn ? (
          <div />
        ) : (
          <div className="flex items-center gap-2">
            {/* Desktop tabs */}
            <nav className="hidden md:flex items-center gap-2">
              {links.map((l) => (
                <Link key={l.href} className={linkClass(l.href)} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>

            {/* 🔔 Notifications */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setOpenBell((v) => !v)}
                className="relative rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
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
            </div>

            {/* Mobile menu */}
            <div className="relative md:hidden" ref={menuRef}>
              <button
                onClick={() => setOpenMenu((v) => !v)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                title="Menu"
              >
                ☰
              </button>

              {openMenu && (
                <div className="absolute right-0 top-12 w-64 rounded-2xl border bg-white shadow-lg overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50">
                    <div className="text-sm font-bold text-slate-900">Menu</div>
                    <div className="text-xs text-slate-600">Role: {myRole}</div>
                  </div>

                  <div className="p-2">
                    {links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`block rounded-xl px-3 py-2 text-sm font-semibold ${
                          pathname === l.href ? "bg-blue-600 text-white" : "text-slate-800 hover:bg-slate-100"
                        }`}
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>

                  <div className="border-t p-2">
                    <button
                      onClick={logout}
                      className="w-full rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop logout */}
            <button
              onClick={logout}
              className="hidden md:inline-flex ml-1 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}