"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { confirmDialog } from "@/lib/dialog";
import { installFileShare, isApp, printScreen } from "@/lib/app/native";
import { APP_UPDATE_EVENT, newerRelease, type AppRelease } from "@/lib/app/update";
import { lockDue, pinIsSet, pinMatches, touchActive } from "@/lib/app/pin";
import { checkFingerprint, fingerprintReady } from "@/lib/app/biometric";
import UpdateSheet from "./UpdateSheet";

/**
 * ReqGen v4.6.11 — phone side of ReqGen (brief §5 and §7).
 *
 * On the website: a note when Chrome's "Desktop site" is on, and a solid
 * tab bar on low-power phones. In the app also:
 *  - the status bar follows light and dark;
 *  - the back button closes an open box first, goes back, and leaves the app only from Home;
 *  - "You are offline" with Try again;
 *  - files open the Share box; Print opens the phone's print screen (Save as PDF);
 *  - no website pages: Home page and Get the app send the person to sign-in or Home;
 *  - the app PIN and fingerprint lock;
 *  - checks for a newer APK (Home shows "New update available").
 */

const HOME_PATHS = new Set(["/dashboard", "/developer", "/login"]);
const WEBSITE_ONLY = new Set(["/", "/app"]);
const PUBLIC = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/mfa", "/mfa/setup", "/unauthorized", "/app", "/console"]);
const OPEN_BOX = ".rg-dialog-backdrop, #v4-me-sheet.v4-open, .v4-drawer-open, [role='dialog'][aria-modal='true'], [role='alertdialog'], .v4-sel-pop, .v4-avatar-menu, .v4-search-results, .v4-bell-panel";

function AppLock({ onOpen }: { onOpen: () => void }) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [fp, setFp] = useState(false);
  const tryFinger = useCallback(async () => {
    setMsg(null);
    try { await checkFingerprint("Open ReqGen"); onOpen(); } catch (e) { setMsg(e instanceof Error ? e.message : "Try again."); }
  }, [onOpen]);
  useEffect(() => { void fingerprintReady().then(setFp); }, []);
  async function press(d: string) {
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (next.length === 6) {
      if (await pinMatches(next)) onOpen();
      else { setMsg("That PIN is not right. Try again."); setPin(""); }
    }
  }
  return (
    <div className="v4-ui v4-app-lock" role="dialog" aria-modal="true" aria-labelledby="v4-lock-title">
      {/* eslint-disable-next-line @next/next/no-img-element -- packed logo */}
      <img src="/v4/iet-logo.png" alt="Islamic Education Trust logo" />
      <h1 id="v4-lock-title">ReqGen is locked</h1>
      <p className="v4-muted" style={{ margin: 0 }}>Enter your app PIN</p>
      <div className="v4-pin-dots" aria-label={`${pin.length} of 6 numbers typed`}>{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < pin.length ? "on" : undefined} />)}</div>
      {msg ? <p role="alert" style={{ margin: 0, color: "var(--v4-red)", fontWeight: 700 }}>{msg}</p> : null}
      <div className="v4-pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} type="button" onClick={() => void press(d)}>{d}</button>)}
        <span />
        <button type="button" onClick={() => void press("0")}>0</button>
        <button type="button" className="v4-pin-word" onClick={() => setPin((p) => p.slice(0, -1))}>Delete</button>
      </div>
      {fp ? <button className="v4-btn v4-btn-primary v4-btn-lg" type="button" onClick={() => void tryFinger()}>Use fingerprint</button> : null}
    </div>
  );
}

