"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Landmark,
  CreditCard,
  Archive,
  BarChart3,
  UserRound,
  Settings,
  Search,
  Bell,
  MessageSquare,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { NAVIGATION_ITEMS } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { getCurrentAuthContext } from "@/lib/auth";
import { getMockupRouteMeta } from "@/lib/mockupRouteTypes";
import { getRouteRegistryItem } from "@/lib/routeRegistry";

import { ActiveRoleSwitcher } from "./ActiveRoleSwitcher";
import ReqGenFooter from "./ReqGenFooter";
import { REQGEN_PRODUCT_NAME, REQGEN_VERSION } from "@/lib/version";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/mfa",
  "/mfa/setup",
  "/unauthorized",
]);

type SubNavItem = {
  href: string;
  label: string;
};

const MODULE_SUBNAV: Record<string, SubNavItem[]> = {
  "/requests": [],

  "/approvals": [],

  "/finance": [
    { href: "/finance", label: "Finance Overview" },
    { href: "/finance/manage-accounts", label: "IET Accounts" },
    { href: "/finance/subheads", label: "Budget & Subheads" },
    { href: "/finance/transactions", label: "Transactions & Ledgers" },
    { href: "/finance/account-transfers", label: "Transfers" },
    { href: "/finance/processing", label: "Finance Processing" },
    { href: "/finance/reports", label: "Reports & Output" },
    { href: "/finance/settings", label: "Finance Settings" },
  ],

  "/payment-vouchers": [
    { href: "/payment-vouchers", label: "Payment Voucher Centre" },
    { href: "/payment-vouchers/manual", label: "Create Manual Voucher" },
    { href: "/payment-vouchers/settings", label: "PV Settings" },
  ],

  "/registry": [
    { href: "/registry", label: "Registry Centre" },
    { href: "/registry/archive", label: "Registry Archive" },
  ],

  "/reports": [
    { href: "/reports", label: "Reports Centre" },
    {
      href: "/reports/enterprise-analytics",
      label: "Executive Analytics",
    },
  ],

  "/audit-centre": [
    { href: "/audit-centre", label: "Audit Centre" },
  ],


  "/profile": [
    { href: "/profile", label: "Personal Information" },
    { href: "/profile/access", label: "Access & Roles" },
    { href: "/profile/activity", label: "Activity" },
    { href: "/profile/security", label: "Security & Sessions" },
    {
      href: "/change-password",
      label: "Change Password",
    },
  ],

  "/admin": [
    { href: "/admin", label: "Admin Dashboard" },
    { href: "/admin/users", label: "User Management" },
    {
      href: "/admin/roles",
      label: "Roles & Permissions",
    },
    { href: "/admin/departments", label: "Departments" },
    {
      href: "/admin/account-routing",
      label: "Account Routing",
    },
    {
      href: "/admin/security",
      label: "Security Centre",
    },
    {
      href: "/admin/settings",
      label: "System Settings",
    },
  ],
};

const MAIN_NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/requests",
    label: "Requests",
    icon: FileText,
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: ShieldCheck,
  },
  {
    href: "/finance",
    label: "Finance",
    icon: Landmark,
  },
  {
    href: "/payment-vouchers",
    label: "Payment Vouchers",
    icon: CreditCard,
  },
  {
    href: "/registry",
    label: "Registry",
    icon: Archive,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
  },
  {
    href: "/audit-centre",
    label: "Audit Centre",
    icon: ShieldCheck,
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Settings,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: UserRound,
  },
];

function pathWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navParentForPath(pathname: string): string | null {
  const contextualParents: Array<[string, string]> = [
    ["/change-password", "/profile"],
    ["/output", "/reports"],
    ["/workflow", "/audit-centre"],
    ["/hr", "/approvals"],
    ["/staff", "/dashboard"],
    ["/docs", "/dashboard"],
    ["/about", "/dashboard"],
    ["/test-supabase", "/admin"],
    ["/executive", "/admin"],
  ];

  const contextual = contextualParents
    .filter(([prefix]) => pathWithin(pathname, prefix))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (contextual) return contextual[1];

  // Longest-prefix matching prevents a broad module route from stealing
  // the active state from a more specific canonical module.
  const direct = MAIN_NAV
    .filter((item) => pathWithin(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return direct?.href || null;
}

function activeSubnavHref(moduleHref: string, pathname: string): string | null {
  return (MODULE_SUBNAV[moduleHref] || [])
    .filter((item) => pathWithin(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href || null;
}

function getSubnavForPath(moduleHref: string): SubNavItem[] {
  return MODULE_SUBNAV[moduleHref] || [];
}

function shellStageKey(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
}

function shellRoleKey(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalized === "deanadmin" ? "dinadmin" : normalized;
}

function isOpenApprovalStatus(status: string | null | undefined) {
  const value = String(status || "").toLowerCase();
  return !["approved", "paid", "completed", "closed", "rejected", "deleted", "cancelled"].some((token) => value.includes(token));
}

function requestMatchesApprovalRole(row: { current_owner?: string | null; current_stage?: string | null; status?: string | null }, userId: string, role: string) {
  if (!isOpenApprovalStatus(row.status)) return false;
  if (row.current_owner && row.current_owner === userId) return true;

  const stageForRole: Record<string, string[]> = {
    po: ["PO"], dod: ["DOD"], director: ["DOD"], dinadmin: ["DINADMIN"],
    registrar: ["REGISTRAR"], registry: ["REGISTRAR"], generalsecretary: ["GENERALSECRETARY", "GENSEC"], hod: ["HOD"],
    hr: ["HR", "HRFILING"], hrboss: ["HR", "HRFILING"], hrofficer: ["HR", "HRFILING"],
    hrofficer1: ["HR", "HRFILING"], hrofficer2: ["HR", "HRFILING"], hrofficer3: ["HR", "HRFILING"],
    dg: ["DG"], account: ["ACCOUNT"], accounts: ["ACCOUNT"], accountofficer: ["ACCOUNT"],
  };
  const normalizedRole = shellRoleKey(role);
  if (["admin", "auditor"].includes(normalizedRole)) return true;
  return (stageForRole[normalizedRole] || []).includes(shellStageKey(row.current_stage));
}

/**
 * Next.js 16 requires useSearchParams() to execute below a Suspense
 * boundary during static prerendering.
 *
 * Keeping the boundary here protects every authenticated ReqGen route
 * that uses the global GovernmentAppShell.
 */
export default function GovernmentAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<GovernmentShellFallback />}>
      <GovernmentAppShellContent>
        {children}
      </GovernmentAppShellContent>
    </Suspense>
  );
}

function GovernmentShellFallback() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
          <div className="text-sm font-black text-slate-900">
            ReqGen
          </div>

          <div className="mt-1 text-xs font-semibold text-slate-500">
            Loading secure workspace...
          </div>
        </div>
      </div>
    </div>
  );
}

function GovernmentAppShellContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Safe now because this component is rendered below Suspense.
  const searchParams = useSearchParams();

  const embedded =
    searchParams.get("embedded") === "1";

  const isPublic = PUBLIC_PATHS.has(pathname);

  const mockupMeta =
    getMockupRouteMeta(pathname);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const [expandedNav, setExpandedNav] =
    useState<string | null>(null);

  const [roleSet, setRoleSet] =
    useState<Set<string>>(new Set());

  const [contextReady, setContextReady] =
    useState(false);

  const [userName, setUserName] =
    useState("ReqGen User");


  const [greeting, setGreeting] =
    useState("Good Morning ☀️");

  const [pendingApprovalCount, setPendingApprovalCount] =
    useState(0);

  useEffect(() => {
    if (isPublic) return;

    let mounted = true;

    async function loadContext() {
      const [context, auth] =
        await Promise.all([
          getCurrentAuthContext(),
          supabase.auth.getUser(),
        ]);

      if (!mounted) return;

      const next =
        new Set<string>();

      if (context?.activeRoleKey) {
        next.add(context.activeRoleKey);
      }

      setRoleSet(next);
      setContextReady(true);

      const user = auth.data.user;

      let profileName = "";

      if (user?.id) {
        const profile = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        profileName = String(
          profile.data?.full_name || ""
        ).trim();
      }

      const metadataName = String(
        user?.user_metadata?.full_name || user?.user_metadata?.name || ""
      ).trim();

      setUserName(profileName || metadataName || "Authorised User");


      if (user?.id) {
        const activeRole = context?.activeRoleKey || "staff";
        const approvalResult = await supabase
          .from("requests")
          .select("current_owner,current_stage,status")
          .order("created_at", { ascending: false });

        if (mounted && !approvalResult.error) {
          const approvalRows = (approvalResult.data || []) as Array<{
            current_owner?: string | null;
            current_stage?: string | null;
            status?: string | null;
          }>;
          setPendingApprovalCount(
            approvalRows.filter((row) => requestMatchesApprovalRole(row, user.id, activeRole)).length
          );
        }
      }
    }

    void loadContext();

    const refresh = () => {
      setContextReady(false);
      void loadContext();
    };

    window.addEventListener(
      "reqgen-active-role-changed",
      refresh
    );

    return () => {
      mounted = false;

      window.removeEventListener(
        "reqgen-active-role-changed",
        refresh
      );
    };
  }, [isPublic]);

  useEffect(() => {
    if (isPublic) return;

    const channel = supabase
      .channel("reqgen-shell-approval-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => {
        window.dispatchEvent(new Event("reqgen-active-role-changed"));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isPublic]);

  useEffect(() => {
    const hour =
      new Date().getHours();

    const nextGreeting =
      hour < 12
        ? "Good Morning 🌅"
        : hour < 17
          ? "Good Afternoon ☀️"
          : "Good Evening 🌙";

    queueMicrotask(() => setGreeting(nextGreeting));
  }, []);

  useEffect(() => {
    const parent = navParentForPath(pathname);

    queueMicrotask(() => {
      setMobileOpen(false);
      setSearchOpen(false);
      setQuery("");
      setExpandedNav(parent || null);
    });
  }, [pathname]);

  const visibleNav = useMemo(
    () =>
      contextReady
        ? MAIN_NAV.filter((item) =>
          canAccessPath(
            item.href,
            roleSet
          )
        )
        : [],
    [contextReady, roleSet]
  );

  const searchResults =
    useMemo(() => {
      const q =
        query
          .trim()
          .toLowerCase();

      if (!q || !contextReady) {
        return [];
      }

      return NAVIGATION_ITEMS
        .filter((item) =>
          canAccessPath(
            item.href,
            roleSet
          )
        )
        .filter((item) =>
          `${item.label} ${item.description} ${item.section} ${(item.keywords || []).join(" ")}`
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8);
    }, [
      query,
      contextReady,
      roleSet,
    ]);

  /*
   * Public pages and modal/drawer embedded routes bypass the
   * authenticated Government shell exactly as before.
   */
  if (isPublic || embedded) {
    return <>{children}</>;
  }

  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase()
      )
      .join("") || "RG";

  const moduleKey =
    pathname
      .split("/")
      .filter(Boolean)[0] ||
    "dashboard";

  const routeRegistryItem = getRouteRegistryItem(pathname);
  const currentNavigationItem = NAVIGATION_ITEMS.find((item) => item.href === pathname);
  const activeMainNavigation = visibleNav.find((item) => navParentForPath(pathname) === item.href);
  const currentLocationLabel =
    currentNavigationItem?.label ||
    routeRegistryItem?.title ||
    pathname.split("/").filter(Boolean).at(-1)?.replace(/[-_]+/g, " ") ||
    "Dashboard";

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const renderNav = () =>
    visibleNav.map((item) => {
      const Icon = item.icon;

      const active = navParentForPath(pathname) === item.href;

      const subnav =
        getSubnavForPath(item.href).filter((child) =>
          canAccessPath(
            child.href,
            roleSet
          )
        );

      const expanded =
        expandedNav === item.href;

      return (
        <div
          key={item.href}
          className={`rg-nav-group ${active ? "is-active" : ""}`}
        >
          <div className={`rg-nav-row ${active ? "is-active" : ""}`}>
            {subnav.length ? (
              <button
                type="button"
                className="rg-nav-link rg-nav-parent"
                aria-expanded={expanded}
                aria-controls={`rg-subnav-${item.label.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => {
                  // A click from another module both navigates to the module root
                  // and expands it. A second click while already in the module
                  // only retracts/expands the submenu, preserving user context.
                  if (!active) {
                    setExpandedNav(item.href);
                    router.push(item.href);
                    return;
                  }
                  setExpandedNav(expanded ? null : item.href);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.href === "/approvals" && pendingApprovalCount > 0 ? (
                  <b className="rg-nav-count" aria-label={`${pendingApprovalCount} pending approvals`}>
                    {pendingApprovalCount > 99 ? "99+" : pendingApprovalCount}
                  </b>
                ) : null}
              </button>
            ) : (
              <Link href={item.href} className="rg-nav-link">
                <Icon size={18} />
                <span>{item.label}</span>
                {item.href === "/approvals" && pendingApprovalCount > 0 ? (
                  <b className="rg-nav-count" aria-label={`${pendingApprovalCount} pending approvals`}>
                    {pendingApprovalCount > 99 ? "99+" : pendingApprovalCount}
                  </b>
                ) : null}
              </Link>
            )}

            {subnav.length ? (
              <button
                type="button"
                className="rg-nav-toggle"
                aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label}`}
                aria-expanded={expanded}
                onClick={() => setExpandedNav(expanded ? null : item.href)}
              >
                <ChevronDown size={16} className={expanded ? "is-open" : ""} />
              </button>
            ) : null}
          </div>

          {subnav.length && expanded ? (
            <div
              id={`rg-subnav-${item.label.replace(/\s+/g, "-").toLowerCase()}`}
              className="rg-subnav"
            >
              {subnav.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  className={activeSubnavHref(item.href, pathname) === child.href ? "is-active" : ""}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      );
    });

  return (
    <div className="rg-shell">
      <button
        className={`rg-backdrop ${mobileOpen
            ? "is-open"
            : ""
          }`}
        onClick={() =>
          setMobileOpen(false)
        }
        aria-label="Close navigation"
      />

      <aside
        className={`rg-sidebar ${mobileOpen
            ? "is-open"
            : ""
          }`}
      >
        <div className="rg-brand">
          <Link
            href="/dashboard"
            className="rg-brand-mark"
            aria-label={`${REQGEN_PRODUCT_NAME} dashboard`}
          >
            <span className="rg-brand-logo">
              <Image
                src="/be-logo.png"
                alt="Barderian Enterprises"
                width={38}
                height={32}
                priority
              />
            </span>

            <span className="rg-brand-copy">
              <strong>
                {REQGEN_PRODUCT_NAME}
              </strong>

              <small>
                Request Management
                System
              </small>
            </span>
          </Link>

          <button
            className="rg-mobile-close"
            onClick={() =>
              setMobileOpen(false)
            }
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>

        <nav
          className="rg-nav"
          aria-label="ReqGen modules"
        >
          {renderNav()}
        </nav>

        <div className="rg-sidebar-release" aria-label={`ReqGen version ${REQGEN_VERSION}`}>
          <span>Version</span>
          <strong>{REQGEN_VERSION}</strong>
          <small>Patch 05 · Phase 4</small>
        </div>

        <div className="rg-sidebar-signout">
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out of ReqGen"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <section className="rg-stage">
        <header className="rg-topbar">
          <button
            className="rg-menu"
            onClick={() =>
              setMobileOpen(true)
            }
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div
            className="rg-greeting"
            aria-label="Current greeting"
          >
            {greeting}
          </div>

          <div className="rg-search-wrap">
            <button
              className="rg-search-trigger"
              onClick={() =>
                setSearchOpen(
                  (value) =>
                    !value
                )
              }
            >
              <Search size={16} />

              <span>
                Search requests,
                transactions,
                documents...
              </span>
            </button>

            {searchOpen ? (
              <div className="rg-search-popover">
                <div className="rg-search-input">
                  <Search
                    size={17}
                  />

                  <input
                    autoFocus
                    value={query}
                    onChange={(
                      event
                    ) =>
                      setQuery(
                        event.target
                          .value
                      )
                    }
                    placeholder="Search authorised ReqGen pages..."
                  />
                </div>

                <div className="rg-search-results">
                  {query &&
                    searchResults.length ===
                    0 ? (
                    <p>
                      No authorised
                      result found.
                    </p>
                  ) : null}

                  {searchResults.map(
                    (item) => (
                      <Link
                        key={
                          item.href
                        }
                        href={
                          item.href
                        }
                      >
                        <strong>
                          {
                            item.label
                          }
                        </strong>

                        <span>
                          {
                            item.section
                          }{" "}
                          ·{" "}
                          {
                            item.description
                          }
                        </span>
                      </Link>
                    )
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rg-top-actions">
            <Link
              href="/approvals"
              className="rg-icon-btn rg-bell"
              aria-label={`${pendingApprovalCount} request${pendingApprovalCount === 1 ? "" : "s"} awaiting your approval`}
              title={`${pendingApprovalCount} request${pendingApprovalCount === 1 ? "" : "s"} awaiting your approval`}
            >
              <Bell size={20} />
              {pendingApprovalCount > 0 ? <b>{pendingApprovalCount > 99 ? "99+" : pendingApprovalCount}</b> : null}
            </Link>

            <Link
              href="/profile/activity"
              className="rg-icon-btn"
              aria-label="My activity"
            >
              <MessageSquare
                size={19}
              />
            </Link>

            <ActiveRoleSwitcher
              compact
            />

            <Link
              href="/profile"
              className="rg-profile"
            >
              <div className="rg-avatar">
                {initials}
              </div>

              <div>
                <strong>
                  {userName}
                </strong>

                <span>
                  Authorised user
                </span>
              </div>
            </Link>
          </div>
        </header>

        <main
          id="reqgen-main-content"
          className="rg-main"
          role="main"
        >
          <div
            className={`rg-content module-${moduleKey}`}
            data-route={pathname}
            data-mockup-section={
              mockupMeta?.section ||
              undefined
            }
            data-mockup-type={
              mockupMeta?.type ||
              undefined
            }
          >
            <div className="rg-location-bar" aria-label="Current location">
              <div className="rg-location-path">
                {activeMainNavigation ? (
                  <Link href={activeMainNavigation.href}>{activeMainNavigation.label}</Link>
                ) : (
                  <span>ReqGen</span>
                )}
                <ChevronRight size={14} aria-hidden="true" />
                <strong>{currentLocationLabel}</strong>
              </div>
              <button type="button" className="rg-important-note" aria-describedby="rg-important-note-tooltip">
                <span aria-hidden="true">i</span> Important Note
                <span id="rg-important-note-tooltip" role="tooltip">
                  {getRouteRegistryItem(pathname)?.description || `You are currently working in ${currentLocationLabel}. Actions and data shown here follow your active role and live ReqGen permissions.`}
                </span>
              </button>
            </div>
            {children}
          </div>

          <ReqGenFooter />
        </main>
      </section>
    </div>
  );
}
