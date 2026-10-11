"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { canAccessPath } from "@/lib/permissions";
import { getCurrentAuthContext } from "@/lib/auth";
import { APPROVAL_QUEUE_CHANGED_EVENT, isAwaitingUser, type ApprovalQueueRow } from "@/lib/approvalQueue";
import { MODULES, ACCOUNT_MODULE, breadcrumbsFor, moduleForPath, searchablePages } from "@/lib/v4/modules";
import { storedWindowEnd } from "@/lib/mfaTrust";
import { THEME_EVENT, applyTheme, readThemeMode, type ThemeMode } from "@/lib/theme";
import { REQGEN_VERSION } from "@/lib/version";
import { subscribeActivity } from "@/lib/activity";
import { confirmDialog } from "@/lib/dialog";
import Icon from "./Icon";
import { DayIcon, dayPart } from "./Greeting";
import Bell from "./Bell";
import RoleSelect, { positionName } from "./RoleSelect";
import SetupCoach from "@/app/components/SetupCoach";

const MINI_KEY = "reqgen:v4-sidebar-mini";



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
          <span className="v4-links"><Link href="/docs">Help</Link><Link href="/about#privacy">Privacy</Link><span>ReqGen {REQGEN_VERSION}</span></span>
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
              <strong>{r.title}</strong><span>{r.module} · {r.purpose}</span>
            </a>
          ))}
          {!results.length ? <p>No page matches “{q.trim()}”. Press Enter to look for a request number.</p> : null}
        </div>
      ) : null}
    </label>
  );
}

/**
 * ReqGen v4 app frame: left menu of the ten modules, top bar, loading bar,
 * breadcrumb, footer. Wraps every signed-in page. Pages built for v4 render
 * their own v4 content; v3 pages keep their own look inside the frame.
 */
