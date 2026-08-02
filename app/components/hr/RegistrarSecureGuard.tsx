"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentAuthContext } from "@/lib/auth";
import { normalizeRole } from "@/lib/roles";

const ALLOWED_ROLES = new Set([
  "admin",
  "hrboss",
  "humanresourcesboss",
  "registrar",
  "registrarofficer",
  "hrregistrar",
]);

export default function RegistrarSecureGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function verify() {
      setReady(false);

      const context = await getCurrentAuthContext();
      if (!context) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/hr/registrar")}`);
        return;
      }

      const activeRole = normalizeRole(context.activeRoleKey);
      if (!ALLOWED_ROLES.has(activeRole)) {
        if (mounted) {
          setAllowed(false);
          setReady(true);
        }
        router.replace(
          `/unauthorized?from=${encodeURIComponent(pathname || "/hr/registrar")}&reason=registrar-governance-role-required`
        );
        return;
      }

      const factors = await supabase.auth.mfa.listFactors();
      const hasVerifiedTotp = Boolean(
        factors.data?.totp?.some((factor) => factor.status === "verified")
      );

      if (!hasVerifiedTotp) {
        router.replace(`/mfa/setup?next=${encodeURIComponent(pathname || "/hr/registrar")}`);
        return;
      }

      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (
        !assurance.error &&
        assurance.data.nextLevel === "aal2" &&
        assurance.data.currentLevel !== "aal2"
      ) {
        router.replace(`/mfa?next=${encodeURIComponent(pathname || "/hr/registrar")}`);
        return;
      }

      if (mounted) {
        setAllowed(true);
        setReady(true);
      }
    }

    void verify().catch((error) => {
      console.error("Registrar governance verification failed:", error);
      if (mounted) {
        setAllowed(false);
        setReady(true);
      }
      router.replace(
        `/unauthorized?from=${encodeURIComponent(pathname || "/hr/registrar")}&reason=registrar-security-check`
      );
    });

    const refresh = () => void verify();
    window.addEventListener("reqgen-active-role-changed", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("reqgen-active-role-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-[2rem] border border-cyan-100 bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-800 to-cyan-600 text-white shadow-lg">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="mx-auto mt-5 h-9 w-9 animate-spin rounded-full border-4 border-cyan-100 border-t-blue-800" />
          <p className="mt-4 text-base font-black text-slate-950">Verifying Registrar authority and 2FA</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">Only Admin, HR Boss and Registrar may continue.</p>
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}
