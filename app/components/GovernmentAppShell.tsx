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
  Building2,
  FileText,
  ShieldCheck,
  Landmark,
  CreditCard,
  Archive,
  BarChart3,
  Workflow,
  UserRound,
  Settings,
  Search,
  Bell,
  MessageSquare,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { NAVIGATION_ITEMS } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { getCurrentAuthContext } from "@/lib/auth";
import { getMockupRouteMeta } from "@/lib/mockupRouteTypes";

import { ActiveRoleSwitcher } from "./ActiveRoleSwitcher";
import ReqGenFooter from "./ReqGenFooter";

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
  "/executive": [
    { href: "/executive", label: "Command Centre" },
    { href: "/executive/requests", label: "Requests" },
    { href: "/executive/finance", label: "Finance" },
    { href: "/executive/registry", label: "Registry" },
    { href: "/executive/reports", label: "Reports" },
    { href: "/executive/analytics", label: "Analytics" },
    { href: "/executive/calendar", label: "Calendar" },
    { href: "/executive/meetings", label: "Meetings" },
    { href: "/executive/notifications", label: "Notifications" },
    { href: "/executive/audit", label: "Audit" },
  ],

  "/requests": [
    { href: "/requests", label: "Requests Overview" },
    { href: "/requests/new", label: "Create New Request" },
  ],

  "/approvals": [
    { href: "/approvals", label: "Approvals Overview" },
    { href: "/approvals/action-centre", label: "Action Centre" },
  ],

  "/finance": [
    { href: "/finance", label: "Finance Overview" },
    { href: "/finance/manage-accounts", label: "IET Bank Accounts" },
    {
      href: "/finance/manage-accounts/assign",
      label: "Assign Bank to Officer",
    },
    { href: "/finance/subheads", label: "Finance Subheads" },
    { href: "/finance/departments", label: "Finance Departments" },
    { href: "/finance/account-ledger", label: "Account Ledger" },
    { href: "/finance/subhead-ledger", label: "Subhead Ledger" },
    { href: "/finance/account-transfers", label: "Account Transfers" },
    { href: "/finance/transactions", label: "Transactions Register" },
    { href: "/finance/manual-voucher", label: "Manual Voucher Centre" },
    { href: "/finance/vouchers", label: "Finance Vouchers" },
    { href: "/finance/reports", label: "Finance Reports" },
    { href: "/finance/reports/monthly", label: "Monthly Reports" },
    { href: "/finance/reports/annual", label: "Annual Reports" },
    { href: "/finance/print-centre", label: "Print / PDF Centre" },
    { href: "/finance/export-centre", label: "Export Centre" },
    { href: "/finance/audit-trail", label: "Audit Trail" },
    { href: "/finance/activity-history", label: "Activity History" },
    { href: "/finance/settings", label: "Finance Settings" },
  ],

  "/payment-vouchers": [
    { href: "/payment-vouchers", label: "Overview" },
    { href: "/payment-vouchers/new", label: "Create Voucher" },
    {
      href: "/payment-vouchers/pending",
      label: "Pending Approval",
    },
    {
      href: "/payment-vouchers/approved",
      label: "Approved Vouchers",
    },
    {
      href: "/payment-vouchers/print-centre",
      label: "Print / PDF Centre",
    },
    {
      href: "/payment-vouchers/history",
      label: "Payment History",
    },
    { href: "/payment-vouchers/settings", label: "Settings" },
  ],

  "/registry": [
    { href: "/registry", label: "Registry Overview" },
    { href: "/registry/incoming", label: "Incoming Register" },
    { href: "/registry/outgoing", label: "Outgoing Register" },
    { href: "/registry/dispatch", label: "Dispatch" },
    {
      href: "/registry/operations",
      label: "Registry Operations",
    },
    { href: "/registry/archive", label: "Archive" },
  ],

  "/reports": [
    { href: "/reports", label: "Reports Centre" },
    {
      href: "/reports/enterprise-analytics",
      label: "Analytics",
    },
  ],

  "/audit-centre": [
    { href: "/audit-centre", label: "Audit Centre" },
  ],

  "/workflow": [
    { href: "/workflow", label: "Workflow Centre" },
  ],

  "/profile": [
    { href: "/profile", label: "Profile" },
    { href: "/profile/access", label: "Access" },
    { href: "/profile/activity", label: "Activity" },
    { href: "/profile/security", label: "Security" },
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
    href: "/executive",
    label: "Command Centre",
    icon: Building2,
  },
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
    href: "/workflow",
    label: "Workflow",
    icon: Workflow,
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

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return (
      pathname === href ||
      pathname.startsWith("/dashboard/")
    );
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
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

  const [userEmail, setUserEmail] =
    useState("");

  const [greeting, setGreeting] =
    useState("Good Morning ☀️");

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

      setUserEmail(
        user?.email || ""
      );
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
    const parent = Object.keys(MODULE_SUBNAV).find(
      (href) => pathname === href || pathname.startsWith(`${href}/`)
    );

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

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const renderNav = () =>
    visibleNav.map((item) => {
      const Icon = item.icon;

      const active =
        isActive(
          pathname,
          item.href
        );

      const subnav =
        (
          MODULE_SUBNAV[
          item.href
          ] || []
        ).filter((child) =>
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
          className={`rg-nav-group ${active
              ? "is-active"
              : ""
            }`}
        >
          <div
            className={`rg-nav-row ${active
                ? "is-active"
                : ""
              }`}
          >
            <Link
              href={item.href}
              className="rg-nav-link"
              onClick={() => {
                if (subnav.length) {
                  setExpandedNav(
                    item.href
                  );
                }
              }}
            >
              <Icon size={18} />
              <span>
                {item.label}
              </span>
            </Link>

            {subnav.length ? (
              <button
                type="button"
                className="rg-nav-toggle"
                aria-label={`${expanded
                    ? "Collapse"
                    : "Expand"
                  } ${item.label}`}
                onClick={() =>
                  setExpandedNav(
                    expanded
                      ? null
                      : item.href
                  )
                }
              >
                <ChevronDown
                  size={16}
                  className={
                    expanded
                      ? "is-open"
                      : ""
                  }
                />
              </button>
            ) : null}
          </div>

          {subnav.length &&
            expanded ? (
            <div className="rg-subnav">
              {subnav.map(
                (child) => (
                  <Link
                    key={
                      child.href
                    }
                    href={
                      child.href
                    }
                    className={
                      pathname ===
                        child.href
                        ? "is-active"
                        : ""
                    }
                  >
                    {child.label}
                  </Link>
                )
              )}
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
            aria-label="ReqGen 1.1.0 dashboard"
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
                ReqGen 1.1.0
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

        <div className="rg-sidebar-user">
          <div className="rg-avatar">
            {initials}
          </div>

          <div>
            <strong>
              {userName}
            </strong>

            <span>
              {userEmail ||
                "Authorised user"}
            </span>
          </div>

          <button
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut size={16} />
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
              href="/dashboard/activity"
              className="rg-icon-btn rg-bell"
              aria-label="Notifications"
            >
              <Bell size={19} />
              <b>3</b>
            </Link>

            <Link
              href="/dashboard/activity"
              className="rg-icon-btn"
              aria-label="Activity and messages"
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
            {children}
          </div>

          <ReqGenFooter />
        </main>
      </section>
    </div>
  );
}