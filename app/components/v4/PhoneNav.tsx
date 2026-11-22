"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { canAccessPath } from "@/lib/permissions";
import { THEME_EVENT, applyTheme, readThemeMode, type ThemeMode } from "@/lib/theme";
import { confirmDialog, promptDialog } from "@/lib/dialog";
import { useApp } from "@/lib/app/useApp";
import { clearPin, pinIsSet, setPin } from "@/lib/app/pin";
import { fingerprintReady, fingerprintSaved, forgetFingerprint, saveFingerprint } from "@/lib/app/biometric";
import { newerRelease } from "@/lib/app/update";
import { supabase } from "@/lib/supabaseClient";
import Icon from "./Icon";

/**
 * ReqGen v4.6.11 — phones (brief §5): the frosted-glass bottom tab bar
 * (Home, Requests, New, Approvals, Me) and the Me page, which holds only the
 * person's own account. Every other page opens from Home.
 */

type Who = { name: string; avatarUrl: string | null; roleName: string; roleSet: Set<string>; systemAccount: string | null };

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "RG";
}

/** People who approve: any position other than plain staff. */
export function approves(roleSet: Set<string>) {
  return [...roleSet].some((r) => r !== "staff");
}

/**
 * v4.6.12 (Kit K6): the orange marker slides to the chosen tab on the spring
 * (about 450 ms, transform only). New keeps its raised button and has no
 * marker. Reduced motion: the marker jumps.
 */
function placeMarker(bar: HTMLElement | null, mark: HTMLElement | null) {
  if (!bar || !mark) return;
  const on = bar.querySelector<HTMLElement>('[aria-current="page"], button[aria-expanded="true"]');
  if (!on || on.querySelector(".v4-tab-fab")) { mark.classList.remove("k-on"); return; }
  const x = on.offsetLeft + on.offsetWidth / 2 - 11;
  const fresh = !mark.classList.contains("k-on");
  if (fresh) mark.style.transition = "none"; // the first placement jumps; only moves between tabs slide
  mark.style.transform = `translateX(${Math.round(x)}px)`;
  mark.classList.add("k-on");
  if (fresh) { void mark.offsetWidth; mark.style.transition = ""; }
}

function useTabMarker(nav: React.RefObject<HTMLElement | null>, key: string) {
  const pill = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => { placeMarker(nav.current, pill.current); }, [nav, key]);
  useEffect(() => {
    const on = () => placeMarker(nav.current, pill.current);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [nav]);
  return pill;
}

export function PhoneTabBar(props: { pathname: string; me: Who | null; pending: number; meOpen: boolean; onMe: () => void }) {
  if (!props.me) return null;
  return <PhoneTabs {...props} me={props.me} />;
}

function PhoneTabs({ pathname, me, pending, meOpen, onMe }: { pathname: string; me: Who; pending: number; meOpen: boolean; onMe: () => void }) {
  const navRef = useRef<HTMLElement>(null);
  const pill = useTabMarker(navRef, `${pathname}|${meOpen}`);
  const isDeveloper = me.systemAccount === "developer";
  const at = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  const home = isDeveloper ? "/developer" : "/dashboard";
  const cur = (on: boolean) => (on && !meOpen ? "page" : undefined);
  const canRequest = canAccessPath("/requests/mine", me.roleSet);
  const canNew = canAccessPath("/requests/new", me.roleSet);
  const showApprovals = approves(me.roleSet) && canAccessPath("/approvals", me.roleSet);
  return (
    <nav className="v4-tabbar k-has-pill" aria-label="Main" ref={navRef}>
      <span className="k-pill" ref={pill} aria-hidden="true" />
      <Link href={home} aria-current={cur(pathname === home)}><Icon name="dashboard" />Home</Link>
      {canRequest ? <Link href="/requests/mine" aria-current={cur(at("/requests") && !at("/requests/new"))}><Icon name="file" />Requests</Link> : null}
      {canNew ? <Link href="/requests/new" aria-current={cur(at("/requests/new"))} aria-label="New request"><span className="v4-tab-fab"><Icon name="plus" /></span>New</Link> : null}
      {showApprovals ? (
        <Link href="/approvals" aria-current={cur(at("/approvals"))}>
          <Icon name="shield" />Approvals{pending > 0 ? <span className="v4-tab-dot k-pop" aria-label={`${pending} waiting`} /> : null}
        </Link>
      ) : null}
      <button type="button" onClick={onMe} aria-expanded={meOpen} aria-controls="v4-me-sheet"><Icon name="user" />Me</button>
    </nav>
  );
}

