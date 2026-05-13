"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/mfa", "/mfa/setup"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return false;
}

export default function MfaGuard() {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function checkMfa() {
      if (isPublicPath(pathname)) return;

      setChecking(true);

      try {
        const { data: authData } = await supabase.auth.getUser();

        if (!authData.user) {
          router.push("/login");
          return;
        }

        const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();

        if (factorsErr) {
          router.push("/login");
          return;
        }

        const verifiedTotpFactors = factorsData.totp.filter(
          (factor) => factor.status === "verified"
        );

        if (verifiedTotpFactors.length === 0) {
          router.push("/mfa/setup");
          return;
        }

        const { data: aalData, error: aalErr } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalErr) {
          router.push("/login");
          return;
        }

        if (aalData.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
          router.push("/mfa");
          return;
        }
      } finally {
        setChecking(false);
      }
    }

    checkMfa();
  }, [pathname, router]);

  if (!checking) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-white/80 px-4 backdrop-blur">
      <div className="rounded-3xl border bg-white px-6 py-5 text-center shadow-2xl">
        <div className="text-base font-extrabold text-slate-900">Checking security session...</div>
        <div className="mt-1 text-sm text-slate-600">Please wait.</div>
      </div>
    </div>
  );
}