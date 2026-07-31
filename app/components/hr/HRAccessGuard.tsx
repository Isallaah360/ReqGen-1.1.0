"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentAuthContext } from "@/lib/auth";
import { normalizeRole } from "@/lib/roles";

type Assignment = {
  section_key: string;
  permission_key: string;
  is_active: boolean;
};

type Props = {
  children: ReactNode;
  section?: string;
  permission?: string;
  bossOnly?: boolean;
};

export default function HRAccessGuard({
  children,
  section,
  permission = "view",
  bossOnly = false,
}: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const normalizedSection = useMemo(() => normalizeRole(section), [section]);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const context = await getCurrentAuthContext();
      if (!context) {
        router.replace("/login?next=/hr");
        return;
      }

      // Ultimate access: Admin must never be blocked from testing or administering HR.
      if (context.isAdmin) {
        if (mounted) {
          setAllowed(true);
          setReady(true);
        }
        return;
      }

      const activeRole = normalizeRole(context.activeRoleKey);
      const isBoss = ["hrboss", "hr"].includes(activeRole);

      if (isBoss) {
        if (mounted) {
          setAllowed(true);
          setReady(true);
        }
        return;
      }

      if (bossOnly || !normalizedSection) {
        if (mounted) {
          setAllowed(false);
          setReady(true);
          router.replace("/unauthorized?from=/hr&reason=hr-boss-required");
        }
        return;
      }

      const activeFunctionalRole = activeRole === `hr:${normalizedSection}`;
      const { data: assignments, error } = await supabase
        .from("hr_officer_assignments")
        .select("section_key,permission_key,is_active")
        .eq("officer_id", context.userId)
        .eq("is_active", true);

      if (error) throw error;

      const permittedAssignment = ((assignments || []) as Assignment[]).some((item) => {
        const sameSection = normalizeRole(item.section_key) === normalizedSection;
        const permissionKey = normalizeRole(item.permission_key);
        return sameSection && ["view", normalizeRole(permission), "manage"].includes(permissionKey);
      });

      const permitted = activeFunctionalRole && permittedAssignment;

      if (mounted) {
        setAllowed(permitted);
        setReady(true);
        if (!permitted) {
          router.replace(`/unauthorized?from=/hr/${normalizedSection}&reason=active-hr-role-required`);
        }
      }
    }

    check().catch((error) => {
      console.error("HR access verification failed:", error);
      if (mounted) {
        setReady(true);
        setAllowed(false);
        router.replace("/unauthorized?reason=hr-access");
      }
    });

    const refresh = () => {
      setReady(false);
      check();
    };
    window.addEventListener("reqgen-active-role-changed", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("reqgen-active-role-changed", refresh);
    };
  }, [bossOnly, normalizedSection, permission, router]);

  if (!ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-slate-50 px-4">
        <div className="rounded-3xl border border-blue-100 bg-white px-8 py-7 text-center shadow-xl">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
          <div className="mt-4 text-sm font-black text-slate-700">Verifying HR role context...</div>
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}
