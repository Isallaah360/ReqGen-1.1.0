"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { canAccessPath } from "@/lib/permissions";
import { accessRoleSet, getCurrentAuthContext } from "@/lib/auth";
import { MODULE_SWITCH_EVENT, SWITCH_PREFIXES, loadModuleSwitches, type ModuleSwitch } from "@/lib/v4/moduleSwitches";
import { APPROVAL_QUEUE_CHANGED_EVENT, isAwaitingUser, type ApprovalQueueRow } from "@/lib/approvalQueue";
import { MODULES, ACCOUNT_MODULE, DEVELOPER_MODULE, breadcrumbsFor, moduleForPath, searchablePages } from "@/lib/v4/modules";
import { storedWindowEnd } from "@/lib/mfaTrust";
import { THEME_EVENT, applyTheme, readThemeMode, type ThemeMode } from "@/lib/theme";
import { REQGEN_VERSION } from "@/lib/version";
import { subscribeActivity } from "@/lib/activity";
import { confirmDialog } from "@/lib/dialog";
import Icon from "./Icon";
import Bell from "./Bell";
import { SavedHost } from "./Motion";
import RoleSelect, { positionName } from "./RoleSelect";
import SetupCoach from "@/app/components/SetupCoach";




function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "RG";
}

type Identity = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  roleName: string;
  roleSet: Set<string>;
  systemAccount: string | null;
};

/** Loading bar directly below the top bar (tracked requests + page changes). */
function LoadBar() {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [nav, setNav] = useState(false);
  const timer = useRef<number | null>(null);
  const first = useRef(true);
  useEffect(() => subscribeActivity((b) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (b) timer.current = window.setTimeout(() => setBusy(true), 250);
    else setBusy(false);
  }), []);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    queueMicrotask(() => setNav(true));
    const t = window.setTimeout(() => setNav(false), 650);
    return () => window.clearTimeout(t);
  }, [pathname]);
  const on = busy || nav;
  return <div className="v4-loadbar" role="progressbar" aria-label="Loading" aria-busy={on} aria-hidden={!on}>{on ? <span /> : null}</div>;
}

/** Ends of the 12-hour 2FA window, shown in the footer. */
function TwoFactorChip() {
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const read = () => { setEnd(storedWindowEnd()); setNow(Date.now()); };
    queueMicrotask(read);
    const t = window.setInterval(read, 60_000);
    window.addEventListener("focus", read);
    return () => { window.clearInterval(t); window.removeEventListener("focus", read); };
  }, []);
  if (!end || !now || end <= now) return null;
  const until = new Date(end).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  const soon = end - now < 15 * 60_000;
  return <span className={`v4-chip ${soon ? "v4-chip-amber" : "v4-chip-green"}`}><Icon name="shield" size="sm" />2FA verified until {until}</span>;
}

export function V4Footer() {
  return (
    <footer className="v4-ui v4-footer">
      <div className="v4-footer-in">
        <div className="v4-made">
          <Image src="/v4/iet-mark.png" alt="" width={34} height={34} />
          <div><span>Made for the</span><strong>Islamic Education Trust</strong></div>
        </div>
        <div className="v4-mid">
          <span className="v4-auth-values"><span>Secure</span><i /><span>Reliable</span><i /><span>Accountable</span></span>
          <span className="v4-links"><Link href="/docs">Help</Link><Link href="/docs#privacy">Privacy</Link><Link href="/app">Get the Android app</Link><Link href="/credits">Open-source credits</Link><span>ReqGen {REQGEN_VERSION}</span></span>
        </div>
        <div className="v4-right">
          <TwoFactorChip />
          <div className="v4-powered">
            <Image src="/v4/be-logo.png" alt="Barderian Enterprises logo" width={32} height={32} />
            <div><small>Powered by</small><strong>BARDERIAN <em>ENTERPRISES</em></strong></div>
          </div>
        </div>
      </div>
    </footer>
  );
}

const THEME_LABEL: Record<ThemeMode, string> = { light: "Light", dark: "Dark", system: "Same as device" };

