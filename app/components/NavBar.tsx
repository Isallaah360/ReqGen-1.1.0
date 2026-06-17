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

type PendingApproval = {
  id: string;
  request_no: string | null;
  title: string | null;
  status: string | null;
  current_stage: string | null;
  amount: number | null;
  created_at: string;
};

type NavItem = {
  href: string;
  label: string;
  description?: string;
};

type IconProps = {
  className?: string;
};

const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];
const MFA_PATHS = ["/mfa", "/mfa/setup"];

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

function isMfaPath(pathname: string) {
  return MFA_PATHS.includes(pathname);
}

function formatNaira(value: number | null | undefined) {
  return "₦" + Math.round(Number(value || 0)).toLocaleString();
}

function compactCount(value: number) {
  if (value > 99) return "99+";
  return String(value);
}

function IconApprovals({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 11.5 11 13.5 15.5 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDashboard({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 13h7V4H4v9ZM13 20h7v-9h-7v9ZM4 20h7v-5H4v5ZM13 9h7V4h-7v5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRequests({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 6h10M8 12h10M8 18h7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFinance({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10h16M6 10v9M10 10v9M14 10v9M18 10v9M4 19h16M12 4 4 8h16l-8-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHR({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 11a4 4 0 1 0-8 0M4 20a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M17.5 5.5v3M19 7h-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconAdmin({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12 11.5 14 15 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLogout({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 8 18 12 14 16M18 12H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconButtonTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-[70] mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
      {label}
    </span>
  );
}

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const [signedIn, setSignedIn] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [checkingSecurity, setCheckingSecurity] = useState(true);
  const [myRole, setMyRole] = useState<string>("Staff");

  const [openApprovalPanel, setOpenApprovalPanel] = useState(false);
  const [openFinance, setOpenFinance] = useState(false);
  const [openHR, setOpenHR] = useState(false);
  const [openMobileMenu, setOpenMobileMenu] = useState(false);

  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [notificationItems, setNotificationItems] = useState<Notif[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const approvalRef = useRef<HTMLDivElement | null>(null);
  const financeRef = useRef<HTMLDivElement | null>(null);
  const hrRef = useRef<HTMLDivElement | null>(null);
  const mobileRef = useRef<HTMLDivElement | null>(null);

  const rk = roleKey(myRole);

  const isAdmin = ["admin", "auditor"].includes(rk);
  const canFinance = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canAuditView = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canHR = ["admin", "auditor", "hr"].includes(rk);

  function isActiveLink(href: string) {
    if (href === "/") return pathname === "/";
    if (pathname === href) return true;

    if (href === "/payment-vouchers") {
      return pathname === "/payment-vouchers";
    }

    return pathname.startsWith(href + "/");
  }

  const financeLinks = useMemo<NavItem[]>(() => {
    const list: NavItem[] = [
      {
        href: "/finance/departments",
        label: "Departments",
        description: "Department records and finance structure",
      },
      {
        href: "/finance/manage-accounts",
        label: "Manage Accounts",
        description: "IET bank accounts and account balances",
      },
      {
        href: "/finance/manage-accounts/assign",
        label: "Assign Accounts",
        description: "Assign account officers and account funding",
      },
      {
        href: "/finance/subheads",
        label: "Subheads / Finance",
        description: "Budget lines, allocations and balances",
      },
      {
        href: "/finance/reports",
        label: "Monthly / Yearly Reports",
        description: "Finance summaries, PDF and Excel exports",
      },
      {
        href: "/payment-vouchers",
        label: "Payment Vouchers",
        description: "Generate and manage PVs",
      },
      {
        href: "/payment-vouchers/reports",
        label: "PV Reports",
        description: "Payment voucher report register",
      },
    ];

    if (["admin", "auditor"].includes(rk)) {
      list.push({
        href: "/payment-vouchers/settings",
        label: "PV Settings",
        description: "Cheque signers and counter signers",
      });

      list.push({
        href: "/admin/security",
        label: "Security Checklist",
        description: "MFA, backup and RLS audit checklist",
      });
    }

    if (canAuditView) {
      list.push({
        href: "/finance/audit",
        label: "Audit & Reconciliation",
        description: "Control room, exceptions and reconciliation",
      });
    }

    return list;
  }, [canAuditView, rk]);

  const hrLinks = useMemo<NavItem[]>(() => {
    return [
      {
        href: "/hr/filing",
        label: "HR Filing",
        description: "Personal requests, filing and staff records",
      },
    ];
  }, []);

  const financeActive = useMemo(() => {
    return financeLinks.some((item) => isActiveLink(item.href));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financeLinks, pathname]);

  const hrActive = useMemo(() => {
    return hrLinks.some((item) => isActiveLink(item.href));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hrLinks, pathname]);

  const iconLinkClass = (href: string) =>
    `group relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold transition ${
      isActiveLink(href)
        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    }`;

  const dropdownIconButtonClass = (active: boolean) =>
    `group relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold transition ${
      active
        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    }`;

  const dropdownItemClass = (href: string) =>
    `block w-full rounded-2xl px-4 py-3 text-left transition ${
      isActiveLink(href)
        ? "bg-blue-600 text-white shadow-sm"
        : "text-slate-800 hover:bg-slate-100"
    }`;

  const dropdownItemDescriptionClass = (href: string) =>
    `mt-0.5 text-xs font-semibold ${
      isActiveLink(href) ? "text-blue-100" : "text-slate-500"
    }`;

  const mobileItemClass = (href: string) =>
    `block w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
      isActiveLink(href)
        ? "bg-blue-600 text-white shadow-sm"
        : "text-slate-800 hover:bg-slate-100"
    }`;

  const mobileItemDescriptionClass = (href: string) =>
    `mt-0.5 text-xs font-semibold ${
      isActiveLink(href) ? "text-blue-100" : "text-slate-500"
    }`;

  async function checkMfaVerified() {
    const { data: aalData, error: aalErr } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalErr) return false;

    return aalData.currentLevel === "aal2";
  }

  async function loadPendingApprovalCount(uid: string) {
    const { data, error } = await supabase.rpc("get_my_pending_approval_count");

    if (!error && typeof data === "number") {
      setPendingApprovalCount(data);
      return;
    }

    const { count } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("current_owner", uid)
      .not("status", "in", '("Approved","Rejected","Cancelled","Deleted","Paid","Closed")');

    setPendingApprovalCount(count || 0);
  }

  async function loadPendingApprovalPreview(uid: string) {
    const { data, error } = await supabase
      .from("requests")
      .select("id,request_no,title,status,current_stage,amount,created_at")
      .eq("current_owner", uid)
      .not("status", "in", '("Approved","Rejected","Cancelled","Deleted","Paid","Closed")')
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      setPendingApprovals([]);
      return;
    }

    setPendingApprovals((data || []) as PendingApproval[]);
  }

  async function loadNotifications(uid: string) {
    const { data: n } = await supabase
      .from("notifications")
      .select("id,title,link,is_read,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(5);

    const list = (n || []) as Notif[];
    setNotificationItems(list);

    const { count: unreadNotifCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("is_read", false);

    setUnreadNotificationCount(unreadNotifCount || 0);
  }

  async function refreshAll() {
    setCheckingSecurity(true);

    const { data: sess, error: sessErr } = await supabase.auth.getSession();

    if (sessErr || !sess.session?.user) {
      setSignedIn(false);
      setMfaVerified(false);
      setUserId(null);
      setMyRole("Staff");
      setPendingApprovalCount(0);
      setPendingApprovals([]);
      setNotificationItems([]);
      setUnreadNotificationCount(0);
      setCheckingSecurity(false);
      return;
    }

    const uid = sess.session.user.id;
    setSignedIn(true);
    setUserId(uid);

    const verified = await checkMfaVerified();
    setMfaVerified(verified);

    if (!verified) {
      setMyRole("Staff");
      setPendingApprovalCount(0);
      setPendingApprovals([]);
      setNotificationItems([]);
      setUnreadNotificationCount(0);
      setCheckingSecurity(false);
      return;
    }

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

    await Promise.all([
      loadPendingApprovalCount(uid),
      loadPendingApprovalPreview(uid),
      loadNotifications(uid),
    ]);

    setCheckingSecurity(false);
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
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!userId || !mfaVerified) return;

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
  }, [userId, mfaVerified]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;

      if (openApprovalPanel && approvalRef.current && !approvalRef.current.contains(t)) {
        setOpenApprovalPanel(false);
      }

      if (openFinance && financeRef.current && !financeRef.current.contains(t)) {
        setOpenFinance(false);
      }

      if (openHR && hrRef.current && !hrRef.current.contains(t)) {
        setOpenHR(false);
      }

      if (openMobileMenu && mobileRef.current && !mobileRef.current.contains(t)) {
        setOpenMobileMenu(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openApprovalPanel, openFinance, openHR, openMobileMenu]);

  useEffect(() => {
    setOpenApprovalPanel(false);
    setOpenFinance(false);
    setOpenHR(false);
    setOpenMobileMenu(false);
  }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    setSignedIn(false);
    setMfaVerified(false);
    setUserId(null);
    setMyRole("Staff");
    setPendingApprovalCount(0);
    setPendingApprovals([]);
    setNotificationItems([]);
    setUnreadNotificationCount(0);
    router.push("/");
    router.refresh();
  }

  async function markAllNotificationsRead() {
    if (!userId || !mfaVerified) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    refreshAll();
  }

  async function openNotif(n: Notif) {
    if (!mfaVerified) return;

    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);

    setOpenApprovalPanel(false);
    router.push(n.link || "/approvals");
  }

  function openApprovalRequest(id: string) {
    setOpenApprovalPanel(false);
    router.push(`/requests/${id}`);
  }

  function goTo(href: string) {
    setOpenFinance(false);
    setOpenHR(false);
    setOpenMobileMenu(false);
    setOpenApprovalPanel(false);
    router.push(href);
  }

  const showFullNavigation =
    signedIn && mfaVerified && !isPublicPath(pathname) && !isMfaPath(pathname);

  const showLockedMfaNavigation = signedIn && !mfaVerified && !isPublicPath(pathname);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-extrabold tracking-tight text-slate-900">
          ReqGen <span className="text-slate-400">1.1.0</span>
        </Link>

        {checkingSecurity && signedIn && !isPublicPath(pathname) && (
          <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 sm:block">
            Checking security...
          </div>
        )}

        {showLockedMfaNavigation && (
          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 sm:block">
              2FA verification required
            </div>

            <button
              type="button"
              onClick={() => router.push("/mfa")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100"
            >
              Verify 2FA
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        )}

        {showFullNavigation && (
          <div className="flex min-w-0 items-center gap-2">
            <nav className="hidden items-center gap-2 md:flex">
              <div className="relative" ref={approvalRef}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenApprovalPanel((v) => !v);
                    setOpenFinance(false);
                    setOpenHR(false);
                    setOpenMobileMenu(false);
                  }}
                  className={`group relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                    isActiveLink("/approvals")
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : pendingApprovalCount > 0
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  <IconApprovals />
                  <IconButtonTooltip label="Approvals" />

                  {pendingApprovalCount > 0 && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                      {compactCount(pendingApprovalCount)}
                    </span>
                  )}
                </button>

                {openApprovalPanel && (
                  <div className="absolute left-0 top-12 z-50 w-[370px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    <div className="border-b bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-extrabold text-slate-900">
                            Pending Approvals
                          </div>
                          <div className="mt-0.5 text-xs font-semibold text-slate-500">
                            Exact requests currently assigned to you
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-black ${
                            pendingApprovalCount > 0
                              ? "bg-red-600 text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {pendingApprovalCount}
                        </span>
                      </div>
                    </div>

                    {pendingApprovals.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">
                        No request is currently awaiting your approval.
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-auto">
                        {pendingApprovals.map((r) => (
                          <button
                            type="button"
                            key={r.id}
                            onClick={() => openApprovalRequest(r.id)}
                            className="w-full border-t px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black text-slate-900">
                                  {r.request_no || "No Request No"}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-700">
                                  {r.title || "Untitled Request"}
                                </div>
                                <div className="mt-1 text-xs font-semibold text-slate-500">
                                  Stage: {r.current_stage || "Pending"} •{" "}
                                  {new Date(r.created_at).toLocaleString()}
                                </div>
                              </div>

                              <div className="shrink-0 text-right text-xs font-black text-slate-900">
                                {formatNaira(r.amount)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="border-t bg-slate-50 p-3">
                      <button
                        type="button"
                        onClick={() => goTo("/approvals")}
                        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
                      >
                        Open Approvals Inbox
                      </button>
                    </div>

                    {notificationItems.length > 0 && (
                      <div className="border-t">
                        <div className="flex items-center justify-between bg-white px-4 py-3">
                          <div className="text-sm font-extrabold text-slate-900">
                            Recent Notifications
                            {unreadNotificationCount > 0 && (
                              <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-black text-white">
                                {unreadNotificationCount}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={markAllNotificationsRead}
                            className="text-xs font-bold text-blue-700 hover:underline"
                          >
                            Mark read
                          </button>
                        </div>

                        <div className="max-h-52 overflow-auto">
                          {notificationItems.map((n) => (
                            <button
                              type="button"
                              key={n.id}
                              onClick={() => openNotif(n)}
                              className={`w-full border-t px-4 py-3 text-left hover:bg-slate-50 ${
                                n.is_read ? "bg-white" : "bg-blue-50"
                              }`}
                            >
                              <div className="text-sm font-semibold text-slate-900">
                                {n.title}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date(n.created_at).toLocaleString()}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Link className={iconLinkClass("/dashboard")} href="/dashboard">
                <IconDashboard />
                <IconButtonTooltip label="Dashboard" />
              </Link>

              <Link className={iconLinkClass("/requests")} href="/requests">
                <IconRequests />
                <IconButtonTooltip label="My Requests" />
              </Link>

              {canFinance && (
                <div className="relative" ref={financeRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenFinance((v) => !v);
                      setOpenHR(false);
                      setOpenApprovalPanel(false);
                      setOpenMobileMenu(false);
                    }}
                    className={dropdownIconButtonClass(financeActive)}
                  >
                    <IconFinance />
                    <IconButtonTooltip label="Finance" />
                  </button>

                  {openFinance && (
                    <div className="absolute left-0 top-12 z-50 w-[390px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                      <div className="border-b bg-slate-50 px-5 py-4">
                        <div className="text-base font-extrabold text-slate-900">
                          Finance Directorate
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-500">
                          Departments, accounts, budgets, vouchers, reports and audit tools
                        </div>
                      </div>

                      <div className="max-h-[70vh] space-y-1 overflow-auto p-3">
                        {financeLinks.map((item) => (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => goTo(item.href)}
                            className={dropdownItemClass(item.href)}
                          >
                            <div className="text-sm font-extrabold">{item.label}</div>
                            {item.description && (
                              <div className={dropdownItemDescriptionClass(item.href)}>
                                {item.description}
                              </div>
                            )}
                          </button>
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
                      setOpenApprovalPanel(false);
                      setOpenMobileMenu(false);
                    }}
                    className={dropdownIconButtonClass(hrActive)}
                  >
                    <IconHR />
                    <IconButtonTooltip label="HR" />
                  </button>

                  {openHR && (
                    <div className="absolute left-0 top-12 z-50 w-[300px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                      <div className="border-b bg-slate-50 px-5 py-4">
                        <div className="text-base font-extrabold text-slate-900">
                          HR Directorate
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-500">
                          Personal requests, filing and records
                        </div>
                      </div>

                      <div className="space-y-1 p-3">
                        {hrLinks.map((item) => (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => goTo(item.href)}
                            className={dropdownItemClass(item.href)}
                          >
                            <div className="text-sm font-extrabold">{item.label}</div>
                            {item.description && (
                              <div className={dropdownItemDescriptionClass(item.href)}>
                                {item.description}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isAdmin && (
                <Link className={iconLinkClass("/admin")} href="/admin">
                  <IconAdmin />
                  <IconButtonTooltip label="Admin" />
                </Link>
              )}
            </nav>

            <div className="relative md:hidden" ref={mobileRef}>
              <button
                type="button"
                onClick={() => {
                  setOpenMobileMenu((v) => !v);
                  setOpenFinance(false);
                  setOpenHR(false);
                  setOpenApprovalPanel(false);
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                  openMobileMenu
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-100"
                }`}
              >
                Menu ▾
              </button>

              {openMobileMenu && (
                <div className="absolute right-0 top-12 z-50 max-h-[80vh] w-[340px] overflow-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                  <div className="mb-2 rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="font-extrabold text-slate-900">Navigation</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      ReqGen modules
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => goTo("/approvals")}
                    className={mobileItemClass("/approvals")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <IconApprovals className="h-4 w-4" />
                      Approvals
                      {pendingApprovalCount > 0 && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                          {compactCount(pendingApprovalCount)}
                        </span>
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goTo("/dashboard")}
                    className={mobileItemClass("/dashboard")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <IconDashboard className="h-4 w-4" />
                      Dashboard
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goTo("/requests")}
                    className={mobileItemClass("/requests")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <IconRequests className="h-4 w-4" />
                      My Requests
                    </span>
                  </button>

                  {canFinance && (
                    <>
                      <div className="mt-3 border-t pt-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Finance
                      </div>

                      {financeLinks.map((item) => (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => goTo(item.href)}
                          className={mobileItemClass(item.href)}
                        >
                          <div className="inline-flex items-center gap-2">
                            <IconFinance className="h-4 w-4" />
                            {item.label}
                          </div>
                          {item.description && (
                            <div className={mobileItemDescriptionClass(item.href)}>
                              {item.description}
                            </div>
                          )}
                        </button>
                      ))}
                    </>
                  )}

                  {canHR && (
                    <>
                      <div className="mt-3 border-t pt-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        HR
                      </div>

                      {hrLinks.map((item) => (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => goTo(item.href)}
                          className={mobileItemClass(item.href)}
                        >
                          <div className="inline-flex items-center gap-2">
                            <IconHR className="h-4 w-4" />
                            {item.label}
                          </div>
                          {item.description && (
                            <div className={mobileItemDescriptionClass(item.href)}>
                              {item.description}
                            </div>
                          )}
                        </button>
                      ))}
                    </>
                  )}

                  {isAdmin && (
                    <>
                      <div className="mt-3 border-t pt-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Administration
                      </div>

                      <button
                        type="button"
                        onClick={() => goTo("/admin")}
                        className={mobileItemClass("/admin")}
                      >
                        <span className="inline-flex items-center gap-2">
                          <IconAdmin className="h-4 w-4" />
                          Admin
                        </span>
                      </button>
                    </>
                  )}

                  <div className="mt-3 border-t pt-3">
                    <button
                      type="button"
                      onClick={logout}
                      className="w-full rounded-xl bg-red-600 px-4 py-3 text-left text-sm font-bold text-white hover:bg-red-700"
                    >
                      <span className="inline-flex items-center gap-2">
                        <IconLogout className="h-4 w-4" />
                        Logout
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={logout}
              className="group relative hidden h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white transition hover:bg-red-700 sm:inline-flex"
            >
              <IconLogout />
              <IconButtonTooltip label="Logout" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}