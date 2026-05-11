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

type MenuLink = {
  href: string;
  label: string;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function isPathActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const [signedIn, setSignedIn] = useState(false);
  const [myRole, setMyRole] = useState<string>("Staff");
  const [openBell, setOpenBell] = useState(false);
  const [openFinance, setOpenFinance] = useState(false);
  const [openHR, setOpenHR] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const bellRef = useRef<HTMLDivElement | null>(null);
  const financeRef = useRef<HTMLDivElement | null>(null);
  const hrRef = useRef<HTMLDivElement | null>(null);

  const rk = roleKey(myRole);

  const isAdmin = ["admin", "auditor"].includes(rk);
  const canFinance = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canHR = ["admin", "auditor", "hr"].includes(rk);

  const mainLinks = useMemo<MenuLink[]>(() => {
    return [
      { href: "/approvals", label: "Approvals" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/requests", label: "My Requests" },
    ];
  }, []);

  const financeLinks = useMemo<MenuLink[]>(() => {
    return [
      { href: "/finance/subheads", label: "Subheads / Finance" },
      { href: "/payment-vouchers", label: "Payment Vouchers" },
      { href: "/payment-vouchers/reports", label: "PV Reports" },
      { href: "/payment-vouchers/settings", label: "PV Settings" },
      { href: "/finance/reports", label: "Reports" },
      { href: "/finance/audit", label: "Audit & Reconciliation" },
    ];
  }, []);

  const hrLinks = useMemo<MenuLink[]>(() => {
    return [{ href: "/hr/filing", label: "HR Filing" }];
  }, []);

  const financeIsActive = useMemo(() => {
    return (
      pathname?.startsWith("/finance") ||
      pathname?.startsWith("/payment-vouchers")
    );
  }, [pathname]);

  const hrIsActive = useMemo(() => {
    return pathname?.startsWith("/hr");
  }, [pathname]);

  const navLinkClass = (href: string) =>
    `px-3 py-2 rounded-xl text-sm font-semibold transition ${
      isPathActive(pathname, href)
        ? "bg-blue-600 text-white shadow-sm"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  const dropdownButtonClass = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
      active
        ? "bg-blue-600 text-white shadow-sm"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  const dropdownItemClass = (href: string) =>
    `block rounded-xl px-4 py-3 text-sm font-semibold transition ${
      isPathActive(pathname, href)
        ? "bg-blue-50 text-blue-700"
        : "text-slate-700 hover:bg-slate-50"
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

    if (!profErr && prof?.role) {
      setMyRole(prof.role);
    } else {
      setMyRole("Staff");
    }

    const { data: n } = await supabase
      .from("notifications")
      .select("id,title,link,is_read,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(8);

    const list = (n || []) as Notif[];
    setItems(list);

    const { count: unreadNotifCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("is_read", false);

    const { count: pendingApprovalCount } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("current_owner", uid);

    setUnreadCount(Number(unreadNotifCount || 0) + Number(pendingApprovalCount || 0));
  }

  useEffect(() => {
    refreshAll();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshAll();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;

    const notifChannel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        refreshAll
      )
      .subscribe();

    const requestChannel = supabase
      .channel(`req-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requests",
        },
        refreshAll
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(requestChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;

      if (openBell && bellRef.current && !bellRef.current.contains(t)) {
        setOpenBell(false);
      }

      if (openFinance && financeRef.current && !financeRef.current.contains(t)) {
        setOpenFinance(false);
      }

      if (openHR && hrRef.current && !hrRef.current.contains(t)) {
        setOpenHR(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openBell, openFinance, openHR]);

  useEffect(() => {
    setOpenFinance(false);
    setOpenHR(false);
    setOpenBell(false);
  }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function markAllRead() {
    if (!userId) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    refreshAll();
  }

  async function openNotif(n: Notif) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    router.push(n.link || "/approvals");
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-extrabold text-lg tracking-tight text-slate-900">
          ReqGen <span className="text-slate-400">1.1.0</span>
        </Link>

        {!signedIn ? null : (
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-2 lg:flex">
              {mainLinks.map((l) => (
                <Link key={l.href} className={navLinkClass(l.href)} href={l.href}>
                  {l.label}
                </Link>
              ))}

              {canFinance && (
                <div className="relative" ref={financeRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenFinance((v) => !v);
                      setOpenHR(false);
                      setOpenBell(false);
                    }}
                    className={dropdownButtonClass(Boolean(financeIsActive))}
                  >
                    Finance
                    <span className="text-xs leading-none">▾</span>
                  </button>

                  {openFinance && (
                    <div className="absolute right-0 top-12 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      <div className="border-b bg-slate-50 px-4 py-3">
                        <div className="font-extrabold text-slate-900">Finance Directorate</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          Budgets, vouchers, reports and audit tools
                        </div>
                      </div>

                      <div className="p-2">
                        {financeLinks.map((l) => (
                          <Link key={l.href} href={l.href} className={dropdownItemClass(l.href)}>
                            {l.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canHR && (
                <div className="relative" ref={hrRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenHR((v) => !v);
                      setOpenFinance(false);
                      setOpenBell(false);
                    }}
                    className={dropdownButtonClass(Boolean(hrIsActive))}
                  >
                    HR
                    <span className="text-xs leading-none">▾</span>
                  </button>

                  {openHR && (
                    <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      <div className="border-b bg-slate-50 px-4 py-3">
                        <div className="font-extrabold text-slate-900">HR Directorate</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          Personal request filing and records
                        </div>
                      </div>

                      <div className="p-2">
                        {hrLinks.map((l) => (
                          <Link key={l.href} href={l.href} className={dropdownItemClass(l.href)}>
                            {l.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isAdmin && (
                <Link className={navLinkClass("/admin")} href="/admin">
                  Admin
                </Link>
              )}
            </nav>

            <nav className="flex items-center gap-1 lg:hidden">
              <Link className={navLinkClass("/approvals")} href="/approvals">
                Approvals
              </Link>

              <Link className={navLinkClass("/requests")} href="/requests">
                Requests
              </Link>

              {canFinance && (
                <Link className={navLinkClass("/finance/subheads")} href="/finance/subheads">
                  Finance
                </Link>
              )}

              {canHR && (
                <Link className={navLinkClass("/hr/filing")} href="/hr/filing">
                  HR
                </Link>
              )}
            </nav>

            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={() => {
                  setOpenBell((v) => !v);
                  setOpenFinance(false);
                  setOpenHR(false);
                }}
                className="relative rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                title="Notifications"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {openBell && (
                <div className="absolute right-0 top-12 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                    <div className="font-bold text-slate-900">Notifications</div>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="p-4 text-sm text-slate-600">No notifications yet.</div>
                  ) : (
                    <div className="max-h-96 overflow-auto">
                      {items.map((n) => (
                        <button
                          type="button"
                          key={n.id}
                          onClick={() => openNotif(n)}
                          className={`w-full border-t px-4 py-3 text-left hover:bg-slate-50 ${
                            n.is_read ? "bg-white" : "bg-blue-50"
                          }`}
                        >
                          <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={logout}
              className="hidden rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 md:inline-flex"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}