function AvatarMenu({ me, onSignOut }: { me: Identity; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>("system");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    queueMicrotask(() => setMode(readThemeMode()));
    const onChange = () => setMode(readThemeMode());
    window.addEventListener(THEME_EVENT, onChange);
    return () => window.removeEventListener(THEME_EVENT, onChange);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const next: ThemeMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
  return (
    <div className="v4-topwrap" ref={ref}>
      <button className="v4-avatar" type="button" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ overflow: "hidden", padding: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- photo from Supabase Storage */}
        {me.avatarUrl ? <img src={me.avatarUrl} alt="" /> : initialsOf(me.name)}
      </button>
      {open ? (
        <div className="v4-avatar-menu" role="menu">
          <div className="v4-who"><b>{me.name}</b><small>{me.roleName}</small></div>
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)}><Icon name="user" />My Account</Link>
          <Link role="menuitem" href="/profile/security" onClick={() => setOpen(false)}><Icon name="lock" />Security &amp; Devices</Link>
          <button role="menuitem" type="button" onClick={() => applyTheme(next)}><Icon name={mode === "dark" ? "moon" : mode === "light" ? "sun" : "monitor"} />Appearance: {THEME_LABEL[mode]}</button>
          <Link role="menuitem" href="/docs" onClick={() => setOpen(false)}><Icon name="help" />Help</Link>
          <button role="menuitem" type="button" className="v4-danger" onClick={() => { setOpen(false); onSignOut(); }}><Icon name="logout" />Sign out</button>
        </div>
      ) : null}
    </div>
  );
}

function Search({ roleSet }: { roleSet: Set<string> }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLLabelElement>(null);
  const pages = useMemo(() => searchablePages().filter((p) => canAccessPath(p.href.split("#")[0], roleSet)), [roleSet]);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return pages.filter((p) => `${p.title} ${p.module} ${p.purpose} ${p.keywords.join(" ")}`.toLowerCase().includes(term)).slice(0, 8);
  }, [q, pages]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const go = (href: string) => { setOpen(false); setQ(""); router.push(href); };
  return (
    <label className="v4-search" ref={ref}>
      <span className="v4-sr-only">Search ReqGen</span>
      <Icon name="search" />
      <input
        type="search"
        placeholder="Search pages, requests, vouchers…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, Math.max(results.length - 1, 0))); }
          if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") {
            e.preventDefault();
            if (results[sel]) go(results[sel].href);
            else if (/^(req|pv)-/i.test(q.trim())) go(`/requests/mine?q=${encodeURIComponent(q.trim())}`);
          }
        }}
        role="combobox"
        aria-controls="v4-search-results"
        aria-autocomplete="list"
        aria-expanded={open && !!q.trim()}
      />
      {open && q.trim() ? (
        <div className="v4-search-results" role="listbox" id="v4-search-results">
          {results.map((r, i) => (
            <a key={r.href + r.title} href={r.href} role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); go(r.href); }}>
              <strong>{r.title}</strong><span>{r.module}, {r.purpose}</span>
            </a>
          ))}
          {!results.length ? <p>No page matches “{q.trim()}”. Press Enter to look for a request number.</p> : null}
        </div>
      ) : null}
    </label>
  );
}

/**
 * ReqGen 6.2.0 website frame (Blueprint 08): the IET top bar, one menu of tabs, the office's pages as
 * sub-tabs, breadcrumb and footer. A plain website on every device; the Android app has its own screens.
 */
