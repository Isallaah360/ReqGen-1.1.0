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

type PendingItem = {
  id: string;
  request_no: string;
  title: string;
  current_stage: string;
  status: string;
  created_at: string;
};

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const [signedIn, setSignedIn] = useState(false);
  const [myRole, setMyRole] = useState<string>("Staff");
  const [openBell, setOpenBell] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [items, setItems] = useState<Notif[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);

  const rk = roleKey(myRole);

  const isAdmin = ["admin", "auditor"].includes(rk);
  const canFinance = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canHRFiling = ["admin", "auditor", "hr"].includes(rk);

  const links = useMemo(() => {
    const base = [
      { href: "/approvals", label: "Approvals" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/requests", label: "My Requests" },
    ];

    if (canFinance) {
      base.push({ href: "/finance/subheads", label: "Finance" });
      base.push({ href: "/payment-vouchers", label: "Vouchers" });
    }

    if (canHRFiling) {
      base.push({ href: "/hr/filing", label: "HR Office" });
    }

    if (isAdmin) {
      base.push({ href: "/admin", label: "Admin" });
    }

    return base;
  }, [canFinance, canHRFiling, isAdmin]);

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-xl text-sm font-semibold transition ${
      pathname === href || pathname.startsWith(href + "/")
        ? "bg-blue-600 text-white shadow-sm"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  async function refreshAll() {
    const { data: sess, error: sessErr } = await supabase.auth.getSession();

    if (sessErr || !sess.session?.user) {
      setSignedIn(false);
      setUserId(null);
      setMyRole("Staff");
      setPendingCount(0);
      setPendingItems([]);
      setItems([]);
      return;
    }

    const uid = sess.session.user.id;
    setSignedIn(true);
    setUserId(uid);

    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();

    setMyRole((prof?.role || "Staff") as string);

    /*
      Bell badge should represent real work waiting for this user.
      It should not count old notification rows.
    */
    const pendingStatuses = [
      "Submitted",
      "In Review",
      "Approved",
      "Approved for Filing",
    ];

    const { count } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("current_owner", uid)
      .in("status", pendingStatuses);

    setPendingCount(count || 0);

    const { data: pendingRows } = await supabase
      .from("requests")
      .select("id,request_no,title,current_stage,status,created_at")
      .eq("current_owner", uid)
      .in("status", pendingStatuses)
      .order("created_at", { ascending: false })
      .limit(8);

    setPendingItems((pendingRows || []) as PendingItem[]);

    /*
      Keep recent notifications in dropdown, but do not use them for badge count.
    */
    const { data: n } = await supabase
      .from("notifications")
      .select("id,title,link,is_read,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(8);

    setItems((n || []) as Notif[]);
  }

  useEffect(() => {
    refreshAll();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshAll();
    });

    return () => sub.subscription.unsubscribe();
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
        () => refreshAll()
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
        () => refreshAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(requestChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    setOpenBell(false);
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (openBell && bellRef.current && !bellRef.current.contains(t)) {
        setOpenBell(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openBell]);

  async function logout() {
    await supabase.auth.signOut();
    setOpenBell(false);
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

    setOpenBell(false);
    await refreshAll();
  }

  async function openNotif(n: Notif) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    setOpenBell(false);
    router.push(n.link || "/approvals");
  }

  function openPending(p: PendingItem) {
    setOpenBell(false);
    router.push(`/requests/${p.id}`);
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-extrabold text-lg tracking-tight text-slate-900">
          ReqGen <span className="text-slate-400">1.1.0</span>
        </Link>

        {!signedIn ? null : (
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-2">
              {links.map((l) => (
                <Link key={l.href} className={linkClass(l.href)} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setOpenBell((v) => !v)}
                className="relative rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                title="Pending approvals"
              >
                🔔
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </button>

              {openBell && (
                <div className="absolute right-0 top-12 w-96 rounded-2xl border bg-white shadow-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900">Pending Work</div>
                      <div className="text-xs text-slate-500">
                        {pendingCount} request{pendingCount === 1 ? "" : "s"} assigned to you
                      </div>
                    </div>

                    <button
                      onClick={markAllRead}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Mark notices read
                    </button>
                  </div>

                  {pendingItems.length === 0 ? (
                    <div className="p-4 text-sm text-slate-600">
                      No pending request assigned to you.
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-auto">
                      {pendingItems.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => openPending(p)}
                          className="w-full border-t px-4 py-3 text-left hover:bg-blue-50"
                        >
                          <div className="text-sm font-bold text-slate-900">
                            {p.request_no}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-700">
                            {p.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {p.current_stage} • {p.status} •{" "}
                            {new Date(p.created_at).toLocaleString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="border-t bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Recent Notifications
                    </div>

                    {items.length === 0 ? (
                      <div className="mt-2 text-xs text-slate-500">No recent notifications.</div>
                    ) : (
                      <div className="mt-2 max-h-44 overflow-auto rounded-xl border bg-white">
                        {items.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => openNotif(n)}
                            className={`w-full border-t px-3 py-2 text-left first:border-t-0 hover:bg-slate-50 ${
                              n.is_read ? "bg-white" : "bg-blue-50"
                            }`}
                          >
                            <div className="text-xs font-semibold text-slate-900">
                              {n.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {new Date(n.created_at).toLocaleString()}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

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