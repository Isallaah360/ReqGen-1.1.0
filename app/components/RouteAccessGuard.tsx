"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth";
import { canAccessPath, isPublicPath } from "@/lib/permissions";

export default function RouteAccessGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      if (isPublicPath(pathname)) {
        if (active) setChecking(false);
        return;
      }

      if (active) setChecking(true);

      try {
        const context = await getCurrentAuthContext();

        if (!active) return;

        if (!context) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!canAccessPath(pathname, context.roleSet)) {
          router.replace(`/unauthorized?from=${encodeURIComponent(pathname)}`);
          return;
        }
      } catch (error) {
        console.error("Route access verification failed:", error);
        router.replace("/unauthorized?reason=verification");
      } finally {
        if (active) setChecking(false);
      }
    }

    verifyAccess();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (!checking) return null;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-slate-950/25 px-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[2rem] border border-blue-100 bg-white/95 px-8 py-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
        <div className="text-lg font-extrabold text-slate-950">Verifying access permissions</div>
        <div className="mt-2 text-sm font-medium text-slate-600">
          ReqGen is checking your authorised modules.
        </div>
      </div>
    </div>
  );
}
