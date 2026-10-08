"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { checkMfaWindow, signOutForExpiredWindow, startMfaWindow, storedWindowEnd } from "@/lib/mfaTrust";

const PUBLIC_PATHS = new Set([
  "/", "/login", "/signup", "/forgot-password", "/reset-password",
  "/mfa", "/mfa/setup", "/unauthorized",
]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * v3.1.14 — 12-hour two-factor window. One authenticator code is valid for 12
 * hours on this device: signing in again inside the window (for example after
 * the inactivity sign-out) does not ask for a new code. When the window ends
 * the person is signed out completely. A session signed out elsewhere (for
 * example when the real owner replaces the authenticator or the password) is
 * closed here within minutes.
 */
async function signedOutElsewhere() {
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  window.location.replace("/login?reason=signed-out");
}

async function revalidateWindow() {
  const end = storedWindowEnd();
  if (end && end <= Date.now()) { await signOutForExpiredWindow(); return; }
  const current = await checkMfaWindow();
  if (!current) return; // network trouble — try again later
  if (current.signedOut) { await signedOutElsewhere(); return; }
  if (current.trusted) return;
  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.data?.currentLevel === "aal2") {
    const started = await startMfaWindow();
    if (started && !started.trusted) await signOutForExpiredWindow();
    return;
  }
  await signOutForExpiredWindow();
}

export default function MfaGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [protectedSessionVerified, setProtectedSessionVerified] = useState(false);
  const [checking, setChecking] = useState(false);
  const verifyRun = useRef(0);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setProtectedSessionVerified(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Watch the window while the person works: on time, on focus, every few minutes.
  useEffect(() => {
    if (!protectedSessionVerified) return;
    const tick = window.setInterval(() => {
      const end = storedWindowEnd();
      if (end && end <= Date.now()) void signOutForExpiredWindow();
    }, 30_000);
    const check = window.setInterval(() => { void revalidateWindow(); }, 5 * 60_000);
    const onFocus = () => { if (document.visibilityState === "visible") void revalidateWindow(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(check);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [protectedSessionVerified]);

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname) || protectedSessionVerified) return;

    let mounted = true;
    const run = ++verifyRun.current;
    setChecking(true);

    async function verify() {
      try {
        let sessionResult = await supabase.auth.getSession();
        if (!sessionResult.data.session?.user) {
          await delay(250);
          sessionResult = await supabase.auth.getSession();
        }
        if (!mounted || run !== verifyRun.current) return;
        if (!sessionResult.data.session?.user) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        let factorsResult = await supabase.auth.mfa.listFactors();
        if (factorsResult.error) {
          await delay(350);
          factorsResult = await supabase.auth.mfa.listFactors();
        }
        if (!mounted || run !== verifyRun.current) return;
        if (factorsResult.error || !factorsResult.data) return;

        const hasVerifiedTotp = factorsResult.data.totp.some((factor) => factor.status === "verified");
        if (!hasVerifiedTotp) {
          router.replace(`/mfa/setup?next=${encodeURIComponent(pathname)}`);
          return;
        }

        const aalResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!mounted || run !== verifyRun.current) return;
        if (aalResult.error) return;
        if (aalResult.data.currentLevel === "aal2") {
          // Code entered on this session: start / confirm the 12-hour window.
          const started = await startMfaWindow();
          if (!mounted || run !== verifyRun.current) return;
          if (started?.signedOut) { await signedOutElsewhere(); return; }
          if (started && started.expired) { await signOutForExpiredWindow(); return; }
        } else if (aalResult.data.nextLevel === "aal2") {
          // New sign-in: inside a valid 12-hour window no new code is needed.
          const current = await checkMfaWindow();
          if (!mounted || run !== verifyRun.current) return;
          if (current?.signedOut) { await signedOutElsewhere(); return; }
          if (!current?.trusted) {
            router.replace(`/mfa?next=${encodeURIComponent(pathname)}`);
            return;
          }
        }

        setProtectedSessionVerified(true);
      } catch (error) {
        console.error("Silent MFA verification failed:", error);
      } finally {
        if (mounted && run === verifyRun.current) setChecking(false);
      }
    }

    void verify();
    return () => { mounted = false; };
  }, [pathname, protectedSessionVerified, router]);

  if (PUBLIC_PATHS.has(pathname) || protectedSessionVerified) return <>{children}</>;

  return (
    <section className="rg-route-transition" aria-live="polite" aria-busy={checking}>
      <div className="rg-route-transition__bar" />
      <div className="rg-route-transition__card"><div><strong>Securing your session</strong><p>ReqGen is confirming MFA access…</p></div></div>
    </section>
  );
}
