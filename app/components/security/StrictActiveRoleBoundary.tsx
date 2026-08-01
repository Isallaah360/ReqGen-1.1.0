"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  children: ReactNode;
  allowedRoles: string[];
  label?: string;
};

function normalizeRole(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, "");
}

function activeRoleFromRpc(value: unknown) {
  if (typeof value === "string") return normalizeRole(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeRole(record.active_role_key ?? record.role_key ?? record.role);
  }
  return "";
}

export default function StrictActiveRoleBoundary({
  children,
  allowedRoles,
  label = "this secured workspace",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const allowedRoleKey = useMemo(
    () => allowedRoles.map(normalizeRole).sort().join("|"),
    [allowedRoles]
  );

  const verify = useCallback(async () => {
    setChecking(true);
    setAllowed(false);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data, error } = await supabase.rpc("get_my_active_role");
      if (error) throw error;

      const activeRole = activeRoleFromRpc(data);
      const permitted = allowedRoleKey.split("|").includes(activeRole);

      if (!permitted) {
        router.replace(
          `/unauthorized?from=${encodeURIComponent(pathname)}&role=${encodeURIComponent(
            activeRole || "staff"
          )}&reason=strict-active-role`
        );
        return;
      }

      setAllowed(true);
    } catch (error) {
      console.error(`Unable to verify access to ${label}:`, error);
      router.replace(
        `/unauthorized?from=${encodeURIComponent(pathname)}&reason=role-verification`
      );
    } finally {
      setChecking(false);
    }
  }, [allowedRoleKey, label, pathname, router]);

  useEffect(() => {
    void verify();
    const refresh = () => void verify();
    window.addEventListener("reqgen-active-role-changed", refresh);
    return () => window.removeEventListener("reqgen-active-role-changed", refresh);
  }, [verify]);

  if (checking) {
    return (
      <div className="fixed inset-0 z-[9998] grid place-items-center bg-slate-950/30 px-4 backdrop-blur-md">
        <div className="w-full max-w-md rounded-[2rem] border border-blue-100 bg-white/95 px-8 py-8 text-center shadow-2xl">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
          <h1 className="mt-5 text-lg font-black text-slate-950">Verifying active-role authority</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            ReqGen is confirming that your selected working role permits access to {label}.
          </p>
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}
