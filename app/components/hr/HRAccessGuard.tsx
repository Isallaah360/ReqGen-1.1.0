"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  auditorAllowed?: boolean;
};

const SECTION_ALIASES: Record<string, string[]> = {
  filing: ["filing", "hrfiling", "stafffiling", "staff_filing"],
  leave: ["leave", "leavemanagement", "leave_management"],
  staff: ["staff", "stafffiles", "staff_filing", "stafffiling"],
  registrar: ["registrar", "registry", "registrarcentre"],
  archive: ["archive", "hrarchive", "hr_archive"],
  weeklyseminar: ["weeklyseminar", "weekly_seminar", "seminar"],
  staffcapacitybuilding: ["staffcapacitybuilding", "staff_capacity_building"],
  departmentcapacitybuilding: ["departmentcapacitybuilding", "department_capacity_building"],
  departmentkpi: ["departmentkpi", "department_kpi"],
  annual360assessment: ["annual360assessment", "annual_360_assessment", "annual360"],
};

function canonicalSection(value: string | null | undefined) {
  const normalized = normalizeRole(value);
  for (const [canonical, aliases] of Object.entries(SECTION_ALIASES)) {
    if (canonical === normalized || aliases.some((alias) => normalizeRole(alias) === normalized)) return canonical;
  }
  return normalized;
}

function assignmentMatches(item: Assignment, section: string, permission: string) {
  const sameSection = canonicalSection(item.section_key) === canonicalSection(section);
  const assignedPermission = normalizeRole(item.permission_key);
  const requestedPermission = normalizeRole(permission);
  const accepted = new Set(["view", requestedPermission, "process", "file", "recommend", "submittohrboss", "archive", "manage"]);
  return item.is_active && sameSection && accepted.has(assignedPermission);
}

export default function HRAccessGuard({
  children,
  section,
  permission = "view",
  bossOnly = false,
  auditorAllowed = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const normalizedSection = useMemo(() => canonicalSection(section), [section]);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const context = await getCurrentAuthContext();
      if (!context) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/hr")}`);
        return;
      }

      const activeRole = normalizeRole(context.activeRoleKey);
      const isAdmin = activeRole === "admin";
      const isHRBoss = ["hrboss", "hr", "humanresources", "humanresourcesboss"].includes(activeRole);
      const isAuditor = activeRole === "auditor";

      if (isAdmin || isHRBoss || (auditorAllowed && isAuditor)) {
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
          router.replace(`/unauthorized?from=${encodeURIComponent(pathname || "/hr")}&reason=hr-boss-required`);
        }
        return;
      }

      const { data, error } = await supabase
        .from("hr_officer_assignments")
        .select("section_key,permission_key,is_active")
        .eq("officer_id", context.userId)
        .eq("is_active", true);

      if (error) throw error;

      const assignments = (data || []) as Assignment[];
      const hasAssignment = assignments.some((item) => assignmentMatches(item, normalizedSection, permission));
      const activeFunctionalRole = activeRole.startsWith("hr:")
        ? canonicalSection(activeRole.slice(3)) === normalizedSection
        : ["hrofficer", "hrofficer1", "hrofficer2", "hrofficer3"].includes(activeRole);

      const permitted = hasAssignment && activeFunctionalRole;

      if (mounted) {
        setAllowed(permitted);
        setReady(true);
        if (!permitted) {
          router.replace(`/unauthorized?from=${encodeURIComponent(pathname || "/hr")}&reason=active-hr-assignment-required`);
        }
      }
    }

    check().catch((error) => {
      console.error("HR access verification failed:", error);
      if (mounted) {
        setReady(true);
        setAllowed(false);
        router.replace(`/unauthorized?from=${encodeURIComponent(pathname || "/hr")}&reason=hr-access`);
      }
    });

    const refresh = () => {
      setReady(false);
      void check();
    };

    window.addEventListener("reqgen-active-role-changed", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("reqgen-active-role-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [auditorAllowed, bossOnly, normalizedSection, pathname, permission, router]);

  if (!ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-slate-50 px-4">
        <div className="rounded-3xl border border-blue-100 bg-white px-8 py-7 text-center shadow-xl">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
          <div className="mt-4 text-sm font-black text-slate-700">Verifying HR authority...</div>
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}
