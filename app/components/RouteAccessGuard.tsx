"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentAuthContext } from "@/lib/auth";
import { canAccessPath, isPublicPath } from "@/lib/permissions";

export default function RouteAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const requestId = useRef(0);

  const verifyAccess = useCallback(async (force = false) => {
    const id = ++requestId.current;

    if (isPublicPath(pathname)) {
      setVerifiedPath(pathname);
      setChecking(false);
      return;
    }

    if (force) setVerifiedPath(null);
    setChecking(true);

    try {
      const context = await getCurrentAuthContext();
      if (id !== requestId.current) return;

      if (!context) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const activeRoleOnly = new Set<string>();
      if (context.activeRoleKey) activeRoleOnly.add(context.activeRoleKey);

      if (!canAccessPath(pathname, activeRoleOnly)) {
        router.replace(`/unauthorized?from=${encodeURIComponent(pathname)}&role=${encodeURIComponent(context.activeRoleKey || "staff")}`);
        return;
      }

      setVerifiedPath(pathname);
    } catch (error) {
      console.error("Silent route authorization failed:", error);
      if (id === requestId.current) router.replace("/unauthorized?reason=verification");
    } finally {
      if (id === requestId.current) setChecking(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    void verifyAccess(false);
    const refresh = () => void verifyAccess(true);
    window.addEventListener("reqgen-active-role-changed", refresh);
    return () => window.removeEventListener("reqgen-active-role-changed", refresh);
  }, [verifyAccess]);

  if (isPublicPath(pathname) || verifiedPath === pathname) return <>{children}</>;

  return (
    <section className="rg-route-transition" aria-live="polite" aria-busy={checking}>
      <div className="rg-route-transition__bar" />
      <div className="rg-route-transition__card">
        <span className="rg-route-transition__icon"><ShieldCheck size={20} /></span>
        <div><strong>Opening workspace</strong><p>Verifying access securely…</p></div>
      </div>
      <div className="rg-route-transition__grid" aria-hidden="true"><i /><i /><i /><i /></div>
    </section>
  );
}
