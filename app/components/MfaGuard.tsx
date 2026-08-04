"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setVerifiedPath(null);

    async function verify() {
      if (PUBLIC_PATHS.has(pathname)) {
        if (mounted) setVerifiedPath(pathname);
        return;
      }

      try {
        let sessionResult = await supabase.auth.getSession();
        if (!sessionResult.data.session?.user) {
          await delay(250);
          sessionResult = await supabase.auth.getSession();
        }
        if (!sessionResult.data.session?.user) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        let factorsResult = await supabase.auth.mfa.listFactors();
        if (factorsResult.error) {
          await delay(500);
          factorsResult = await supabase.auth.mfa.listFactors();
        }
        if (factorsResult.error || !factorsResult.data) return;

        const hasVerifiedTotp = factorsResult.data.totp.some((factor) => factor.status === "verified");
        if (!hasVerifiedTotp) {
          router.replace("/mfa/setup");
          return;
        }

        const aalResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalResult.error) return;
        if (aalResult.data.nextLevel === "aal2" && aalResult.data.currentLevel !== "aal2") {
          router.replace("/mfa");
          return;
        }

        if (mounted) setVerifiedPath(pathname);
      } catch (error) {
        console.error("Silent MFA verification failed:", error);
      }
    }

    void verify();
    return () => { mounted = false; };
  }, [pathname, router]);

  if (verifiedPath !== pathname) return null;
  return <>{children}</>;
}
