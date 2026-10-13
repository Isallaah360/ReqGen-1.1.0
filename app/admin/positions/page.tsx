"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { POSITIONS, type AdminPerson, type PositionGroup } from "@/lib/v4/admin";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Row = { position_key: string; position_name: string; holders: number; holder_names: string[] };
const GROUPS: PositionGroup[] = ["Base level", "Leadership", "Departments", "Offices", "System"];

/** Administration › Positions (mock-up 83): every position and who holds it. */
export default function PositionsPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [system, setSystem] = useState<AdminPerson[]>([]);
  const [staff, setStaff] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    void Promise.all([supabase.rpc("reqgen_admin_positions"), supabase.rpc("reqgen_admin_people")]).then(([p, people]) => {
      if (!alive) return;
      setError(p.error?.message || people.error?.message || null);
      setRows((p.data || []) as Row[]);
      const list = (people.data || []) as AdminPerson[];
      setSystem(list.filter((x) => x.system_account));
      setStaff(list.filter((x) => !x.system_account && x.is_active).length);
    });
    return () => { alive = false; };
  }, [me.ready]);

  const holdersOf = (keys: string[]) => {
    const names = new Set<string>();
    (rows || []).filter((r) => keys.includes(r.position_key)).forEach((r) => r.holder_names.forEach((n) => names.add(n)));
    return [...names].sort();
  };
  const whoText = (code: string, keys: string[]) => {
    if (code === "STAFF") return `${staff} people`;
    if (code === "SA" || code === "DEV") return system.find((s) => s.system_account === (code === "SA" ? "superadmin" : "developer"))?.full_name || "Not set up";
    const names = holdersOf(keys);
    if (!names.length) return "Nobody yet";
    return names.length <= 3 ? names.join(" · ") : `${names.length} holders`;
  };

  return (
    <V4Page>
      <PageHead title="Positions" sub="Everyone is Staff. These are the positions people hold on top of Staff. Each one decides what a person can see and do."
        actions={[{ label: "Export Excel", icon: "download", kind: "secondary", disabled: !rows, onClick: () => downloadXlsx("Positions", [{ name: "Positions", title: "ReqGen — Positions and holders", rows: POSITIONS.map((p) => ({ Code: p.code, Position: p.name, Group: p.group, "One holder": p.one ? "Yes" : "", Holders: whoText(p.code, p.keys), About: p.about })) }]) }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {rows === null ? <Skeleton lines={10} /> : GROUPS.map((g) => (
        <div key={g} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="v4-section-title v4-h2" style={{ margin: 0 }}>{g}</h2>
          <section className="v4-poscat">
            {POSITIONS.filter((p) => p.group === g).map((p) => (
              <article key={p.code} className={`v4-poscard${p.renamed ? " v4-renamed" : ""}`}>
                <div className="v4-top"><span><span className="v4-code">{p.code}</span><strong>{p.name}</strong></span>{p.renamed ? <span className="v4-chip v4-chip-amber">{p.renamed}</span> : p.one ? <span className="v4-chip v4-chip-brand">One holder</span> : null}</div>
                <p>{p.about}</p>
                <span className="v4-who">{whoText(p.code, p.keys)}</span>
              </article>
            ))}
          </section>
        </div>
      ))}
      <Notice tone="blue">To give or remove a position, open the person in <b>Staff &amp; Positions</b>. Positions with one holder (DG, General Secretary, Registrar, HR Coordinator, Auditor) are filled automatically on every route.</Notice>
    </V4Page>
  );
}
