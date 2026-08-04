"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, UserRound, X } from "lucide-react";

export interface ERPTopNavbarUser {
  fullName: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

export interface ERPTopNavbarProps {
  user: ERPTopNavbarUser;
  moduleTitle: string;
  roleSwitcher?: ReactNode;
  notificationCount?: number;
  onMobileMenu: () => void;
  onSearch?: (query: string) => void;
  onLogout?: () => void | Promise<void>;
}

function greetingFor(hour: number) {
  if (hour < 12) return "GOOD MORNING";
  if (hour < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "RG";
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`).toUpperCase();
}

/** Persistent top navigation using the authenticated user's real profile values. */
export default function ERPTopNavbar({
  user,
  moduleTitle,
  roleSwitcher,
  notificationCount = 0,
  onMobileMenu,
  onSearch,
  onLogout,
}: ERPTopNavbarProps) {
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const dateText = useMemo(() => now.toLocaleDateString("en-NG", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }), [now]);
  const timeText = useMemo(() => now.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }), [now]);

  return (
    <header className="erp2-topbar">
      <div className="erp2-topbar__identity">
        <button type="button" className="erp2-topbar__menu" onClick={onMobileMenu} aria-label="Open navigation"><Menu size={20} /></button>
        <div><span>{greetingFor(now.getHours())},</span><strong>{user.fullName}</strong><small>{moduleTitle}</small></div>
      </div>

      <form className="erp2-topbar__search" onSubmit={(event) => { event.preventDefault(); onSearch?.(query); }} role="search">
        <Search size={17} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ReqGen ERP..." aria-label="Search ReqGen ERP" />
        {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button> : <kbd>Ctrl K</kbd>}
      </form>

      <div className="erp2-topbar__actions">
        {roleSwitcher ? <div className="erp2-topbar__role">{roleSwitcher}</div> : null}
        <div className="erp2-topbar__clock"><span>{dateText}</span><strong>{timeText}</strong></div>
        <Link className="erp2-topbar__icon" href="/erp-2/notifications" aria-label={`${notificationCount} notifications`}>
          <Bell size={18} />{notificationCount > 0 ? <b>{notificationCount > 99 ? "99+" : notificationCount}</b> : null}
        </Link>

        <div className="erp2-profile" ref={profileRef}>
          <button type="button" className="erp2-profile__trigger" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
            <span className="erp2-profile__avatar">{initials(user.fullName)}</span>
            <span className="erp2-profile__copy"><strong>{user.fullName}</strong><small>{user.role ?? "User"}</small></span>
            <ChevronDown size={15} />
          </button>
          {profileOpen ? (
            <div className="erp2-profile__menu">
              <header><strong>{user.fullName}</strong>{user.email ? <span>{user.email}</span> : null}</header>
              <Link href="/erp-2/profile" onClick={() => setProfileOpen(false)}><UserRound size={16} /> My Profile</Link>
              <Link href="/erp-2/settings" onClick={() => setProfileOpen(false)}><Settings size={16} /> Settings</Link>
              <button type="button" onClick={async () => { setProfileOpen(false); await onLogout?.(); }}><LogOut size={16} /> Logout</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
