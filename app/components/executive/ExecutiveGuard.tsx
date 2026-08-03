"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ALLOWED = new Set(["admin", "dg", "director", "auditor", "hrboss", "humanresourcesboss"]);

function roleKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function activeRoleFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return activeRoleFrom(value[0]);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return String(row.role_key ?? row.active_role_key ?? row.role_name ?? row.active_role ?? row.get_my_active_role ?? "");
  }
  return "";
}

export default function ExecutiveGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function verify() {
      setReady(false);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const [{ data: roleData }, factors, aal] = await Promise.all([
        supabase.rpc("get_my_active_role"),
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      const role = roleKey(activeRoleFrom(roleData));
      const verified = !factors.error && Boolean(factors.data?.totp.some((item) => item.status === "verified"));
      const isAal2 = !aal.error && aal.data.currentLevel === "aal2";

      if (!verified) {
        router.replace("/mfa/setup");
        return;
      }
      if (!isAal2) {
        router.replace(`/mfa?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!ALLOWED.has(role)) {
        router.replace(`/unauthorized?from=${encodeURIComponent(pathname)}&role=${encodeURIComponent(role || "staff")}`);
        return;
      }
      if (mounted) setReady(true);
    }
    void verify();
    return () => { mounted = false; };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="rounded-3xl border border-blue-100 bg-white px-8 py-7 text-center shadow-xl">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
          <p className="mt-4 font-black text-slate-950">Verifying executive authority</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Active role and 2FA are required.</p>
        </div>
      </div>
    );
  }
  return children;
}
