"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth";
import { canAccessPath, isPublicPath } from "@/lib/permissions";

export default function RouteAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);

  const verifyAccess = useCallback(async () => {
    setVerifiedPath(null);
    if (isPublicPath(pathname)) {
      setVerifiedPath(pathname);
      return;
    }

    try {
      const context = await getCurrentAuthContext();
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
      router.replace("/unauthorized?reason=verification");
    }
  }, [pathname, router]);

  useEffect(() => {
    void verifyAccess();
    const refresh = () => void verifyAccess();
    window.addEventListener("reqgen-active-role-changed", refresh);
    return () => window.removeEventListener("reqgen-active-role-changed", refresh);
  }, [verifyAccess]);

  if (verifiedPath !== pathname) return null;
  return <>{children}</>;
}
