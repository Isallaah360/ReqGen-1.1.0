"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/mfa",
  "/mfa/setup",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MfaGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkMfa() {
      if (isPublicPath(pathname)) return;
      if (mounted) setChecking(true);

      try {
        // getSession is local and stable. Do not force users to Login because a
        // temporary network request to getUser/listFactors failed.
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user) {
          await delay(250);
          const retry = await supabase.auth.getSession();
          if (!retry.data.session?.user) {
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
            return;
          }
        }

        let factorsResult = await supabase.auth.mfa.listFactors();
        if (factorsResult.error) {
          await delay(500);
          factorsResult = await supabase.auth.mfa.listFactors();
        }

        if (factorsResult.error || !factorsResult.data) {
          console.warn("MFA factor verification was temporarily unavailable.");
          return;
        }

        const verifiedTotpFactors = factorsResult.data.totp.filter(
          (factor) => factor.status === "verified"
        );

        if (verifiedTotpFactors.length === 0) {
          router.replace("/mfa/setup");
          return;
        }

        const aalResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalResult.error) {
          console.warn("MFA assurance verification was temporarily unavailable.");
          return;
        }

        if (
          aalResult.data.nextLevel === "aal2" &&
          aalResult.data.currentLevel !== "aal2"
        ) {
          router.replace("/mfa");
        }
      } catch (error) {
        console.error("MFA guard verification failed without ending the session:", error);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    void checkMfa();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!checking) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/20 px-4 backdrop-blur-sm">
      <div className="rounded-[2rem] border border-slate-200 bg-white px-7 py-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        <div className="text-base font-bold text-slate-900">Checking security session...</div>
        <div className="mt-1 text-sm text-slate-600">Please wait.</div>
      </div>
    </div>
  );
}
