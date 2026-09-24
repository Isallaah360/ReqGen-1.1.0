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

  // Access verification runs silently. Only an actual denial/error redirects the user.
  if (checking) return null;

  if (!allowed) return null;
  return <>{children}</>;
}
