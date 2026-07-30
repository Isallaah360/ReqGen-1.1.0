"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Assignment = { section_key: string; permission_key: string; is_active: boolean };

type Props = {
  children: ReactNode;
  section?: string;
  permission?: string;
  bossOnly?: boolean;
};

function key(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export default function HRAccessGuard({ children, section, permission = "view", bossOnly = false }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const normalizedSection = useMemo(() => key(section), [section]);

  useEffect(() => {
    let active = true;
    async function check() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        router.replace("/login?next=/hr");
        return;
      }

      const [{ data: profile }, { data: profileRoles }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        supabase.from("profile_roles").select("role_key,role_name,is_active").eq("profile_id", user.id).eq("is_active", true),
      ]);

      const roles = new Set<string>();
      roles.add(key(profile?.role));
      for (const item of profileRoles || []) {
        roles.add(key(item.role_key));
        roles.add(key(item.role_name));
      }

      const isAdmin = roles.has("admin");
      const isBoss = roles.has("hrboss") || roles.has("hr");

      if (isAdmin || isBoss) {
        if (active) {
          setAllowed(true);
          setReady(true);
        }
        return;
      }

      if (bossOnly || !normalizedSection) {
        if (active) {
          setAllowed(false);
          setReady(true);
          router.replace("/unauthorized?from=/hr");
        }
        return;
      }

      const { data: assignments } = await supabase
        .from("hr_officer_assignments")
        .select("section_key,permission_key,is_active")
        .eq("officer_id", user.id)
        .eq("is_active", true);

      const permitted = ((assignments || []) as Assignment[]).some(
        (item) => key(item.section_key) === normalizedSection && ["view", key(permission), "manage"].includes(key(item.permission_key))
      );

      if (active) {
        setAllowed(permitted);
        setReady(true);
        if (!permitted) router.replace("/unauthorized?from=/hr");
      }
    }
    check().catch(() => {
      if (active) {
        setReady(true);
        setAllowed(false);
        router.replace("/unauthorized?reason=hr-access");
      }
    });
    return () => { active = false; };
  }, [bossOnly, normalizedSection, permission, router]);

  if (!ready) return <div className="min-h-[60vh] grid place-items-center text-sm font-bold text-slate-600">Verifying HR access…</div>;
  if (!allowed) return null;
  return <>{children}</>;
}
