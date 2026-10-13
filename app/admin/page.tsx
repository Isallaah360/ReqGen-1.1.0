"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MotherPage from "@/app/components/v4/MotherPage";
import { useIdentity } from "@/app/components/v4/useIdentity";

/** Administration — mother page (mock-up 79): live numbers and one tile per page. */
export default function AdminHome() {
  const me = useIdentity();
  const [system, setSystem] = useState<string | null>(null);
  useEffect(() => {
    if (!me.ready || !me.userId) return;
    let alive = true;
    void supabase.from("profiles").select("system_account").eq("id", me.userId).maybeSingle().then(({ data }) => { if (alive) setSystem((data as { system_account?: string | null } | null)?.system_account || ""); });
    return () => { alive = false; };
  }, [me.ready, me.userId]);
  const sub = system === "developer"
    ? "Signed in as the Developer. Every action here is logged and the Super Admin is told. Each tile opens one page."
    : system === "superadmin"
      ? "Signed in as the ReqGen Super Admin — the Trust’s own account, not a person’s. Each tile opens one page."
      : "Staff, positions, departments, routing and security. Each tile opens one page.";
  return <MotherPage moduleKey="admin" sub={system === null ? undefined : sub} />;
}
