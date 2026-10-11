"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentAuthContext } from "@/lib/auth";
import { roleDisplayName } from "@/lib/roles";

export type V4Identity = {
  ready: boolean;
  userId: string;
  email: string;
  name: string;
  firstName: string;
  role: string;
  roleName: string;
  roleSet: Set<string>;
  assigned: Set<string>;
};

const EMPTY: V4Identity = { ready: false, userId: "", email: "", name: "", firstName: "", role: "staff", roleName: "Staff", roleSet: new Set(), assigned: new Set() };

/** Who is signed in and which position they are acting in (refreshes on change). */
export function useIdentity(): V4Identity {
  const [me, setMe] = useState<V4Identity>(EMPTY);

  const load = useCallback(async () => {
    const [context, auth] = await Promise.all([getCurrentAuthContext(), supabase.auth.getUser()]);
    const user = auth.data.user;
    if (!user) { setMe({ ...EMPTY, ready: true }); return; }
    const profile = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const name = String((profile.data as { full_name?: string | null } | null)?.full_name || user.user_metadata?.full_name || user.email || "").trim();
    const role = context?.activeRoleKey || "staff";
    setMe({
      ready: true,
      userId: user.id,
      email: user.email || "",
      name,
      firstName: name.split(/\s+/)[0] || "",
      role,
      roleName: roleDisplayName(role),
      roleSet: new Set(context?.activeRoleKey ? [context.activeRoleKey] : ["staff"]),
      assigned: context?.assignedRoleSet || new Set(["staff"]),
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
    const on = () => void load();
    window.addEventListener("reqgen-active-role-changed", on);
    window.addEventListener("reqgen-profile-updated", on);
    return () => {
      window.removeEventListener("reqgen-active-role-changed", on);
      window.removeEventListener("reqgen-profile-updated", on);
    };
  }, [load]);

  return me;
}
