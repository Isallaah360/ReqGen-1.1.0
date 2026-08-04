"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ActiveRoleSwitcher } from "@/app/components/ActiveRoleSwitcher";
import {
  Activity, ArrowUpRight, BarChart3, Bell, BookOpenCheck, Building2,
  CheckCircle2, ChevronDown, CircleDollarSign, ClipboardCheck, Clock3,
  Download, Eye, FileBarChart, FileText, Filter, LayoutDashboard, LockKeyhole,
  LogOut, Menu, MoreHorizontal, Pencil, Plus, Search, Settings, ShieldCheck,
  SlidersHorizontal, UserRound, UsersRound, WalletCards, X,
} from "lucide-react";

type ModuleKey = "dashboard" | "requests" | "approvals" | "vouchers" | "staff" | "finance" | "reports" | "audit" | "profile" | "notifications" | "settings";
type ModuleConfig = { key: ModuleKey; label: string; title: string; subtitle: string; icon: typeof LayoutDashboard; action?: string };
type Tone = "blue" | "gold" | "green" | "red" | "violet";
type CurrentUser = { fullName: string; email: string; role: string; initials: string };

const fallbackUser: CurrentUser = { fullName: "ReqGen User", email: "", role: "Staff", initials: "RU" };

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "RU";
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

const modules: ModuleConfig[] = [
  { key: "dashboard", label: "Dashboard", title: "EXECUTIVE COMMAND CENTRE", subtitle: "Enterprise overview, performance and operational intelligence", icon: LayoutDashboard },
  { key: "requests", label: "Requests", title: "REQUESTS MANAGEMENT", subtitle: "Create, track and manage official and personal requests", icon: FileText, action: "New Request" },
  { key: "approvals", label: "Approvals", title: "APPROVAL CENTRE", subtitle: "Review, authorize and escalate pending workflow items", icon: ClipboardCheck },
  { key: "vouchers", label: "Payment Vouchers", title: "PAYMENT VOUCHERS", subtitle: "Manage vouchers, disbursements and settlement status", icon: WalletCards, action: "New Voucher" },
  { key: "staff", label: "Staff Registry", title: "STAFF REGISTRY", subtitle: "Manage staff records, assignments, availability and compliance", icon: UsersRound, action: "Add Staff" },
  { key: "finance", label: "Finance", title: "FINANCE DASHBOARD", subtitle: "Financial overview, account controls and budget intelligence", icon: CircleDollarSign },
  { key: "reports", label: "Reports & Analytics", title: "REPORTS & ANALYTICS", subtitle: "Generate, analyse and export enterprise reports", icon: FileBarChart },
  { key: "audit", label: "Audit Trail", title: "AUDIT TRAIL", subtitle: "Trace system activity, approvals, edits and security events", icon: ShieldCheck },
  { key: "profile", label: "My Profile", title: "MY PROFILE", subtitle: "Manage identity, access, preferences and security", icon: UserRound },
  { key: "notifications", label: "Notifications", title: "NOTIFICATIONS CENTRE", subtitle: "Review workflow alerts, approvals and system messages", icon: Bell },
  { key: "settings", label: "Settings", title: "SETTINGS & CONFIGURATION", subtitle: "Configure system preferences, roles and enterprise controls", icon: Settings },
];


const legacyWorkspaceRoutes: Record<ModuleKey, string> = {
  dashboard: "/dashboard",
  requests: "/requests",
  approvals: "/approvals",
  vouchers: "/payment-vouchers",
  staff: "/staff",
  finance: "/finance",
  reports: "/reports",
  audit: "/audit-centre",
  profile: "/profile",
  notifications: "/staff/notifications",
  settings: "/admin/settings",
};

function LiveLegacyWorkspace({ kind }: { kind: ModuleKey }) {
  const route = legacyWorkspaceRoutes[kind];
  const [loading, setLoading] = useState(true);
  return (
    <section className="erp-live-workspace" aria-label={`${kind} live legacy workspace`}>
      <div className="erp-live-workspace-head">
        <div>
          <strong>LIVE PRODUCTION DATA</strong>
          <span>This workspace displays the current legacy module, its real Supabase records and its existing functions.</span>
        </div>
        <Link className="erp-button erp-button-secondary" href={route}>Open Full Workspace <ArrowUpRight size={16} /></Link>
      </div>
      <div className="erp-live-frame-wrap">
        {loading && <div className="erp-live-loading"><span className="erp-live-spinner" /><strong>Loading live module data...</strong></div>}
        <iframe
          className="erp-live-frame"
          src={`${route}?embedded=1`}
          title={`${kind} production workspace`}
          onLoad={() => setLoading(false)}
        />
      </div>
    </section>
  );
}