export default function AppBridge() {
  const [app, setApp] = useState(false);
  const [offline, setOffline] = useState(false);
  const [locked, setLocked] = useState(false);
  const [desktopNote, setDesktopNote] = useState(false);
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const router = useRouter();
  const pathname = usePathname() || "/";
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  // Website and app: low-power phones get plain skeletons and a solid tab bar;
  // a phone in Chrome's "Desktop site" mode gets a short note.
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if ((nav.deviceMemory && nav.deviceMemory <= 2) || nav.connection?.saveData) document.documentElement.classList.add("v4-low-power");
    const inApp = isApp();
    if (inApp) document.documentElement.setAttribute("data-app", "android");
    queueMicrotask(() => setApp(inApp));
    if (!inApp) {
      let dismissed = false;
      try { dismissed = sessionStorage.getItem("reqgen:desktop-note") === "1"; } catch { /* ignore */ }
      const touchPhone = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 760;
      if (!dismissed && touchPhone && window.innerWidth >= 900) queueMicrotask(() => setDesktopNote(true));
    }
  }, []);

  // In the app there are no website pages: Home page and Get the app go to sign-in or Home.
  useEffect(() => {
    if (!app || !WEBSITE_ONLY.has(pathname)) return;
    void supabase.auth.getSession().then(({ data }) => router.replace(data.session ? "/dashboard" : "/login"));
  }, [app, pathname, router]);

  const lockIfDue = useCallback(async () => {
    if (!(await pinIsSet())) return;
    const { data } = await supabase.auth.getSession();
    if (data.session && lockDue()) setLocked(true);
  }, []);

  const checkUpdate = useCallback(async () => {
    const r = await newerRelease();
    setRelease(r);
    (window as unknown as { __reqgenUpdate?: AppRelease | null }).__reqgenUpdate = r;
    window.dispatchEvent(new CustomEvent(APP_UPDATE_EVENT, { detail: r }));
  }, []);

  useEffect(() => {
    if (!app) return;
    const undo: Array<() => void> = [];
    let cancelled = false;
    void lockIfDue();
    void checkUpdate();

    void (async () => {
      const [{ App }, { Network }, { SplashScreen }, { StatusBar, Style }] = await Promise.all([
        import("@capacitor/app"), import("@capacitor/network"), import("@capacitor/splash-screen"), import("@capacitor/status-bar"),
      ]);
      if (cancelled) return;
      void SplashScreen.hide().catch(() => undefined);

      // Light bar with dark icons in light mode; dark bar with light icons in dark mode.
      const paintBar = () => {
        const dark = document.documentElement.dataset.theme === "dark";
        void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
        void StatusBar.setBackgroundColor({ color: dark ? "#0E1530" : "#F7F2EA" }).catch(() => undefined);
      };
      paintBar();
      const watch = new MutationObserver(paintBar);
      watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      undo.push(() => watch.disconnect());

      const back = await App.addListener("backButton", async () => {
        if (document.querySelector(OPEN_BOX)) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          return;
        }
        if (HOME_PATHS.has(pathRef.current)) {
          const leave = await confirmDialog({ title: "Exit ReqGen?", message: "You stay signed in on this phone.", confirmLabel: "Exit", cancelLabel: "Stay" });
          if (leave) void App.exitApp();
          return;
        }
        if (window.history.length > 1) window.history.back();
        else router.replace("/dashboard");
      });
      undo.push(() => void back.remove());

      // ReqGen links from SMS, email or WhatsApp open the right page in the app.
      const openLink = (raw: string | undefined) => {
        if (!raw) return;
        try {
          const u = new URL(raw);
          if (u.hostname === window.location.hostname && u.pathname !== pathRef.current) router.push(`${u.pathname}${u.search}${u.hash}`);
        } catch { /* not a ReqGen link */ }
      };
      const launch = await App.getLaunchUrl().catch(() => null);
      openLink(launch?.url);
      const link = await App.addListener("appUrlOpen", (e) => openLink(e.url));
      undo.push(() => void link.remove());

      const state = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) { void lockIfDue(); void checkUpdate(); } else touchActive();
      });
      undo.push(() => void state.remove());

      const status = await Network.getStatus();
      if (!cancelled) setOffline(!status.connected);
      const net = await Network.addListener("networkStatusChange", (s) => setOffline(!s.connected));
      undo.push(() => void net.remove());
    })();

    const oldPrint = window.print;
    window.print = () => {
      document.documentElement.classList.remove("reqgen-app-printing");
      document.getElementById("reqgen-app-print")?.remove();
      void printScreen(document.title || "ReqGen").catch(() => undefined);
    };
    undo.push(() => { window.print = oldPrint; });
    undo.push(installFileShare());

    const active = () => touchActive();
    window.addEventListener("pointerdown", active, { passive: true });
    undo.push(() => window.removeEventListener("pointerdown", active));
    const openUpdate = () => setShowUpdate(true);
    window.addEventListener("reqgen-open-update", openUpdate);
    undo.push(() => window.removeEventListener("reqgen-open-update", openUpdate));
    const recheck = () => void checkUpdate();
    window.addEventListener("reqgen-check-update", recheck);
    undo.push(() => window.removeEventListener("reqgen-check-update", recheck));

    return () => { cancelled = true; undo.forEach((u) => u()); };
  }, [app, router, lockIfDue, checkUpdate]);

  return (
    <>
      {desktopNote ? (
        <div className="v4-desktop-note" role="status">
          <span style={{ flex: 1 }}>Chrome is showing the desktop site. Open Chrome&rsquo;s menu and untick &ldquo;Desktop site&rdquo; for the phone layout.</span>
          <button type="button" onClick={() => { setDesktopNote(false); try { sessionStorage.setItem("reqgen:desktop-note", "1"); } catch { /* ignore */ } }}>OK</button>
        </div>
      ) : null}
      {app && offline ? (
        <div className="v4-app-banner v4-app-off" role="status">
          <span>You are offline. New data loads when the network returns.</span>
          <button type="button" onClick={() => { void import("@capacitor/network").then(({ Network }) => Network.getStatus()).then((s) => { setOffline(!s.connected); if (s.connected) router.refresh(); }); }}>Try again</button>
        </div>
      ) : null}
      {app && locked && !PUBLIC.has(pathname) ? <AppLock onOpen={() => { touchActive(); setLocked(false); }} /> : null}
      {app && release ? <UpdateSheet open={showUpdate} release={release} onClose={() => setShowUpdate(false)} /> : null}
    </>
  );
}
