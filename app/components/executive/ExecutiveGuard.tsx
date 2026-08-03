"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { activeRoleFromRpc, roleKey } from "@/app/components/enterprise/data";

const ALLOWED = new Set(["admin", "dg", "director", "auditor", "hrboss", "humanresourcesboss"]);

export default function ExecutiveGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: roleData } = await supabase.rpc("get_my_active_role");
      const activeRole = roleKey(activeRoleFromRpc(roleData));
      if (!ALLOWED.has(activeRole)) {
        router.replace("/unauthorized");
        return;
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== "aal2") {
        router.replace(`/mfa?next=${encodeURIComponent(pathname)}`);
        return;
      }

      if (!cancelled) setAllowed(true);
    }
    void check();
    return () => { cancelled = true; };
  }, [pathname, router]);

  if (allowed !== true) {
    return <div className="grid min-h-[60vh] place-items-center bg-slate-50"><div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 shadow-sm">Verifying executive access…</div></div>;
  }
  return <>{children}</>;
}