const records = [
  ["REQ-2026-0128", "Payment Voucher", "Isallaah360", "₦250,000.00", "Pending"],
  ["REQ-2026-0127", "Staff Onboarding", "James Daniel", "—", "Approved"],
  ["REQ-2026-0124", "Equipment Request", "Michael Brown", "₦120,000.00", "Pending"],
  ["REQ-2026-0122", "Training Request", "Sarah Williams", "₦80,000.00", "Approved"],
  ["REQ-2026-0118", "Leave Request", "Fatih Joseph", "—", "Completed"],
];

function getGreeting(hour: number) { return hour < 12 ? "GOOD MORNING" : hour < 17 ? "GOOD AFTERNOON" : "GOOD EVENING"; }

function HeaderGreeting({ section, userName }: { section: string; userName: string }) {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => { const update = () => setHour(new Date().getHours()); update(); const id = setInterval(update, 60_000); return () => clearInterval(id); }, []);
  return <div className="erp-greeting"><strong>{hour === null ? "WELCOME" : getGreeting(hour)}, {userName.toUpperCase()}</strong><span>{section}</span></div>;
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  if (!now) return <span>—</span>;
  return <><span>{new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now)}</span><strong>{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(now)}</strong></>;
}

function Metric({ label, value, tone = "blue", note = "+8% from yesterday" }: { label: string; value: string; tone?: Tone; note?: string }) {
  return <article className={`erp-metric erp-tone-${tone}`}><span>{label}</span><strong>{value}</strong><small><ArrowUpRight size={13} />{note}</small></article>;
}

function Status({ value }: { value: string }) { return <span className={`erp-status erp-status-${value.toLowerCase()}`}>{value}</span>; }