const TONES = ["", "v4-t-green", "v4-t-blue", "v4-t-amber", "v4-t-red"];

function Row({ href, icon, title, sub, tone = 0, onClick, right }: { href?: string; icon: string; title: string; sub?: string; tone?: number; onClick?: () => void; right?: React.ReactNode }) {
  const inner = (
    <>
      <span className={`v4-me-ic ${TONES[tone % TONES.length]}`}><Icon name={icon} /></span>
      <span className="v4-me-t"><b>{title}</b>{sub ? <small>{sub}</small> : null}</span>
      {right ?? <Icon name="right" size="sm" />}
    </>
  );
  return href ? <Link className="v4-me-row" href={href} onClick={onClick}>{inner}</Link> : <button className="v4-me-row" type="button" onClick={onClick}>{inner}</button>;
}

function Toggle({ on }: { on: boolean }) {
  return <span className="v4-toggle" data-on={on} aria-hidden="true" style={{ pointerEvents: "none" }} />;
}

/** App only: the app PIN and fingerprint sign-in. */
function PinAndFingerprint() {
  const [pin, setPinOn] = useState(false);
  const [fpReady, setFpReady] = useState(false);
  const [fp, setFp] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(async () => {
    setPinOn(await pinIsSet());
    const ready = await fingerprintReady();
    setFpReady(ready);
    setFp(ready && (await fingerprintSaved()));
  }, []);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  async function togglePin() {
    setNote(null);
    if (pin) {
      if (await confirmDialog({ title: "Turn off the app PIN?", message: "ReqGen will open without a PIN on this phone.", confirmLabel: "Turn off" })) { await clearPin(); setNote("App PIN is off."); }
    } else {
      const first = await promptDialog({ title: "Choose an app PIN", message: "Six numbers that open ReqGen on this phone, even with no network.", label: "New PIN", inputType: "pin", confirmLabel: "Next" });
      if (!first) return;
      if (!/^\d{6}$/.test(first)) { setNote("Use exactly six numbers."); return; }
      const again = await promptDialog({ title: "Type the PIN again", label: "Same PIN", inputType: "pin", confirmLabel: "Save" });
      if (again !== first) { setNote("The two PINs were not the same. Try again."); return; }
      await setPin(first); setNote("App PIN is on.");
    }
    await load();
  }

  async function toggleFp() {
    setNote(null);
    if (fp) { await forgetFingerprint(); setNote("Fingerprint sign-in is off."); await load(); return; }
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return;
    const password = await promptDialog({ title: "Turn on fingerprint sign-in", message: "Type your ReqGen password once. It is kept in this phone's secure store, locked by your fingerprint.", label: "Password", inputType: "password", confirmLabel: "Continue" });
    if (!password) return;
    try { await saveFingerprint(email, password); setNote("Fingerprint sign-in is on."); }
    catch (e) { setNote(e instanceof Error ? e.message : "That did not work."); }
    await load();
  }

  return (
    <>
      <button className="v4-me-row" type="button" role="switch" aria-checked={pin} onClick={() => void togglePin()}>
        <span className="v4-me-ic v4-t-amber"><Icon name="key" /></span>
        <span className="v4-me-t"><b>App PIN</b><small>Opens ReqGen on this phone</small></span>
        <Toggle on={pin} />
      </button>
      {fpReady ? (
        <button className="v4-me-row" type="button" role="switch" aria-checked={fp} onClick={() => void toggleFp()}>
          <span className="v4-me-ic v4-t-green"><Icon name="fingerprint" /></span>
          <span className="v4-me-t"><b>Fingerprint</b><small>Sign in and open ReqGen with your finger</small></span>
          <Toggle on={fp} />
        </button>
      ) : null}
      {note ? <p role="status" className="v4-muted" style={{ margin: "0 0 10px", fontSize: 13 }}>{note}</p> : null}
    </>
  );
}

