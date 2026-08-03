"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { REPORT_ACCESS_ROLES } from "@/lib/roles";
import { ActiveRoleBadge } from "@/app/components/ActiveRoleSwitcher";

type Notif = {
  id: string;
  title: string | null;
  body: string | null;
  message: string | null;
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

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
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

function hasAnyRole(roleSet: Set<string>, roles: string[]) {
  return roles.some((role) => roleSet.has(roleKey(role)));
}

function roleSummary(fallbackRole: string | null | undefined, profileRoles: ProfileRole[]) {
  const active = profileRoles.filter((r) => r.is_active);

  if (active.length === 0) return fallbackRole || "Staff";

  return active
    .slice()
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.role_name.localeCompare(b.role_name);
    })
    .map((r) => r.role_name)
    .join(", ");
}

function IconApprovals({ className = "h-6 w-6" }: IconProps) {
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

function IconDashboard({ className = "h-6 w-6" }: IconProps) {
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

function IconRequests({ className = "h-6 w-6" }: IconProps) {
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



function IconStaff({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconAudit({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 9h8M8 13h5M8 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m15.5 12.5 1.5 1.5 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconReports({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 3h14v18H5V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 16v-3M12 16V9M16 16v-5M8 7h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconFinance({ className = "h-6 w-6" }: IconProps) {
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

function IconHR({ className = "h-6 w-6" }: IconProps) {
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

function IconRegistry({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 4h14v16H5V4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 8h8M8 12h8M8 16h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconAdmin({ className = "h-6 w-6" }: IconProps) {
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

function IconNotifications({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 21h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLogout({ className = "h-6 w-6" }: IconProps) {
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


function NavPngIcon({
  src,
  alt,
  size = 28,
}: {
  src: string;
  alt: string;
  size?: number;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority
      className="h-auto w-auto max-h-7 max-w-7 object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-110"
    />
  );
}

function IconButtonTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-[70] mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-slate-950/95 px-3 py-1.5 text-xs font-black tracking-wide text-white shadow-xl backdrop-blur opacity-0 translate-y-1 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
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
  const [myRoles, setMyRoles] = useState<ProfileRole[]>([]);
  const [activeRoleKey, setActiveRoleKey] = useState<string | null>(null);

  const [openApprovalPanel, setOpenApprovalPanel] = useState(false);
  const [actionTab, setActionTab] = useState<"actions" | "updates">("actions");
  const [openMobileMenu, setOpenMobileMenu] = useState(false);

  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [notificationItems, setNotificationItems] = useState<Notif[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const approvalRef = useRef<HTMLDivElement | null>(null);
  const mobileRef = useRef<HTMLDivElement | null>(null);

  const roleSet = useMemo(() => {
    // Strict isolation: only the selected active role controls visible modules.
    const effective = new Set<string>();
    if (activeRoleKey) effective.add(roleKey(activeRoleKey));
    return effective;
  }, [activeRoleKey]);

  const isAdmin = hasAnyRole(roleSet, ["admin"]);
  const canViewReports = hasAnyRole(roleSet, [...REPORT_ACCESS_ROLES]);
  const canAudit = hasAnyRole(roleSet, ["admin", "auditor"]);
  const canExecutive = hasAnyRole(roleSet, ["admin", "dg", "director", "auditor", "hrboss", "humanresourcesboss"]);

  const canFinance = hasAnyRole(roleSet, [
    "admin",
    "auditor",
    "account",
    "accounts",
    "accountofficer",
    "pvsigner",
    "pvcountersigner",
  ]);

  const canHR = hasAnyRole(roleSet, [
    "admin",
    "auditor",
    "hr",
    "hrboss",
    "hrofficer",
    "hrofficer1",
    "hrofficer2",
    "hrofficer3",
  ]);

  const canRegistry = hasAnyRole(roleSet, ["admin", "auditor", "registry"]);

  function isActiveLink(href: string) {
    if (href === "/") return pathname === "/";
    if (pathname === href) return true;

    if (href === "/payment-vouchers") {
      return pathname === "/payment-vouchers";
    }

    return pathname.startsWith(href + "/");
  }

  const isHRBoss = hasAnyRole(roleSet, ["admin", "hr", "hrboss"]);
  const hrHomeHref = isHRBoss ? "/hr" : "/hr/my-work";

  const iconLinkClass = (href: string) =>
    `group relative inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 text-sm font-black transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-200 ${isActiveLink(href)
      ? "border-blue-700 bg-gradient-to-br from-blue-700 via-blue-700 to-cyan-600 text-white shadow-lg shadow-blue-300/60 -translate-y-0.5"
      : "border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-1 hover:border-cyan-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:text-blue-700 hover:shadow-lg"
    }`;

  const mobileItemClass = (href: string) =>
    `block w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition ${isActiveLink(href)
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-800 hover:bg-slate-100"
    }`;

  const mobileItemDescriptionClass = (href: string) =>
    `mt-0.5 text-xs font-semibold ${isActiveLink(href) ? "text-blue-100" : "text-slate-500"}`;

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
      .not("status", "in", '("Approved","Rejected","Cancelled","Deleted","Paid","Closed","Completed")');

    setPendingApprovalCount(count || 0);
  }

  async function loadPendingApprovalPreview(uid: string) {
    const { data, error } = await supabase
      .from("requests")
      .select("id,request_no,title,status,current_stage,amount,created_at")
      .eq("current_owner", uid)
      .not("status", "in", '("Approved","Rejected","Cancelled","Deleted","Paid","Closed","Completed")')
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
      .select("id,title,body,message,link,is_read,created_at")
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

  async function loadRoleContext(uid: string) {
    const [profRes, rolesRes, activeRes] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", uid).maybeSingle(),
      supabase
        .from("profile_roles")
        .select("id,profile_id,role_key,role_name,is_primary,is_active")
        .eq("profile_id", uid)
        .eq("is_active", true),
      supabase.rpc("get_my_active_role"),
    ]);

    if (!profRes.error && profRes.data?.role) {
      setMyRole(profRes.data.role);
    } else {
      setMyRole("Staff");
    }

    if (!rolesRes.error) {
      setMyRoles((rolesRes.data || []) as ProfileRole[]);
    } else {
      setMyRoles([]);
    }

    const active = activeRes.data as { active_role_key?: string } | null;
    setActiveRoleKey(active?.active_role_key || null);
  }

  async function refreshAll() {
    setCheckingSecurity(true);

    const { data: sess, error: sessErr } = await supabase.auth.getSession();

    if (sessErr || !sess.session?.user) {
      setSignedIn(false);
      setMfaVerified(false);
      setUserId(null);
      setMyRole("Staff");
      setMyRoles([]);
      setActiveRoleKey(null);
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
      setMyRoles([]);
      setActiveRoleKey(null);
      setPendingApprovalCount(0);
      setPendingApprovals([]);
      setNotificationItems([]);
      setUnreadNotificationCount(0);
      setCheckingSecurity(false);
      return;
    }

    await loadRoleContext(uid);

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
    const refreshRole = () => refreshAll();
    window.addEventListener("reqgen-active-role-changed", refreshRole);
    return () => window.removeEventListener("reqgen-active-role-changed", refreshRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const roleChannel = supabase
      .channel(`roles-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profile_roles",
          filter: `profile_id=eq.${userId}`,
        },
        refreshAll
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(requestChannel);
      supabase.removeChannel(roleChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mfaVerified]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;

      if (openApprovalPanel && approvalRef.current && !approvalRef.current.contains(t)) {
        setOpenApprovalPanel(false);
      }


      if (openMobileMenu && mobileRef.current && !mobileRef.current.contains(t)) {
        setOpenMobileMenu(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openApprovalPanel, openMobileMenu]);

  useEffect(() => {
    setOpenApprovalPanel(false);
    setOpenMobileMenu(false);
  }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    setSignedIn(false);
    setMfaVerified(false);
    setUserId(null);
    setMyRole("Staff");
    setMyRoles([]);
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

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", n.id)
      .eq("user_id", userId);

    setOpenApprovalPanel(false);
    router.push(n.link || "/approvals");
    router.refresh();
  }

  function openApprovalRequest(id: string) {
    setOpenApprovalPanel(false);
    router.push(`/requests/${id}?updated=${Date.now()}`);
    router.refresh();
  }

  function goTo(href: string) {
    setOpenMobileMenu(false);
    setOpenApprovalPanel(false);
    router.push(`${href}?updated=${Date.now()}`);
    router.refresh();
  }

  const actionCount = pendingApprovalCount + unreadNotificationCount;

  const showFullNavigation =
    signedIn && mfaVerified && !isPublicPath(pathname) && !isMfaPath(pathname);

  const showLockedMfaNavigation = signedIn && !mfaVerified && !isPublicPath(pathname);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 rounded-xl bg-gradient-to-r from-slate-950 to-blue-900 px-3 py-2 text-lg font-black tracking-tight text-white shadow-md">
          ReqGen <span className="text-cyan-300">1.1.0</span>
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
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Logout
            </button>
          </div>
        )}

        {showFullNavigation && (
          <div className="flex min-w-0 items-center gap-2">
            <nav className="hidden items-center gap-2.5 md:flex">
              <div className="relative" ref={approvalRef}>
                <button
                  type="button"
                  aria-label="Open Action Centre"
                  aria-expanded={openApprovalPanel}
                  onClick={() => {
                    setOpenApprovalPanel((v) => !v);
                                    setOpenMobileMenu(false);
                  }}
                  className={`group relative inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-200 ${
                    isActiveLink("/approvals")
                      ? "border-blue-700 bg-gradient-to-br from-blue-700 via-blue-700 to-cyan-600 text-white shadow-lg shadow-blue-300/60 -translate-y-0.5"
                      : actionCount > 0
                        ? "border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-700 shadow-md hover:-translate-y-1 hover:border-cyan-400 hover:shadow-lg"
                        : "border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-1 hover:border-cyan-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:text-blue-700 hover:shadow-lg"
                  }`}
                >
                  <NavPngIcon src="/action.png" alt="Action Centre" />
                  <span className="absolute bottom-1.5 right-1.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[9px] font-black leading-none text-white shadow-sm ring-2 ring-white">✓</span>
                  <IconButtonTooltip label="Action Centre" />
                  {actionCount > 0 && (
                    <span className="absolute -right-2 -top-2 min-w-6 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-xs font-black text-white shadow-sm ring-2 ring-white">
                      {compactCount(actionCount)}
                    </span>
                  )}
                </button>

                {openApprovalPanel && (
                  <div className="absolute left-0 top-12 z-50 w-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
                    <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-cyan-800 px-5 py-4 text-white">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-base font-black tracking-tight">ACTION CENTRE</div>
                          <div className="mt-1 text-xs font-semibold text-blue-100">Live requests requiring action and recent workflow updates.</div>
                        </div>
                        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-black ring-1 ring-white/20">{actionCount}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-b bg-slate-50 p-2">
                      <button
                        type="button"
                        onClick={() => setActionTab("actions")}
                        className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${actionTab === "actions" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700"}`}
                      >
                        WAITING FOR ACTION ({pendingApprovalCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionTab("updates")}
                        className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${actionTab === "updates" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700"}`}
                      >
                        RECENT UPDATES ({unreadNotificationCount})
                      </button>
                    </div>

                    {actionTab === "actions" ? (
                      <>
                        {pendingApprovals.length === 0 ? (
                          <div className="px-5 py-8 text-center">
                            <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><IconApprovals /></div>
                            <div className="mt-3 text-sm font-black text-slate-900">No pending action</div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">You are up to date with assigned requests.</div>
                          </div>
                        ) : (
                          <div className="max-h-[360px] overflow-auto">
                            {pendingApprovals.map((r) => (
                              <button
                                type="button"
                                key={r.id}
                                onClick={() => openApprovalRequest(r.id)}
                                className="w-full border-b border-slate-100 px-5 py-4 text-left transition hover:bg-blue-50/70"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate text-sm font-black text-slate-950">{r.request_no || "No Request Number"}</span>
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">ACTION</span>
                                    </div>
                                    <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-700">{r.title || "Untitled Request"}</div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                                      <span>{r.current_stage || "Pending stage"}</span><span>•</span><span>{new Date(r.created_at).toLocaleString("en-NG", { hour12: true })}</span>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right text-xs font-black text-slate-950">{formatNaira(r.amount)}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="border-t bg-slate-50 p-3">
                          <button type="button" onClick={() => goTo("/approvals")} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200">
                            OPEN FULL APPROVALS INBOX
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between border-b px-4 py-3">
                          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Latest workflow updates</span>
                          <button type="button" onClick={markAllNotificationsRead} disabled={unreadNotificationCount === 0} className="rounded-lg px-2 py-1 text-xs font-black text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400">MARK ALL READ</button>
                        </div>
                        {notificationItems.length === 0 ? (
                          <div className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No recent update.</div>
                        ) : (
                          <div className="max-h-[360px] overflow-auto">
                            {notificationItems.map((n) => {
                              const detail = n.body || n.message || "Open the related record for details.";
                              return (
                                <button type="button" key={n.id} onClick={() => openNotif(n)} className={`w-full border-b border-slate-100 px-5 py-4 text-left transition hover:bg-blue-50/70 ${n.is_read ? "bg-white" : "bg-blue-50/50"}`}>
                                  <div className="flex items-start gap-3">
                                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.is_read ? "bg-slate-300" : "bg-blue-600"}`} />
                                    <div className="min-w-0">
                                      <div className="text-sm font-black text-slate-950">{n.title || "Workflow update"}</div>
                                      <div className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">{detail}</div>
                                      <div className="mt-1.5 text-[11px] font-bold text-slate-400">{new Date(n.created_at).toLocaleString("en-NG", { hour12: true })}</div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <Link className={iconLinkClass("/staff")} href="/staff">
                <NavPngIcon src="/dashboard.png" alt="Dashboard" />
                <IconButtonTooltip label="Staff Workspace" />
              </Link>

              <Link className={iconLinkClass("/requests")} href="/requests">
                <NavPngIcon src="/request.png" alt="My Requests" />
                <IconButtonTooltip label="My Requests" />
              </Link>
{canViewReports && (
                <Link className={iconLinkClass("/reports")} href="/reports">
                  <NavPngIcon src="/report.png" alt="Reports and Analytics" />
                  <IconButtonTooltip label="Reports & Analytics" />
                </Link>
              )}



              {canFinance && (
                <button
                  type="button"
                  onClick={() => goTo("/finance")}
                  className={iconLinkClass("/finance")}
                >
                  <NavPngIcon src="/finance.png" alt="Finance" />
                  <IconButtonTooltip label="Finance" />
                </button>
              )}

              {canHR && (
                <Link className={iconLinkClass(hrHomeHref)} href={hrHomeHref}>
                  <NavPngIcon src="/hr.png" alt="HR Directorate" />
                  <IconButtonTooltip label={isHRBoss ? "HR Directorate" : "My HR Work"} />
                </Link>
              )}

              {canRegistry && (
                <button
                  type="button"
                  onClick={() => goTo("/registry")}
                  className={iconLinkClass("/registry")}
                >
                  <NavPngIcon src="/registry.png" alt="Registry Desk" />
                  <IconButtonTooltip label="Registry Desk" />
                </button>
              )}

              {canExecutive && (
                <Link className={iconLinkClass("/executive")} href="/executive">
                  <NavPngIcon src="/report.png" alt="Executive Command Centre" />
                  <IconButtonTooltip label="Executive Command Centre" />
                </Link>
              )}

              {canAudit && (
                <Link className={iconLinkClass("/audit-centre")} href="/audit-centre">
                  <NavPngIcon src="/audit.png" alt="Enterprise Audit Centre" />
                  <IconButtonTooltip label="Enterprise Audit Centre" />
                </Link>
              )}

              {isAdmin && (
                <Link className={iconLinkClass("/admin")} href="/admin">
                  <NavPngIcon src="/admin.png" alt="Administration" />
                  <IconButtonTooltip label="Admin" />
                </Link>
              )}
            </nav>

            <div className="hidden xl:block"><ActiveRoleBadge /></div>

            <div className="relative md:hidden" ref={mobileRef}>
              <button
                type="button"
                onClick={() => {
                  setOpenMobileMenu((v) => !v);
                                setOpenApprovalPanel(false);
                }}
                className={`inline-flex min-h-11 items-center rounded-xl border-2 px-4 py-2 text-sm font-black shadow-sm transition-all ${openMobileMenu
                    ? "border-blue-600 bg-gradient-to-br from-blue-700 to-cyan-600 text-white shadow-lg shadow-blue-200/70"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-100"
                  }`}
              >
                Menu ▾
              </button>

              {openMobileMenu && (
                <div className="absolute right-0 top-12 z-50 max-h-[80vh] w-[340px] overflow-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                  <div className="mb-3"><ActiveRoleBadge /></div>
                  <div className="mb-2 rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="font-extrabold text-slate-900">Navigation</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {roleSummary(myRole, myRoles)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => goTo("/approvals")}
                    className={mobileItemClass("/approvals")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2">
                        <NavPngIcon src="/action.png" alt="Action Centre" size={22} />
                        Action Centre
                      </span>
                      {actionCount > 0 && (
                        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-black text-white">{compactCount(actionCount)}</span>
                      )}
                    </div>
                    <div className={mobileItemDescriptionClass("/approvals")}>
                      {pendingApprovalCount} waiting for action • {unreadNotificationCount} unread updates
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => goTo("/staff")}
                    className={mobileItemClass("/staff")}
                  >
                    <span className="inline-flex items-center gap-2"><NavPngIcon src="/dashboard.png" alt="Staff Workspace" size={22} />Staff Workspace</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goTo("/requests")}
                    className={mobileItemClass("/requests")}
                  >
                    <span className="inline-flex items-center gap-2"><NavPngIcon src="/request.png" alt="My Requests" size={22} />My Requests</span>
                  </button>

                  {canViewReports && (
                    <button
                      type="button"
                      onClick={() => goTo("/reports")}
                      className={mobileItemClass("/reports")}
                    >
                      <span className="inline-flex items-center gap-2">
                        <NavPngIcon src="/report.png" alt="Reports and Analytics" size={22} />
                        Reports & Analytics
                      </span>
                    </button>
                  )}
{canFinance && (
                    <button
                      type="button"
                      onClick={() => goTo("/finance")}
                      className={mobileItemClass("/finance")}
                    >
                      <div className="inline-flex items-center gap-2">
                        <NavPngIcon src="/finance.png" alt="Finance" size={22} />
                        Finance
                      </div>
                      <div className={mobileItemDescriptionClass("/finance")}>
                        Departments, subheads, accounts, vouchers, reports and audit tabs
                      </div>
                    </button>
                  )}

                  {canHR && (
                    <>
                      <div className="mt-3 border-t pt-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        HR Directorate
                      </div>
                      <button
                        type="button"
                        onClick={() => goTo(hrHomeHref)}
                        className={mobileItemClass(hrHomeHref)}
                      >
                        <div className="inline-flex items-center gap-2">
                          <NavPngIcon src="/hr.png" alt="HR Directorate" size={22} />
                          {isHRBoss ? "HR Command Centre" : "My HR Work"}
                        </div>
                        <div className={mobileItemDescriptionClass(hrHomeHref)}>
                          {isHRBoss
                            ? "Open the centralized HR dashboard and all authorized functions"
                            : "Open your assigned HR roles, tasks and submissions"}
                        </div>
                      </button>
                    </>
                  )}

                  {canRegistry && (
                    <>
                      <div className="mt-3 border-t pt-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Registry
                      </div>

                      <button
                        type="button"
                        onClick={() => goTo("/registry")}
                        className={mobileItemClass("/registry")}
                      >
                        <span className="inline-flex items-center gap-2">
                          <NavPngIcon src="/registry.png" alt="Registry Desk" size={22} />
                          Registry Desk
                        </span>
                        <div className={mobileItemDescriptionClass("/registry")}>
                          Department movement, DG reminders and daily submission summaries
                        </div>
                      </button>
                    </>
                  )}

                  {canExecutive && (
                    <>
                      <div className="mt-3 border-t pt-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Executive
                      </div>
                      <button
                        type="button"
                        onClick={() => goTo("/executive")}
                        className={mobileItemClass("/executive")}
                      >
                        <span className="inline-flex items-center gap-2">
                          <NavPngIcon src="/report.png" alt="Executive Command Centre" size={22} />
                          Executive Command Centre
                        </span>
                      </button>
                    </>
                  )}

                  {canAudit && (
                    <>
                      <div className="mt-3 border-t pt-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Governance
                      </div>
                      <button
                        type="button"
                        onClick={() => goTo("/audit-centre")}
                        className={mobileItemClass("/audit-centre")}
                      >
                        <span className="inline-flex items-center gap-2">
                          <NavPngIcon src="/audit.png" alt="Enterprise Audit Centre" size={22} />
                          Enterprise Audit Centre
                        </span>
                      </button>
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
                          <NavPngIcon src="/admin.png" alt="Administration" size={22} />
                          Admin
                        </span>
                      </button>
                    </>
                  )}

                  <div className="mt-3 border-t pt-3">
                    <button
                      type="button"
                      onClick={logout}
                      className="w-full rounded-xl bg-rose-600 px-4 py-3 text-left text-sm font-bold text-white hover:bg-rose-700"
                    >
                      <span className="inline-flex items-center gap-2">
                        <IconLogout className="h-5 w-5" />
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
              className="group relative hidden h-11 w-11 items-center justify-center rounded-2xl bg-rose-600 text-white transition hover:bg-rose-700 sm:inline-flex"
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