function DataTable({ kind }: { kind: ModuleKey }) {
  const title = kind === "staff" ? "STAFF DIRECTORY" : kind === "audit" ? "RECENT SYSTEM ACTIVITY" : kind === "approvals" ? "APPROVAL QUEUE" : kind === "vouchers" ? "PAYMENT VOUCHER REGISTER" : "RECENT TRANSACTIONS";
  return <section className="erp-panel erp-table-panel">
    <div className="erp-panel-head"><div><h3>{title}</h3><p>Latest records requiring visibility or action</p></div><button className="erp-icon-button" aria-label="Filter table"><Filter size={17} /></button></div>
    <div className="erp-table-wrap"><table className="erp-table"><thead><tr><th>REFERENCE</th><th>TYPE / MODULE</th><th>OWNER</th><th>AMOUNT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{records.map((r, i) => <tr key={r[0]}><td><Link href="#">{r[0]}</Link></td><td>{kind === "audit" ? ["Login", "Create", "Update", "Delete", "Approve"][i] : r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td><Status value={r[4]} /></td><td><div className="erp-row-actions"><button aria-label="View"><Eye size={15} /></button><button aria-label="Edit"><Pencil size={15} /></button><button aria-label="More"><MoreHorizontal size={15} /></button></div></td></tr>)}</tbody></table></div>
  </section>;
}

function Analytics() {
  return <div className="erp-analytics-grid"><section className="erp-panel"><div className="erp-panel-head"><div><h3>PERFORMANCE OVERVIEW</h3><p>Eight-period operational trend</p></div><span className="erp-panel-kicker">+12.4%</span></div><div className="erp-chart" aria-label="Performance bar chart"><span /><span /><span /><span /><span /><span /><span /><span /></div><div className="erp-axis"><span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span><span>W6</span><span>W7</span><span>W8</span></div></section><section className="erp-panel"><div className="erp-panel-head"><div><h3>WORKFLOW DISTRIBUTION</h3><p>Current business workload</p></div></div><div className="erp-donut"><div><strong>68%</strong><span>UTILIZED</span></div></div><div className="erp-legend"><span><i className="erp-dot erp-dot-blue" />Operations 45%</span><span><i className="erp-dot erp-dot-gold" />Finance 25%</span><span><i className="erp-dot erp-dot-violet" />HR 15%</span><span><i className="erp-dot erp-dot-grey" />Others 15%</span></div></section></div>;
}

function Dashboard() {
  return <><div className="erp-metrics"><Metric label="TOTAL REQUESTS" value="128" /><Metric label="PENDING APPROVALS" value="45" tone="gold" /><Metric label="APPROVED TODAY" value="₦2.4M" tone="green" /><Metric label="OVERDUE TASKS" value="12" tone="red" /><Metric label="TOTAL STAFF" value="342" tone="violet" /></div><Analytics /><div className="erp-dashboard-lower"><DataTable kind="dashboard" /><section className="erp-panel erp-activity-panel"><div className="erp-panel-head"><div><h3>RECENT ACTIVITY</h3><p>Live operational feed</p></div></div>{["Payment voucher approved", "New staff record created", "Request submitted for review", "Budget report generated", "User role updated"].map((x, i) => <article className="erp-activity" key={x}><span><Activity size={15} /></span><div><strong>{x}</strong><small>{["2 mins", "15 mins", "47 mins", "1 hour", "2 hours"][i]} ago</small></div></article>)}</section></div></>;
}

function Requests({ kind }: { kind: "requests" | "approvals" | "vouchers" | "staff" }) {
  const metric = kind === "staff" ? ["TOTAL STAFF", "ACTIVE", "ON LEAVE", "INACTIVE", "NEW THIS MONTH"] : kind === "vouchers" ? ["TOTAL VOUCHERS", "TOTAL AMOUNT", "PENDING", "APPROVED", "PAID"] : ["TOTAL REQUESTS", "PENDING", "APPROVED", "REJECTED", "COMPLETED"];
  const values = kind === "staff" ? ["342", "298", "18", "26", "14"] : kind === "vouchers" ? ["86", "₦12.6M", "₦2.4M", "₦9.8M", "₦7.1M"] : ["128", "45", "72", "11", "86"];
  const tones: Tone[] = ["blue", "gold", "green", "red", "violet"];
  return <><div className="erp-metrics">{metric.map((m, i) => <Metric key={m} label={m} value={values[i]} tone={tones[i]} />)}</div>{kind === "approvals" && <div className="erp-approval-strip"><button className="active">Pending (45)</button><button>My Approvals (12)</button><button>Escalated (3)</button><button>All (126)</button></div>}<DataTable kind={kind} /></>;
}

function Finance() { return <><div className="erp-metrics"><Metric label="TOTAL REVENUE" value="₦45.6M" /><Metric label="TOTAL EXPENSES" value="₦23.8M" tone="red" /><Metric label="NET PROFIT" value="₦21.8M" tone="green" /><Metric label="BUDGET UTILIZATION" value="68%" tone="gold" /><Metric label="CASH BALANCE" value="₦12.4M" tone="violet" /></div><Analytics /><DataTable kind="finance" /></>; }

function Reports() { const items = [["Financial Reports", "24 Reports", CircleDollarSign], ["HR Reports", "16 Reports", UsersRound], ["Request Reports", "12 Reports", FileText], ["Payment Reports", "15 Reports", WalletCards], ["Audit Reports", "10 Reports", ShieldCheck], ["Performance Reports", "8 Reports", BarChart3], ["Registry Reports", "14 Reports", BookOpenCheck], ["Custom Reports", "Create New", Plus]] as const; return <div className="erp-report-grid">{items.map(([n, c, Icon]) => <article className="erp-report-card" key={n}><span><Icon size={25} /></span><strong>{n}</strong><small>{c}</small><button>Open Centre <ArrowUpRight size={13} /></button></article>)}</div>; }

function Audit() { return <><div className="erp-security-banner"><span><ShieldCheck size={24} /></span><div><strong>AUDIT INTEGRITY ACTIVE</strong><p>All administrative and transactional activities are being recorded.</p></div><Status value="Protected" /></div><div className="erp-metrics"><Metric label="EVENTS TODAY" value="1,248" /><Metric label="SECURITY EVENTS" value="18" tone="gold" /><Metric label="FAILED LOGINS" value="3" tone="red" /><Metric label="PRIVILEGED ACTIONS" value="62" tone="violet" /><Metric label="COMPLIANCE SCORE" value="98.4%" tone="green" /></div><DataTable kind="audit" /></>; }

function Profile() { return <div className="erp-profile-grid"><section className="erp-panel erp-profile-card"><div className="erp-avatar-large">I</div><h3>Isallaah360</h3><p>Super Administrator</p><span>Executive Management</span><div className="erp-profile-meta"><p><Building2 size={15} />Barderian Enterprises</p><p><LockKeyhole size={15} />MFA Enabled</p><p><Clock3 size={15} />Last login: Today, 10:38 AM</p></div></section><section className="erp-panel"><div className="erp-tabs"><button className="active">Profile Information</button><button>Security</button><button>Preferences</button><button>Activity Log</button></div><div className="erp-form-grid"><label>Full Name<input defaultValue="Isallaah360" /></label><label>Email Address<input defaultValue="admin@barderian.com" /></label><label>Phone Number<input defaultValue="+234 803 123 4567" /></label><label>Department<select defaultValue="Executive Management"><option>Executive Management</option></select></label><label>Role<select defaultValue="Super Administrator"><option>Super Administrator</option></select></label><label>Time Format<select defaultValue="12 Hour (AM/PM)"><option>12 Hour (AM/PM)</option></select></label></div><button className="erp-button erp-button-gold">Update Profile</button></section></div>; }

function Notifications() { const notes = [["Payment Voucher PV-2026-0046 has been approved", "2 mins ago", "success"], ["New request REQ-2026-0128 submitted for approval", "15 mins ago", "info"], ["Staff record for James Daniel has been updated", "47 mins ago", "info"], ["Budget report for July 2026 is now available", "1 hr ago", "danger"], ["System maintenance scheduled for this weekend", "2 hrs ago", "warning"]]; return <section className="erp-panel"><div className="erp-tabs"><button className="active">All</button><button>Unread (5)</button><button>Requests</button><button>Approvals</button><button>Payments</button><button>System</button></div><div className="erp-notification-list">{notes.map(n => <article key={n[0]}><span className={`erp-notification-icon ${n[2]}`}><Bell size={18} /></span><div><strong>{n[0]}</strong><small>{n[1]}</small></div><button aria-label="Mark notification as read"><CheckCircle2 size={17} /></button></article>)}</div><div className="erp-panel-footer"><button className="erp-button erp-button-secondary">Mark all as read</button></div></section>; }

function SettingsPage() { return <div className="erp-settings-grid"><aside className="erp-panel erp-settings-menu">{["General Settings", "Business Settings", "User Management", "Role Management", "System Configuration", "Email Settings", "Security Settings", "Backup & Restore"].map((x, i) => <button className={i === 0 ? "active" : ""} key={x}>{x}</button>)}</aside><section className="erp-panel"><div className="erp-panel-head"><div><h3>GENERAL SETTINGS</h3><p>Core enterprise configuration</p></div></div><div className="erp-form-grid"><label>System Name<input defaultValue="ReqGen ERP 2.0" /></label><label>Company Name<input defaultValue="Barderian Enterprises" /></label><label>Timezone<select><option>(GMT+1) West Africa Time</option></select></label><label>Date Format<select><option>DD MMM YYYY</option></select></label><label>Time Format<select><option>12 Hour (AM/PM)</option></select></label><label>Currency<select><option>NGN — Nigerian Naira</option></select></label></div><div className="erp-switch-row"><div><strong>Enterprise notifications</strong><small>Enable system and workflow alerts</small></div><button className="erp-switch active" aria-label="Toggle enterprise notifications"><i /></button></div><div className="erp-switch-row"><div><strong>Compact data tables</strong><small>Display additional records per page</small></div><button className="erp-switch" aria-label="Toggle compact tables"><i /></button></div><button className="erp-button erp-button-gold">Save Changes</button></section></div>; }

function ModuleContent({ kind }: { kind: ModuleKey }) { return <LiveLegacyWorkspace kind={kind} />; }

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  if (!open) return null;
  const filtered = modules.filter(item => `${item.label} ${item.title}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="erp-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="erp-command" role="dialog" aria-modal="true" aria-label="ERP command centre" onMouseDown={event => event.stopPropagation()}><div className="erp-command-search"><Search size={19} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search modules, records and actions..." /><kbd>ESC</kbd></div><div className="erp-command-section"><small>QUICK NAVIGATION</small>{filtered.map(item => { const ItemIcon = item.icon; return <Link href={`/erp-2/${item.key}`} key={item.key} onClick={onClose}><span><ItemIcon size={18} /></span><div><strong>{item.label}</strong><small>{item.subtitle}</small></div><ArrowUpRight size={15} /></Link>; })}</div></section></div>;
}

function RecordDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <div className="erp-drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="erp-drawer" role="dialog" aria-modal="true" aria-label="Record details" onMouseDown={event => event.stopPropagation()}><div className="erp-drawer-head"><div><small>REQUEST RECORD</small><h2>REQ-2026-0128</h2></div><button className="erp-icon-button" onClick={onClose} aria-label="Close record details"><X size={18} /></button></div><div className="erp-drawer-status"><Status value="Pending" /><span>Priority: High</span></div><section><h3>REQUEST SUMMARY</h3><dl><div><dt>Request Type</dt><dd>Payment Voucher</dd></div><div><dt>Submitted By</dt><dd>Isallaah360</dd></div><div><dt>Department</dt><dd>Executive Management</dd></div><div><dt>Amount</dt><dd>₦250,000.00</dd></div><div><dt>Submitted</dt><dd>04 Aug 2026, 10:30 AM</dd></div></dl></section><section><h3>WORKFLOW PROGRESS</h3><div className="erp-timeline"><article className="done"><i /><div><strong>Request Submitted</strong><small>04 Aug 2026 · 10:30 AM</small></div></article><article className="active"><i /><div><strong>Department Review</strong><small>Currently awaiting action</small></div></article><article><i /><div><strong>Finance Approval</strong><small>Pending previous stage</small></div></article><article><i /><div><strong>Payment Processing</strong><small>Pending approval</small></div></article></div></section><div className="erp-drawer-actions"><button className="erp-button erp-button-secondary" onClick={onClose}>Close</button><button className="erp-button erp-button-gold">Open Full Record</button></div></aside></div>;
}

export default function LegacyERP({ module }: { module: string }) {
  const pathname = usePathname();
  const active = useMemo(() => modules.find(item => item.key === module) || modules[0], [module]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [profile, setProfile] = useState(false);
  const [command, setCommand] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState("");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [currentUser, setCurrentUser] = useState<CurrentUser>(fallbackUser);
  const Icon = active.icon;

  useEffect(() => {
    let alive = true;
    async function loadCurrentUser() {
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData.session?.user;
      if (!authUser || !alive) return;

      const metadata = (authUser.user_metadata || {}) as Record<string, unknown>;
      const metadataName = [metadata.full_name, metadata.name, metadata.display_name].find(value => typeof value === "string" && value.trim()) as string | undefined;
      const { data: profileRow } = await supabase.from("profiles").select("full_name,email,role").eq("id", authUser.id).maybeSingle();
      if (!alive) return;

      const fullName = profileRow?.full_name?.trim() || metadataName?.trim() || authUser.email?.split("@")[0] || "ReqGen User";
      const email = profileRow?.email?.trim() || authUser.email || "";
      const role = profileRow?.role?.trim() || "Staff";
      setCurrentUser({ fullName, email, role, initials: getInitials(fullName) });
    }

    loadCurrentUser();
    const { data: listener } = supabase.auth.onAuthStateChange(() => loadCurrentUser());
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommand(true); }
      if (event.key === "Escape") { setCommand(false); setDrawer(false); setProfile(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  return <div className={`erp-shell ${collapsed ? "erp-collapsed" : ""} ${density === "compact" ? "erp-density-compact" : ""}`}><a className="erp-skip-link" href="#erp-main-content">Skip to main content</a>
    <aside className={`erp-sidebar ${mobile ? "erp-mobile-open" : ""}`}><div className="erp-brand"><Image src="/iet-logo.png" alt="IET" width={40} height={40} /><div><strong>REQGEN</strong><span>ERP 2.0</span></div><button className="erp-mobile-close" onClick={() => setMobile(false)} aria-label="Close navigation"><X size={20} /></button></div><div className="erp-sidebar-context"><small>ENTERPRISE WORKSPACE</small><strong>Barderian Enterprises</strong></div><nav>{modules.filter(item => !["profile", "notifications"].includes(item.key)).map(item => { const NavIcon = item.icon; return <Link href={`/erp-2/${item.key}`} className={pathname.endsWith(item.key) ? "active" : ""} key={item.key}><NavIcon size={19} /><span>{item.label}</span>{item.key === "approvals" && <b>45</b>}</Link>; })}</nav><button className="erp-sidebar-command" onClick={() => setCommand(true)}><Search size={16} /><span>Quick search</span><kbd>Ctrl K</kbd></button><div className="erp-sidebar-foot"><span>PRODUCTION</span><small>ReqGen ERP v2.0 · Release 36</small></div></aside>
    {mobile && <button className="erp-mobile-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <div className="erp-workspace"><header className="erp-topbar"><div className="erp-topbar-left"><button className="erp-menu-button" onClick={() => { if (window.innerWidth < 900) setMobile(true); else setCollapsed(!collapsed); }} aria-label="Toggle navigation"><Menu size={21} /></button><HeaderGreeting section={active.title.replaceAll("&", "and")} userName={currentUser.fullName} /></div><div className="erp-topbar-centre"><button className="erp-global-search" onClick={() => setCommand(true)}><Search size={17} /><span>Search ReqGen ERP...</span><kbd>Ctrl K</kbd></button><div className="erp-clock"><Clock /></div></div><div className="erp-topbar-actions"><div className="erp-role-switcher"><ActiveRoleSwitcher compact /></div><Link href="/erp-2/notifications" className="erp-icon-button erp-bell" aria-label="Notifications"><Bell size={19} /><i>5</i></Link><div className="erp-profile"><button onClick={() => setProfile(!profile)} aria-expanded={profile}><span className="erp-avatar">{currentUser.initials}</span><span><strong>{currentUser.fullName}</strong><small>{currentUser.role}</small></span><ChevronDown size={15} /></button>{profile && <div className="erp-profile-menu"><div className="erp-profile-menu-head"><strong>{currentUser.fullName}</strong><small>{currentUser.email || currentUser.role}</small></div><Link href="/erp-2/profile"><UserRound size={16} />My Profile</Link><Link href="/erp-2/settings"><Settings size={16} />Settings</Link><button onClick={() => setDensity(value => value === "comfortable" ? "compact" : "comfortable")}><SlidersHorizontal size={16} />{density === "comfortable" ? "Compact View" : "Comfortable View"}</button><Link href="/login"><LogOut size={16} />Logout</Link></div>}</div></div></header>
      <main className="erp-main" id="erp-main-content"><div className="erp-watermark"><Image src="/be-logo.png" alt="" fill sizes="70vw" /></div><div className="erp-release-ribbon"><span>REQGEN ERP 2.0</span><strong>ENTERPRISE RELEASE 36</strong><small>Unified UI · Live Production Structure</small></div><div className="erp-breadcrumb"><Link href="/erp-2/dashboard">Home</Link><span>/</span><strong>{active.label}</strong></div><div className="erp-page-head"><div><span className="erp-eyebrow"><Icon size={15} />{active.label}</span><h1>{active.title}</h1><p>{active.subtitle}</p></div><div className="erp-page-actions"><button className="erp-button erp-button-secondary" onClick={() => setToast(`${active.label} export prepared`)}><Download size={16} />Export</button>{active.action && <button className="erp-button erp-button-gold" onClick={() => setToast(`${active.action} workflow opened`)}><Plus size={16} />{active.action}</button>}</div></div>{!['profile','settings','notifications','reports'].includes(active.key) && <div className="erp-toolbar"><div className="erp-search"><Search size={17} /><input placeholder={`Search ${active.label.toLowerCase()}...`} /></div><select aria-label="Category"><option>All Categories</option></select><select aria-label="Status"><option>All Status</option></select><select aria-label="Period"><option>This Month</option></select><button className="erp-button erp-button-secondary"><SlidersHorizontal size={16} />Filter</button></div>}<div onDoubleClick={() => setDrawer(true)}><ModuleContent kind={active.key} /></div><button className="erp-record-preview" onClick={() => setDrawer(true)}><Eye size={16} />Preview selected record</button></main>
      <footer className="erp-footer"><span>© 2026 Barderian Enterprises. All rights reserved.</span><span>ReqGen ERP 2.0 · Production · Release 36</span></footer></div>
    <CommandPalette open={command} onClose={() => setCommand(false)} /><RecordDrawer open={drawer} onClose={() => setDrawer(false)} />{toast && <div className="erp-toast"><CheckCircle2 size={18} /><div><strong>Action completed</strong><span>{toast}</span></div></div>}
  </div>;
}