export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const [me, setMe] = useState<Identity | null>(null);
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);
  const [recordLabel, setRecordLabel] = useState<string | null>(null);

  // Pages may name the record they show (for the breadcrumb): window event.
  useEffect(() => {
    const on = (e: Event) => setRecordLabel(((e as CustomEvent).detail as string) || null);
    window.addEventListener("reqgen-record-label", on);
    return () => window.removeEventListener("reqgen-record-label", on);
  }, []);
  useEffect(() => { queueMicrotask(() => { setRecordLabel(null); }); }, [pathname]);

  const loadIdentity = useCallback(async () => {
    const [context, auth] = await Promise.all([getCurrentAuthContext(), supabase.auth.getUser()]);
    const user = auth.data.user;
    if (!user) return;
    const profile = await supabase.from("profiles").select("full_name,avatar_url").eq("id", user.id).maybeSingle();
    const systemAccount = context?.systemAccount || null;
    const p = (profile.data || {}) as { full_name?: string | null; avatar_url?: string | null };
    const name = String(p.full_name || user.user_metadata?.full_name || user.email || "ReqGen user").trim();
    const role = context?.activeRoleKey || "staff";
    setMe({
      userId: user.id,
      name,
      avatarUrl: profile.error ? null : (String(p.avatar_url || "").trim() || null),
      role,
      roleName: positionName(role, context?.activeRoleName || role, systemAccount),
      roleSet: context ? (accessRoleSet(context).size ? accessRoleSet(context) : new Set(["staff"])) : new Set(["staff"]),
      systemAccount,
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void loadIdentity(); });
    const refresh = () => void loadIdentity();
    window.addEventListener("reqgen-active-role-changed", refresh);
    window.addEventListener("reqgen-profile-updated", refresh);
    return () => {
      window.removeEventListener("reqgen-active-role-changed", refresh);
      window.removeEventListener("reqgen-profile-updated", refresh);
    };
  }, [loadIdentity]);

  // v4.6.6: modules the Developer switched off leave the menu (the Developer still sees them, marked Off)
  const [switches, setSwitches] = useState<ModuleSwitch[]>([]);
  useEffect(() => {
    const read = (force: boolean) => { void loadModuleSwitches(force).then(setSwitches); };
    queueMicrotask(() => read(false));
    const onChange = () => read(true);
    window.addEventListener(MODULE_SWITCH_EVENT, onChange);
    return () => window.removeEventListener(MODULE_SWITCH_EVENT, onChange);
  }, [pathname]);

  // v4.6.6: the Developer has a console of their own, with its own look
  const isDeveloper = me?.systemAccount === "developer";
  useEffect(() => {
    const root = document.documentElement;
    if (isDeveloper) root.dataset.console = "developer"; else delete root.dataset.console;
  }, [isDeveloper]);
  useEffect(() => {
    if (isDeveloper && pathname === "/dashboard" && !window.location.search.includes("view=trust")) router.replace("/developer");
  }, [isDeveloper, pathname, router]);

  // Approvals badge — the same rule as the Approvals page (lib/approvalQueue).
  const badgeTimer = useRef<number | null>(null);
  const refreshPending = useCallback(async () => {
    if (!me) return;
    const [{ data, error }, direct] = await Promise.all([
      supabase.from("requests").select("current_owner,current_stage,status,assigned_account_officer_id,assigned_account_officer_user_id"),
      supabase.rpc("reqgen_direct_waiting"), // v4.7.0: Direct requests waiting for my answer
    ]);
    if (error) return;
    setPending(((data || []) as ApprovalQueueRow[]).filter((row) => isAwaitingUser(row, me.userId, me.role)).length + (direct.error ? 0 : (direct.data || []).length));
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const schedule = () => {
      if (badgeTimer.current) window.clearTimeout(badgeTimer.current);
      badgeTimer.current = window.setTimeout(() => { void refreshPending(); }, 350);
    };
    queueMicrotask(() => { void refreshPending(); });
    const channel = supabase.channel(`reqgen-v4-approval-badge-${me.userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, schedule)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") schedule(); };
    window.addEventListener(APPROVAL_QUEUE_CHANGED_EVENT, schedule);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", onVisible);
    const poll = window.setInterval(schedule, 60_000);
    return () => {
      if (badgeTimer.current) window.clearTimeout(badgeTimer.current);
      window.clearInterval(poll);
      window.removeEventListener(APPROVAL_QUEUE_CHANGED_EVENT, schedule);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [me, refreshPending]);

  async function signOut() {
    const ok = await confirmDialog({ title: "Sign out of ReqGen?", message: "Unsaved work on this page will be lost.", confirmLabel: "Sign out" });
    if (!ok) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const roleSet = me?.roleSet || new Set<string>();
  const active = moduleForPath(pathname);
  const offKeys = new Set(switches.filter((x) => !x.enabled).map((x) => x.module_key));
  const isOff = (m: { href: string }) => [...offKeys].some((k) => (SWITCH_PREFIXES[k] || []).some((p) => m.href === p || m.href.startsWith(`${p}/`)));
  const visible = me ? MODULES.filter((m) => canAccessPath(m.href, roleSet) && (isDeveloper || !isOff(m))) : [];
  const crumbs = breadcrumbsFor(pathname, recordLabel);
  const countFor = (key: string) => (key === "approvals" ? pending : key === "notifications" ? unread : 0);
  const isHome = pathname === "/dashboard" || pathname === "/developer";

  // 6.2.0 (Blueprint 08): a plain website. One menu of tabs across the top, the office's own pages as
  // sub-tabs under it, the same layout on every screen size (the menu wraps; nothing slides in).
  const menu = [
    ...(isDeveloper ? [{ key: "developer", label: "Developer", href: DEVELOPER_MODULE.href }] : []),
    // the bell holds Notifications and the avatar menu holds My Account, so the menu stays one line
    ...visible.filter((m) => m.key !== "notifications").map((m) => ({ key: m.key, label: isDeveloper && m.key === "dashboard" ? "Trust Dashboard" : m.label, href: isDeveloper && m.key === "dashboard" ? "/dashboard?view=trust" : m.href })),
  ];
  const activeKey = pathname.startsWith("/developer") ? "developer" : active?.key;
  const activeModule = pathname.startsWith("/developer") ? DEVELOPER_MODULE : active?.key === "account" ? ACCOUNT_MODULE : active;
  const subTabs = (activeModule?.tiles || []).filter((t) => canAccessPath(t.href.split("#")[0], roleSet));
  const subOn = (href: string) => { const base = href.split("#")[0]; return pathname === base || pathname.startsWith(`${base}/`); };
  const currentSub = [...subTabs].filter((t) => subOn(t.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="s6-site">
      <header className="s6-top">
        <div className="s6-top-in">
          <Link className="s6-brand" href={isDeveloper ? "/developer" : "/dashboard"}>
            <Image src={isDeveloper ? "/v4/be-logo.png" : "/v4/iet-logo.png"} alt={isDeveloper ? "Barderian Enterprises logo" : "Islamic Education Trust logo"} width={44} height={44} priority />
            {isDeveloper
              ? <span><b>ReqGen Console</b><small>Barderian Enterprises, the developer</small></span>
              : <span><b>Req<span>Gen</span></b><small>Islamic Education Trust, Request and Payment System</small></span>}
          </Link>
          {isDeveloper ? <span className="s6-console-badge">DEVELOPER CONSOLE</span> : null}
          <Search roleSet={roleSet} />
          <div className="s6-top-actions">
            <Bell userId={me?.userId ?? null} pendingApprovalCount={pending} onUnread={setUnread} />
            <RoleSelect systemAccount={me?.systemAccount} />
            {me ? <AvatarMenu me={me} onSignOut={() => void signOut()} /> : <span className="v4-avatar" aria-hidden="true">…</span>}
          </div>
        </div>
      </header>
      <nav className="s6-menu" aria-label="Main menu">
        <div className="s6-menu-in">
          {menu.map((m) => {
            const n = countFor(m.key);
            return (
              <Link key={m.key} href={m.href} aria-current={activeKey === m.key ? "page" : undefined}>
                {m.label}{n > 0 ? <span className="s6-n" aria-label={`${n} waiting`}>{n > 99 ? "99+" : n}</span> : null}
                {isDeveloper && m.key !== "developer" && isOff({ href: m.href }) ? <span className="s6-off">Off</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>
      <LoadBar />
      <SetupCoach />
      <main className="s6-page" id="reqgen-main-content" data-still={pathname.startsWith("/audit-centre/logs") || pathname.startsWith("/mfa") ? "" : undefined}>
        {!isHome ? (
          <nav className="s6-crumbs" aria-label="You are here" data-home={isHome ? "" : undefined}>
            {/* v4.6.11, kept in 6.2.0: Back on every page that is not Home */}
            <button className="s6-back v4-back-btn" type="button" aria-label="Back" onClick={() => { if (window.history.length > 1) router.back(); else router.push(isDeveloper ? "/developer" : "/dashboard"); }}><Icon name="left" size="sm" /><span>Back</span></button>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={`${c.label}-${i}`}>
                  {i > 0 ? <span className="s6-sep" aria-hidden="true">/</span> : null}
                  {c.href && !last ? <Link href={c.href}>{c.label}</Link> : <span aria-current={last ? "page" : undefined}>{c.label}</span>}
                </span>
              );
            })}
          </nav>
        ) : null}
        {subTabs.length > 1 && !isHome ? (
          <nav className="s6-subtabs" aria-label={`${activeModule?.label || "Office"} pages`}>
            {subTabs.map((t) => <Link key={t.href} href={t.href} aria-current={currentSub === t.href ? "page" : undefined}>{t.title}</Link>)}
          </nav>
        ) : null}
        <div className="s6-content">{children}</div>
      </main>
      <SiteFooter />
      <SavedHost />
    </div>
  );
}

/** 6.2.0: the website footer: IET first; Barderian only as the developer. */
export function SiteFooter() {
  return (
    <footer className="s6-foot">
      <div className="s6-foot-in">
        <span>Islamic Education Trust, General Headquarters, Minna. ReqGen {REQGEN_VERSION}. <Link href="/docs">Help</Link> <Link href="/docs#privacy">Privacy</Link> <Link href="/app">Android app</Link> <Link href="/credits">Credits</Link></span>
        <span>Developed by Barderian Enterprises: WhatsApp <a href="https://wa.me/2348031197746" target="_blank" rel="noreferrer">0803 119 7746</a>, <a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a></span>
      </div>
    </footer>
  );
}
