"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAvailableRoles } from "@/lib/activeRole";
import { normalizeRole } from "@/lib/roles";
import { useSetupSteps } from "@/lib/profileSetup";
import { ACCOUNT_MODULE } from "@/lib/v4/modules";
import { positionName } from "@/app/components/v4/RoleSelect";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Chip, Tiles, V4Page, type TileItem } from "@/app/components/v4/ui";

type Profile = { full_name: string | null; email: string | null; phone: string | null; dept_id: string | null; avatar_url?: string | null; signature_url?: string | null };

/** My Account — mother page (v4.0.0). */
export default function MyAccountHome() {
  const me = useIdentity();
  const { steps } = useSetupSteps();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dept, setDept] = useState<string>("");
  const [positions, setPositions] = useState<string[]>([]);
  const [systemAccount, setSystemAccount] = useState<string | null>(null);
  const [devices, setDevices] = useState<number | null>(null);

  useEffect(() => {
    if (!me.ready || !me.userId) return;
    let alive = true;
    (async () => {
      const [p, extra, sys, roles, keys] = await Promise.all([
        supabase.from("profiles").select("full_name,email,phone,dept_id").eq("id", me.userId).maybeSingle(),
        supabase.from("profiles").select("avatar_url,signature_url").eq("id", me.userId).maybeSingle(),
        supabase.from("profiles").select("system_account").eq("id", me.userId).maybeSingle(),
        getAvailableRoles(me.userId),
        supabase.from("reqgen_webauthn_credentials").select("id", { count: "exact", head: true }).eq("user_id", me.userId),
      ]);
      if (!alive) return;
      const row = { ...(p.data || {}), ...(extra.error ? {} : extra.data || {}) } as Profile;
      setProfile(row);
      const sa = sys.error ? null : ((sys.data as { system_account?: string | null } | null)?.system_account || null);
      setSystemAccount(sa);
      const seen = new Set<string>();
      setPositions(roles.map((r) => positionName(r.key, r.name, sa)).filter((n) => { const k = normalizeRole(n); if (seen.has(k)) return false; seen.add(k); return true; }));
      setDevices(keys.error ? null : keys.count ?? 0);
      if (row.dept_id) {
        const d = await supabase.from("departments").select("name").eq("id", row.dept_id).maybeSingle();
        if (alive) setDept(String((d.data as { name?: string } | null)?.name || ""));
      }
    })();
    return () => { alive = false; };
  }, [me.ready, me.userId]);

  const done = steps ? steps.filter((s) => s.done).length : 0;
  const total = steps?.length || 0;
  const signatureMissing = !!profile && !profile.signature_url;
  const name = profile?.full_name || me.name;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "RG";

  const tiles: TileItem[] = useMemo(() => ACCOUNT_MODULE.tiles.map((t) => {
    const meta: Record<string, string | undefined> = {
      "/profile/details": profile?.phone ? "Contact details saved" : "Add your phone number",
      "/profile/details#signature": signatureMissing ? "Signature missing" : "Signature saved",
      "/profile/security": devices === null ? "2FA on" : devices ? `${devices} fingerprint${devices === 1 ? "" : "s"}` : "Add your fingerprint",
      "/profile/access": `${positions.length || 1} position${positions.length === 1 ? "" : "s"}`,
      "/profile/setup": total ? `${done} of ${total} done` : undefined,
    };
    return {
      ...t,
      meta: meta[t.href],
      badge: t.href === "/profile/details#signature" && signatureMissing ? <Chip tone="red">Needed</Chip> : undefined,
    };
  }), [profile, signatureMissing, devices, positions.length, done, total]);

  return (
    <V4Page>
      <section className="v4-card v4-hero">
        <span className="v4-big-avatar" style={{ overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- photo from Supabase Storage */}
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
        </span>
        <div>
          <h2>{name || "My Account"}</h2>
          <p>{[profile?.email || me.email, systemAccount === "superadmin" ? "The Trust's own account" : systemAccount === "developer" ? "Barderian Enterprises" : dept].filter(Boolean).join(" · ")}</p>
          <div className="v4-chips">
            {positions.map((p, i) => <Chip key={p} tone={i === 0 ? "brand" : p === "Staff" ? "grey" : "blue"}>{p}</Chip>)}
          </div>
        </div>
        {total ? (
          <div className="v4-done">
            <Link className={`v4-chip ${done === total ? "v4-chip-green" : "v4-chip-amber"}`} href="/profile/setup" style={{ height: 30, fontSize: 13 }}>
              {done === total ? "Account ready" : `${done} of ${total} setup steps done`}
            </Link>
          </div>
        ) : null}
      </section>
      <Tiles items={tiles} label="My Account pages" />
    </V4Page>
  );
}
