"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PUBLIC_PATHS = new Set([
  "/", "/login", "/signup", "/forgot-password", "/reset-password",
  "/mfa", "/mfa/setup", "/unauthorized",
]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
        if (aalResult.data.nextLevel === "aal2" && aalResult.data.currentLevel !== "aal2") {
          router.replace(`/mfa?next=${encodeURIComponent(pathname)}`);
          return;
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
