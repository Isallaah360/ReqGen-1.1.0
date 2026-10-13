/**
 * ReqGen v4.0.0 — the ten modules, their mother pages and tiles.
 *
 * One place decides the sidebar, every mother page, the breadcrumb trail and
 * the search list, so a page can never belong to two modules. Who can open a
 * tile is still decided by lib/permissions.ts (canAccessPath) and the
 * database's row-level security — this file only arranges.
 */

export type Tone = "brand" | "blue" | "green" | "amber" | "red";

export type ModuleTile = {
  href: string;
  title: string;
  purpose: string;
  icon: string;
  tone: Tone;
  keywords?: string[];
};

export type ModuleDef = {
  key: string;
  label: string;
  href: string;
  icon: string;
  group?: "Offices" | "Oversight";
  intro: string;
  tiles: ModuleTile[];
};

export const MODULES: ModuleDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    intro: "What needs you today.",
    tiles: [
      { href: "/dashboard/activity", title: "Recent Activity", purpose: "What happened across the requests you can see.", icon: "activity", tone: "blue" },
    ],
  },
  {
    key: "requests",
    label: "Requests",
    href: "/requests",
    icon: "file",
    intro: "Ask for funds or approval, and follow every request until it is paid.",
    tiles: [
      { href: "/requests/mine", title: "My Requests", purpose: "Every request you made, with where it is now.", icon: "list", tone: "blue", keywords: ["drafts", "returned", "status"] },
      { href: "/requests/new", title: "New Request", purpose: "Start a request. Takes about 3 minutes.", icon: "plus", tone: "brand", keywords: ["create", "raise"] },
      { href: "/requests/printable", title: "Print Register", purpose: "Print or save completed requests as A4.", icon: "printer", tone: "green", keywords: ["print", "pdf"] },
    ],
  },
  {
    key: "approvals",
    label: "Approvals",
    href: "/approvals",
    icon: "shield",
    intro: "Everything waiting for your decision or signature, oldest first.",
    tiles: [
      { href: "/approvals/inbox", title: "Requests to Approve", purpose: "Requests routed to you, oldest first.", icon: "file", tone: "brand", keywords: ["inbox", "approve", "reject"] },
      { href: "/approvals/vouchers", title: "Vouchers to Sign", purpose: "Vouchers waiting for your check or signature.", icon: "pen", tone: "blue", keywords: ["sign", "counter sign", "authorise"] },
      { href: "/approvals/treated", title: "Treated by Me", purpose: "Everything you approved, returned, rejected or signed.", icon: "history", tone: "green", keywords: ["history", "my decisions"] },
    ],
  },
  {
    key: "notifications",
    label: "Notifications",
    href: "/notifications",
    icon: "bell",
    intro: "Every alert sent to you.",
    tiles: [],
  },
  {
    key: "finance",
    label: "Finance",
    href: "/finance",
    icon: "landmark",
    group: "Offices",
    intro: "Release funds and keep budgets, accounts and ledgers in order.",
    tiles: [
      { href: "/finance/processing", title: "Finance Processing", purpose: "Treat approved requests and post payments.", icon: "clock", tone: "brand", keywords: ["treat", "queue"] },
      { href: "/finance/manage-accounts", title: "Bank Accounts", purpose: "IET accounts, funds and balances.", icon: "landmark", tone: "green", keywords: ["iet accounts", "fund", "allocate"] },
      { href: "/finance/manage-accounts/assign", title: "Officer Assignment", purpose: "Which Account Officer handles each account.", icon: "users", tone: "blue", keywords: ["account officer"] },
      { href: "/finance/subheads", title: "Budget & Subheads", purpose: "Allocations, reservations and balances per subhead.", icon: "wallet", tone: "amber", keywords: ["budget", "subhead"] },
      { href: "/finance/transactions", title: "Ledgers", purpose: "Transactions, account and subhead ledgers.", icon: "list", tone: "blue", keywords: ["ledger", "transactions"] },
      { href: "/finance/account-transfers", title: "Transfers", purpose: "Move money between IET accounts or subheads.", icon: "arrows", tone: "brand" },
      { href: "/finance/settings", title: "Finance Settings", purpose: "Financial year, numbering and safeguards.", icon: "settings", tone: "blue" },
    ],
  },
  {
    key: "payment-vouchers",
    label: "Payment Vouchers",
    href: "/payment-vouchers",
    icon: "card",
    intro: "Prepare, sign, pay and print payment vouchers.",
    tiles: [
      { href: "/payment-vouchers/centre", title: "Voucher Centre", purpose: "Every voucher in one list, with search and filters.", icon: "list", tone: "blue", keywords: ["vouchers", "pv"] },
      { href: "/payment-vouchers/new", title: "Generate from Requests", purpose: "Turn approved requests into a voucher.", icon: "plus", tone: "brand" },
      { href: "/payment-vouchers/manual", title: "Manual Voucher", purpose: "A voucher that has no request.", icon: "pen", tone: "brand" },
      { href: "/payment-vouchers/pending", title: "Signing Tracker", purpose: "Who holds each voucher and for how long.", icon: "clock", tone: "amber" },
      { href: "/payment-vouchers/approved", title: "Ready to Pay", purpose: "Signed and authorised. Pay and record receipt.", icon: "wallet", tone: "green" },
      { href: "/payment-vouchers/history", title: "Paid History", purpose: "Paid and cancelled vouchers by month.", icon: "history", tone: "blue" },
      { href: "/payment-vouchers/print-centre", title: "Print Centre", purpose: "Print or save vouchers as A4.", icon: "printer", tone: "blue" },
      { href: "/payment-vouchers/settings", title: "Signatories", purpose: "Counter Signers who may sign vouchers.", icon: "users", tone: "brand" },
    ],
  },
  {
    key: "registry",
    label: "Registry",
    href: "/registry",
    icon: "archive",
    intro: "Track requests, record letters in and out, dispatch and archive. Each tile opens one page.",
    tiles: [
      { href: "/registry/tracking", title: "Request Tracking", purpose: "Where each request is now and how long it has been there.", icon: "route", tone: "amber", keywords: ["tracking", "movement", "stuck", "remind"] },
      { href: "/registry/incoming", title: "Incoming", purpose: "Letters and files received. Acknowledge and forward.", icon: "download", tone: "blue" },
      { href: "/registry/outgoing", title: "Outgoing", purpose: "Letters and files leaving the Trust.", icon: "upload", tone: "brand" },
      { href: "/registry/dispatch", title: "Dispatch", purpose: "Hand over, courier or email — with receiver’s name.", icon: "send", tone: "brand" },
      { href: "/registry/archive", title: "Archive", purpose: "Filed records with retention and shelf location.", icon: "archive", tone: "green" },
      { href: "/registry/filing", title: "Registry Filing", purpose: "Paid requests and vouchers to file — numbers only.", icon: "file", tone: "blue" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    href: "/reports",
    icon: "chart",
    group: "Oversight",
    intro: "Every report in one place. Each person sees only what they are allowed to see.",
    tiles: [
      { href: "/reports/transactions", title: "Transactions + Analysis", purpose: "Every naira in and out, month by month, with charts.", icon: "trend", tone: "brand", keywords: ["money", "spending", "analysis", "charts"] },
      { href: "/reports/requests", title: "Request Reports", purpose: "Submitted, approved, returned and rejected, by department.", icon: "file", tone: "blue" },
      { href: "/reports/finance-statements", title: "Finance Statements", purpose: "Monthly, annual and subhead statements, IET financial year.", icon: "landmark", tone: "green", keywords: ["monthly", "annual", "statement"] },
      { href: "/reports/vouchers", title: "Voucher Reports", purpose: "Vouchers by mode and status, signing times, top payees.", icon: "card", tone: "brand" },
      { href: "/reports/registry", title: "Registry Reports", purpose: "Incoming, outgoing, dispatched and archived — counts only.", icon: "archive", tone: "blue" },
      { href: "/reports/enterprise-analytics", title: "Executive Analytics", purpose: "Budget pace, risk subheads and exceptions on one page.", icon: "trend", tone: "amber" },
      { href: "/requests/printable", title: "Print Register", purpose: "What has been printed, by whom and how many times.", icon: "printer", tone: "blue" },
      { href: "/reports/compliance", title: "Compliance", purpose: "Automatic checks on vouchers, signatures and security.", icon: "shield", tone: "green" },
    ],
  },
  {
    key: "audit",
    label: "Audit",
    href: "/audit-centre",
    icon: "audit",
    group: "Oversight",
    intro: "One audit log for the whole system, the full journey of any request or voucher, reconciliation and backups.",
    tiles: [
      { href: "/audit-centre/logs", title: "Audit Log", purpose: "Every action by every user. Nothing can be edited or deleted.", icon: "list", tone: "blue" },
      { href: "/workflow", title: "Workflow Trace", purpose: "The full journey of a request or voucher, step by step.", icon: "route", tone: "amber" },
      { href: "/audit-centre/reconciliation", title: "Finance Reconciliation", purpose: "Bank balances against the ledger, month by month.", icon: "scale", tone: "brand" },
      { href: "/audit-centre/backup", title: "Master Backup", purpose: "Download, preview and restore by financial year.", icon: "database", tone: "green" },
    ],
  },
  {
    key: "admin",
    label: "Administration",
    href: "/admin",
    icon: "admin",
    group: "Oversight",
    intro: "Signed in as the ReqGen Super Admin — the Trust’s own account, not a person’s. Each tile opens one page.",
    tiles: [
      { href: "/admin/system-accounts", title: "System Accounts", purpose: "Super Admin and Developer — what each can and cannot do.", icon: "shield", tone: "brand" },
      { href: "/admin/users", title: "Staff & Positions", purpose: "Every staff member with the positions they hold.", icon: "users", tone: "blue", keywords: ["users", "roles", "staff"] },
      { href: "/admin/positions", title: "Positions", purpose: "The list of positions and who holds each one.", icon: "key", tone: "brand" },
      { href: "/admin/roles", title: "Permissions Matrix", purpose: "What each position can see and do. One matrix only.", icon: "grid", tone: "blue", keywords: ["permissions"] },
      { href: "/admin/departments", title: "Departments", purpose: "Departments, their directors, heads and accounts.", icon: "building", tone: "green" },
      { href: "/admin/routing", title: "Routing Engine", purpose: "Who approves what, in which order. Set here only.", icon: "route", tone: "amber", keywords: ["routes", "backups", "away", "account routing"] },
      { href: "/admin/security", title: "Security Centre", purpose: "2FA, fingerprint, passcode and trusted devices.", icon: "lock", tone: "red" },
      { href: "/admin/system-health", title: "Diagnostics", purpose: "System health and data checks.", icon: "activity", tone: "blue" },
    ],
  },
];

/** My Account sits at the bottom of the sidebar, not in the module list. */
export const ACCOUNT_MODULE: ModuleDef = {
  key: "account",
  label: "My Account",
  href: "/profile",
  icon: "user",
  intro: "Your details, signature, security and access.",
  tiles: [
    { href: "/profile/details", title: "Profile", purpose: "Your name, phone and contact details.", icon: "user", tone: "blue" },
    { href: "/profile/details#signature", title: "Signature & Photo", purpose: "The signature printed on what you sign, and your photo.", icon: "pentool", tone: "brand" },
    { href: "/profile/security", title: "Security & Devices", purpose: "2FA, fingerprint, passcode and signed-in devices.", icon: "lock", tone: "green" },
    { href: "/profile/access", title: "My Access", purpose: "Your positions, and switch the position you are acting as.", icon: "key", tone: "amber" },
    { href: "/profile/activity", title: "My Activity", purpose: "Everything you did in ReqGen, by day.", icon: "history", tone: "blue" },
    { href: "/profile/setup", title: "Setup Guide", purpose: "The steps that make an account ready.", icon: "check", tone: "green" },
  ],
};

/** Pages that live outside the module tiles but still need a home in the trail. */
const EXTRA_TITLES: Record<string, { module: string; title: string }> = {
  "/change-password": { module: "account", title: "Change Password" },
  "/about": { module: "dashboard", title: "About ReqGen" },
  "/docs": { module: "dashboard", title: "Help" },
  "/workflow": { module: "audit", title: "Workflow Trace" },
  "/output": { module: "reports", title: "Output" },
  "/reports/analysis": { module: "reports", title: "Analysis" },
  "/reports/print": { module: "reports", title: "Print report" },
  "/reports/centre": { module: "reports", title: "Reports" },
  "/finance/overview": { module: "finance", title: "Finance Overview" },
  "/finance/reports": { module: "reports", title: "Finance Statements" },
  "/payment-vouchers/print-centre/batch": { module: "payment-vouchers", title: "Print several" },
  "/finance/account-ledger": { module: "finance", title: "Account Ledger" },
  "/finance/subhead-ledger": { module: "finance", title: "Subhead Ledger" },
  "/finance/activity-history": { module: "audit", title: "Finance Activity" },
  "/finance/audit-trail": { module: "audit", title: "Finance Audit Trail" },
  "/finance/assign-account": { module: "finance", title: "Assign Account" },
  "/finance/accounts": { module: "finance", title: "IET Accounts" },
  "/finance/departments": { module: "finance", title: "Departments" },
  "/finance/export-centre": { module: "finance", title: "Export Centre" },
  "/finance/print-centre": { module: "finance", title: "Print Centre" },
  "/finance/vouchers": { module: "payment-vouchers", title: "Vouchers" },
  "/finance/manual-voucher": { module: "payment-vouchers", title: "Manual Voucher" },
  "/finance/reports/monthly": { module: "finance", title: "Monthly Report" },
  "/finance/reports/annual": { module: "finance", title: "Annual Report" },
  "/finance/reports/print": { module: "finance", title: "Print Report" },
  "/registry/operations": { module: "registry", title: "Registry Operations" },
  "/registry/centre": { module: "registry", title: "Registry Centre" },
  "/admin/department-routing": { module: "admin", title: "Routing Engine" },
  "/admin/account-routing": { module: "admin", title: "Routing Engine" },
  "/admin/settings": { module: "admin", title: "Routing Engine" },
  "/admin/overview": { module: "admin", title: "Administration" },
  "/admin/audit": { module: "audit", title: "Audit Log" },
  "/admin/workflow-test": { module: "admin", title: "Workflow Test" },
  "/admin/release-readiness": { module: "admin", title: "Release Readiness" },
  "/admin/access-audit": { module: "admin", title: "Access Audit" },
  "/profile/security/replace-authenticator": { module: "account", title: "Replace Authenticator" },
  "/profile/passcode": { module: "account", title: "Passcode" },
  "/approvals/action-centre": { module: "approvals", title: "Requests to Approve" },
  "/test-supabase": { module: "admin", title: "Connection Test" },
};

export const ALL_MODULES: ModuleDef[] = [...MODULES, ACCOUNT_MODULE];

function within(pathname: string, href: string) {
  const base = href.split("#")[0];
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function moduleForPath(pathname: string): ModuleDef | null {
  const extra = Object.entries(EXTRA_TITLES)
    .filter(([p]) => within(pathname, p))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (extra) return ALL_MODULES.find((m) => m.key === extra[1].module) || null;
  // longest tile or module prefix wins, so /finance/audit belongs to Audit
  let best: { module: ModuleDef; len: number } | null = null;
  for (const m of ALL_MODULES) {
    for (const href of [m.href, ...m.tiles.map((t) => t.href)]) {
      const base = href.split("#")[0];
      if (within(pathname, base) && (!best || base.length > best.len)) best = { module: m, len: base.length };
    }
  }
  return best?.module || null;
}

export type Crumb = { label: string; href?: string };

function prettify(segment: string) {
  const s = decodeURIComponent(segment).replace(/[-_]+/g, " ");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(segment)) return "Record";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Home › Module › Page › Record › Action */
export function breadcrumbsFor(pathname: string, recordLabel?: string | null): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Home", href: "/dashboard" }];
  const mod = moduleForPath(pathname);
  if (!mod) return crumbs;
  if (mod.key !== "dashboard" || pathname !== "/dashboard") {
    crumbs.push({ label: mod.label, href: pathname === mod.href ? undefined : mod.href });
  }
  if (pathname === mod.href) return crumbs;

  const extra = Object.entries(EXTRA_TITLES)
    .filter(([p]) => within(pathname, p))
    .sort((a, b) => b[0].length - a[0].length)[0];
  const tile = mod.tiles
    .filter((t) => within(pathname, t.href.split("#")[0]))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const pageHref = extra ? extra[0] : tile ? tile.href.split("#")[0] : null;
  const pageTitle = extra ? extra[1].title : tile ? tile.title : null;

  if (pageHref && pageTitle) {
    crumbs.push({ label: pageTitle, href: pathname === pageHref ? undefined : pageHref });
    const rest = pathname.slice(pageHref.length).split("/").filter(Boolean);
    rest.forEach((seg, i) => {
      const last = i === rest.length - 1;
      const href = pageHref + "/" + rest.slice(0, i + 1).join("/");
      const label = i === 0 && recordLabel ? recordLabel : prettify(seg);
      crumbs.push({ label, href: last ? undefined : href });
    });
  } else {
    const rest = pathname.slice(mod.href.length).split("/").filter(Boolean);
    rest.forEach((seg, i) => {
      const last = i === rest.length - 1;
      const href = mod.href + "/" + rest.slice(0, i + 1).join("/");
      crumbs.push({ label: i === 0 && recordLabel ? recordLabel : prettify(seg), href: last ? undefined : href });
    });
  }
  return crumbs;
}

/** Search list: every module, tile and extra page. */
export function searchablePages() {
  const pages: Array<{ href: string; title: string; module: string; purpose: string; keywords: string[] }> = [];
  for (const m of ALL_MODULES) {
    pages.push({ href: m.href, title: m.label, module: m.label, purpose: m.intro, keywords: [] });
    for (const t of m.tiles) pages.push({ href: t.href, title: t.title, module: m.label, purpose: t.purpose, keywords: t.keywords || [] });
  }
  return pages;
}

/**
 * Pages already rebuilt in the v4 design. Everything else is a v3 page shown
 * inside the v4 frame (wrapped in .rg-content so its own styles still apply)
 * until its module is rebuilt in 4.1 – 4.6.
 */
const V4_NATIVE_EXACT = new Set<string>([
  ...ALL_MODULES.map((m) => m.href),
  "/requests/mine",
  "/approvals/inbox",
  "/approvals/vouchers",
  "/approvals/treated",
  "/notifications",
  "/profile/security",
  "/profile/passcode",
]);

/** Pages drawn with the v4 kit (no legacy wrapper). Grows with each v4 release. */
const V4_NATIVE_PATTERNS: RegExp[] = [
  /^\/requests\/new$/,
  /^\/requests\/(?!mine$|new$|printable$)[^/]+$/,
  /^\/requests\/[^/]+\/edit$/,
  // v4.2 Finance
  /^\/finance\/(processing|manage-accounts|manage-accounts\/assign|subheads|transactions|account-transfers|settings)$/,
  /^\/finance\/subheads\/[^/]+$/,
  /^\/finance\/request\/[^/]+$/,
  // v4.3 Payment Vouchers
  /^\/payment-vouchers\/(centre|new|manual|pending|approved|history|print-centre|settings)$/,
  /^\/payment-vouchers\/(?!centre$|new$|manual$|pending$|approved$|history$|print-centre$|settings$|reports$)[^/]+$/,
  /^\/approvals\/vouchers\/[^/]+$/,
  // v4.5 Registry and Audit
  /^\/registry\/(tracking|incoming|outgoing|dispatch|archive|filing)$/,
  /^\/audit-centre\/(logs|reconciliation|backup)$/,
  /^\/workflow$/,
  // v4.4 Reports
  /^\/reports\/(transactions|analysis|requests|finance-statements|vouchers|registry|enterprise-analytics|compliance|print)$/,
  /^\/requests\/printable$/,
  // v4.6 Administration
  /^\/admin\/(system-accounts|users|positions|roles|departments|routing|security|system-health)$/,
  /^\/admin\/users\/[^/]+$/,
];

export function isV4Page(pathname: string) {
  return V4_NATIVE_EXACT.has(pathname) || V4_NATIVE_PATTERNS.some((re) => re.test(pathname));
}