export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const [me, setMe] = useState<Identity | null>(null);
  const [mini, setMini] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);
  const [hour, setHour] = useState(9);
  const [recordLabel, setRecordLabel] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try { setMini(window.localStorage.getItem(MINI_KEY) === "1"); } catch { /* ignore */ }
      setHour(new Date().getHours());
    });
    const t = window.setInterval(() => setHour(new Date().getHours()), 5 * 60_000);
    return () => window.clearInterval(t);
  }, []);

  // Pages may name the record they show (for the breadcrumb): window event.
  useEffect(() => {
    const on = (e: Event) => setRecordLabel(((e as CustomEvent).detail as string) || null);
    window.addEventListener("reqgen-record-label", on);
    return () => window.removeEventListener("reqgen-record-label", on);
  }, []);
  useEffect(() => { queueMicrotask(() => { setDrawer(false); setRecordLabel(null); }); }, [pathname]);

  const loadIdentity = useCallback(async () => {
    const [context, auth] = await Promise.all([getCurrentAuthContext(), supabase.auth.getUser()]);
    const user = auth.data.user;
    if (!user) return;
    const profile = await supabase.from("profiles").select("full_name,avatar_url").eq("id", user.id).maybeSingle();
    let systemAccount: string | null = null;
    const sys = await supabase.from("profiles").select("system_account").eq("id", user.id).maybeSingle();
    if (!sys.error) systemAccount = ((sys.data as { system_account?: string | null } | null)?.system_account) || null;
    const p = (profile.data || {}) as { full_name?: string | null; avatar_url?: string | null };
    const name = String(p.full_name || user.user_metadata?.full_name || user.email || "ReqGen user").trim();
    const role = context?.activeRoleKey || "staff";
    setMe({
      userId: user.id,
      name,
      avatarUrl: profile.error ? null : (String(p.avatar_url || "").trim() || null),
      role,
      roleName: positionName(role, context?.activeRoleName || role, systemAccount),
      roleSet: new Set(context?.activeRoleKey ? [context.activeRoleKey] : ["staff"]),
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

  // Approvals badge — the same rule as the Approvals page (lib/approvalQueue).
  const badgeTimer = useRef<number | null>(null);
  const refreshPending = useCallback(async () => {
    if (!me) return;
    const { data, error } = await supabase.from("requests").select("current_owner,current_stage,status,assigned_account_officer_id,assigned_account_officer_user_id");
    if (error) return;
    setPending(((data || []) as ApprovalQueueRow[]).filter((row) => isAwaitingUser(row, me.userId, me.role)).length);
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

  const toggleMini = () => {
    setMini((m) => {
      const next = !m;
      try { window.localStorage.setItem(MINI_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  async function signOut() {
    const ok = await confirmDialog({ title: "Sign out of ReqGen?", message: "Unsaved work on this page will be lost.", confirmLabel: "Sign out" });
    if (!ok) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const roleSet = me?.roleSet || new Set<string>();
  const active = moduleForPath(pathname);
  const visible = me ? MODULES.filter((m) => canAccessPath(m.href, roleSet)) : [];
  const crumbs = breadcrumbsFor(pathname, recordLabel);
  const countFor = (key: string) => (key === "approvals" ? pending : key === "notifications" ? unread : 0);

  const nav = visible.map((m, i) => {
    const prevGroup = visible.slice(0, i).reverse().find((x) => x.group)?.group;
    const heading = m.group && m.group !== prevGroup ? <div key={`g-${m.group}`} className="v4-nav-group">{m.group}</div> : null;
    const count = countFor(m.key);
    const current = active?.key === m.key;
    return [
      heading,
      <Link key={m.key} href={m.href} title={m.label} aria-current={current ? "page" : undefined}>
        <Icon name={m.icon} /><span>{m.label}</span>
        {count > 0 ? <b className="v4-count" aria-label={`${count} waiting`}>{count > 99 ? "99+" : count}</b> : null}
      </Link>,
    ];
  });

  const firstName = me?.name || "";

  return (
    <>
      <div className="v4-top-stripe" aria-hidden="true" />
      <div className={`v4-app ${mini ? "v4-is-mini" : ""} ${drawer ? "v4-drawer-open" : ""}`}>
        <aside className="v4-ui v4-sidebar" aria-label="Main menu">
          <Link className="v4-brand" href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>
            <Image src="/v4/iet-mark.png" alt="Islamic Education Trust logo" width={42} height={42} priority />
            <div><strong>ReqGen</strong><small>Islamic Education Trust</small></div>
          </Link>
          <button className="v4-collapse-btn" type="button" onClick={toggleMini} aria-label={mini ? "Expand the menu" : "Collapse the menu"} aria-pressed={mini}>
            <Icon name="left" size="sm" />
          </button>
          <nav className="v4-nav" aria-label="Modules">{nav}</nav>
          <div className="v4-side-foot">
            <Link className="v4-me" href={ACCOUNT_MODULE.href} title="My Account" aria-current={active?.key === "account" ? "page" : undefined}>
              <span className="v4-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element -- photo from Supabase Storage */}
                {me?.avatarUrl ? <img src={me.avatarUrl} alt="" /> : initialsOf(firstName || "ReqGen")}
              </span>
              <span><b>{me?.name || "…"}</b><small>My Account</small></span>
            </Link>
            <button className="v4-icon-btn v4-out" type="button" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}><Icon name="logout" /></button>
          </div>
        </aside>
        <button className={`v4-backdrop ${drawer ? "v4-show" : ""}`} type="button" aria-label="Close menu" onClick={() => setDrawer(false)} tabIndex={drawer ? 0 : -1} />
        <div className="v4-stage">
          <header className="v4-ui v4-topbar">
            <button className="v4-icon-btn v4-menu-btn" type="button" aria-label="Open menu" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
            {/* One greeting per screen: the Dashboard shows its own large greeting. */}
            {pathname !== "/dashboard" ? (
              <div className="v4-greet" aria-live="polite"><DayIcon hour={hour} size={16} />{dayPart(hour).text},&nbsp;<b>{(me?.name || "").toUpperCase()}</b></div>
            ) : <div className="v4-greet-space" />}
            <Search roleSet={roleSet} />
            <div className="v4-top-actions">
              <Bell userId={me?.userId ?? null} pendingApprovalCount={pending} onUnread={setUnread} />
              <RoleSelect systemAccount={me?.systemAccount} />
              {me ? <AvatarMenu me={me} onSignOut={() => void signOut()} /> : <span className="v4-avatar" aria-hidden="true">…</span>}
            </div>
          </header>
          <LoadBar />
          <SetupCoach />
          <main className="v4-main" id="reqgen-main-content">
            <div className="v4-content">
              <nav className="v4-ui v4-crumbs" aria-label="You are here">
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <span key={`${c.label}-${i}`} style={{ display: "contents" }}>
                      {i > 0 ? <Icon name="right" /> : null}
                      {c.href && !last ? <Link href={c.href}>{c.label}</Link> : <span aria-current={last ? "page" : undefined}>{c.label}</span>}
                    </span>
                  );
                })}
              </nav>
              {children}
            </div>
          </main>
          <V4Footer />
        </div>
      </div>
    </>
  );
}