/** App only: Me › Settings (Check for updates, About). */
function AppSettings({ version, build }: { version: string | null; build: number }) {
  const [state, setState] = useState<string | null>(null);
  async function check() {
    setState("Checking…");
    const r = await newerRelease();
    if (r) { setState(`ReqGen ${r.version} is ready.`); window.dispatchEvent(new Event("reqgen-check-update")); window.setTimeout(() => window.dispatchEvent(new Event("reqgen-open-update")), 300); }
    else setState("You have the newest version.");
  }
  return (
    <>
      <div className="v4-me-card">
        <Row icon="download" title="Check for updates" sub={state || "New versions also show on Home"} onClick={() => void check()} right={<span className="v4-btn v4-btn-secondary" style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }}>Check</span>} />
      </div>
      <p className="v4-me-label">About</p>
      <div className="v4-me-card">
        <dl className="v4-me-kv">
          <dt>App version</dt><dd>{version ? `${version} (build ${build})` : "…"}</dd>
          <dt>For</dt><dd>Islamic Education Trust</dd>
          <dt>Developed by</dt><dd>Barderian Enterprises</dd>
          <dt>WhatsApp</dt><dd><a href="https://wa.me/2348031197746">0803 119 7746</a></dd>
          <dt>Email</dt><dd><a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a></dd>
        </dl>
      </div>
      <div className="v4-me-card">
        <Row href="/credits" icon="book" title="Open-source credits" sub="The software inside ReqGen" />
      </div>
    </>
  );
}

export function MeSheet({ open, onClose, me, onSignOut }: { open: boolean; onClose: () => void; me: Who | null; onSignOut: () => void }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [view, setView] = useState<"main" | "settings">("main");
  const { app, version, build } = useApp();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    queueMicrotask(() => setMode(readThemeMode()));
    const on = () => setMode(readThemeMode());
    window.addEventListener(THEME_EVENT, on);
    return () => window.removeEventListener(THEME_EVENT, on);
  }, []);
  useEffect(() => { if (!open) queueMicrotask(() => setView("main")); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".rg-dialog-backdrop")) return;
      if (view === "settings") setView("main"); else onClose();
    };
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, view]);
  if (!me) return null;
  return (
    <div id="v4-me-sheet" className={`v4-ui v4-me-sheet ${open ? "v4-open" : ""}`} aria-hidden={!open}>
      <button className="v4-me-scrim" type="button" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="v4-me-panel" role="dialog" aria-modal="true" aria-labelledby="v4-me-title" tabIndex={-1} ref={panel}>
        <div className="v4-me-grab" aria-hidden="true" />
        <div className="v4-me-head">
          {view === "settings" ? <button className="v4-me-x" type="button" aria-label="Back" onClick={() => setView("main")}><Icon name="left" /></button> : null}
          <h2 id="v4-me-title">{view === "settings" ? "Settings" : "Me"}</h2>
          <button className="v4-me-x" type="button" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        {view === "settings" ? <AppSettings version={version} build={build} /> : (
          <>
            <div className="v4-me-card">
              <Link className="v4-me-who" href="/profile" onClick={onClose}>
                <span className="v4-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element -- photo from Supabase Storage */}
                  {me.avatarUrl ? <img src={me.avatarUrl} alt="" /> : initialsOf(me.name)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}><b>{me.name}</b><small>{me.roleName}</small></span>
                <Icon name="right" size="sm" />
              </Link>
            </div>
            <div className="v4-me-card">
              <Row href="/profile/details" icon="user" title="Profile and signature" sub="Name, photo, phone, signature" onClick={onClose} />
              <Row href="/change-password" icon="key" title="Password" sub="Change your password" tone={3} onClick={onClose} />
              <Row href="/profile/security" icon="lock" title="Security and devices" sub="2FA, passcode, signed-in devices" tone={2} onClick={onClose} />
              {app ? <PinAndFingerprint /> : <Row href="/profile/passcode" icon="fingerprint" title="Passcode and fingerprint" sub="Quick sign-in on this device" tone={1} onClick={onClose} />}
            </div>
            <div className="v4-me-card">
              <Row href="/notifications" icon="bell" title="Notifications" sub="SMS, email and in-app" onClick={onClose} />
              {app ? <Row icon="settings" title="Settings" sub="Check for updates, About" tone={2} onClick={() => setView("settings")} /> : null}
            </div>
            <p className="v4-me-label">Appearance</p>
            <div className="v4-me-seg" role="group" aria-label="Appearance">
              {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => { applyTheme(m); setMode(m); }}>{m === "light" ? "Light" : m === "dark" ? "Dark" : "Same as phone"}</button>
              ))}
            </div>
            <button className="v4-btn v4-btn-secondary v4-btn-lg v4-me-out" type="button" onClick={() => { onClose(); onSignOut(); }}><Icon name="logout" />Log out</button>
            {app && version ? <p className="v4-me-ver">ReqGen app {version}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
