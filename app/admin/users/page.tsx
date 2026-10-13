"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { ASSIGNABLE, POSITIONS, adminApi, initials, positionsOf, type AdminPerson } from "@/lib/v4/admin";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Select } from "@/app/components/v4/Select";
import { Card, Notice, PageHead, Pager, Skeleton, Tabs, V4Page } from "@/app/components/v4/ui";

type Tab = "all" | "positions" | "staff" | "off";
type Dept = { id: string; name: string };
const PAGE = 13;

function tempPassword() {
  const words = "Amber Cedar Delta Falcon Garnet Harbour Indigo Jasper Kestrel Lantern Meadow Nectar Orchard Pebble Quartz Raven Saffron Timber".split(" ");
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
  return `${pick()}-${pick()}-${1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000)}`;
}

/** Administration › Staff & Positions (mock-up 81). */
export default function StaffPage() {
  const me = useIdentity();
  const router = useRouter();
  const [rows, setRows] = useState<AdminPerson[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [pos, setPos] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ fullName: string; email: string; deptId: string; roleKey: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [p, d] = await Promise.all([
      supabase.rpc("reqgen_admin_people"),
      supabase.from("departments").select("id,name").order("name"),
    ]);
    setError(p.error?.message || null);
    setRows(((p.data || []) as AdminPerson[]).filter((x) => !x.system_account).sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setDepts((d.data || []) as Dept[]);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const base = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((r) => {
      const held = positionsOf(r);
      if (dept !== "all" && r.dept_id !== dept) return false;
      if (pos !== "all" && !held.some((h) => h.def.code === pos)) return false;
      return !t || `${r.full_name} ${r.email} ${held.map((h) => h.def.name).join(" ")}`.toLowerCase().includes(t);
    });
  }, [rows, q, dept, pos]);
  const inTab = (t: Tab) => base.filter((r) => t === "off" ? !r.is_active : r.is_active && (t === "all" || (t === "positions" ? positionsOf(r).length > 0 : positionsOf(r).length === 0)));
  const shown = inTab(tab);

  async function create() {
    if (!form) return;
    setBusy(true); setMsg(null);
    const res = await adminApi("/api/admin/users", "POST", { fullName: form.fullName, email: form.email, password: form.password, roleKey: form.roleKey, departmentId: form.deptId || null });
    setBusy(false);
    if (!res.ok) { setMsg({ tone: "red", text: res.error || "The staff member could not be added." }); return; }
    const created = res as { ok: boolean; userId?: string; user?: { id?: string } };
    setMsg({ tone: "green", text: `${form.fullName.trim()} was added. Give them the temporary password ${form.password} in person — ReqGen asks them to change it at first sign-in.` });
    setForm(null);
    await load();
    const id = created.userId || created.user?.id;
    if (id) router.push(`/admin/users/${id}`);
  }

  const exportRows = () => downloadXlsx("Staff_and_Positions", [{ name: "Staff", title: "ReqGen — Staff and positions", rows: shown.map((r) => ({
    Name: r.full_name, Email: r.email, Department: r.dept_name || "", Positions: ["Staff", ...positionsOf(r).map((p) => p.def.name)].join(", "),
    Status: r.is_active ? "Active" : "Deactivated", "2FA": r.has_2fa ? "On" : "Off", Signature: r.has_signature ? "Yes" : "No",
  })) }]);

  return (
    <V4Page>
      <PageHead title="Staff & Positions" sub="Everyone in IET is Staff. On top of that, a person can hold one or more positions — and ReqGen shows the position they act in on every action."
        actions={[
          { label: "Export Excel", icon: "download", kind: "secondary", disabled: !shown.length, onClick: exportRows },
          { label: "Add staff", icon: "plus", kind: "primary", onClick: () => { setMsg(null); setForm({ fullName: "", email: "", deptId: "", roleKey: "staff", password: tempPassword() }); } },
        ]} />
      <Notice tone="blue">Positions marked <b>ONE</b> have a single holder (Director General, General Secretary, Registrar, HR Coordinator, Auditor). ReqGen fills them in automatically — nobody has to pick from a list.</Notice>
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} label="Show" items={[
            { key: "all", label: "All staff", count: inTab("all").length }, { key: "positions", label: "With a position", count: inTab("positions").length },
            { key: "staff", label: "Staff only", count: inTab("staff").length }, { key: "off", label: "Deactivated", count: inTab("off").length },
          ]} />
        </div>
        <div className="v4-toolbar">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Name, email or position" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Department</span><Select size="compact" searchable ariaLabel="Department" value={dept} onChange={(v) => { setDept(v); setPage(1); }} options={[{ value: "all", label: "All departments" }, ...depts.map((d) => ({ value: d.id, label: d.name }))]} /></div>
          <div className="v4-field"><span className="v4-flabel">Position</span><Select size="compact" ariaLabel="Position" value={pos} onChange={(v) => { setPos(v); setPage(1); }} options={[{ value: "all", label: "Any position" }, ...POSITIONS.filter((p) => p.group !== "System" && p.code !== "STAFF").map((p) => ({ value: p.code, label: p.code === "PD" ? "PD · Program Director" : p.name }))]} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setDept("all"); setPos("all"); setTab("all"); setPage(1); }}><Icon name="returned" />Reset</button>
        </div>
        {rows === null ? <Skeleton lines={8} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Name</th><th>Staff level and positions</th><th className="v4-hide-sm">Status</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {shown.slice((page - 1) * PAGE, page * PAGE).map((r) => (
                  <tr key={r.id}>
                    <td><span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="v4-avatar" style={{ width: 36, height: 36, fontSize: 12, cursor: "default" }}>{initials(r.full_name)}</span><span><span className="v4-strong">{r.full_name || r.email}</span><span className="v4-sub">{r.dept_name || "No department"}</span></span></span></td>
                    <td data-label="Positions"><span className="v4-pos"><span className="v4-pchip v4-staff">Staff</span>{positionsOf(r).map((p) => <span key={p.def.code} className={`v4-pchip v4-${p.def.chip}`}>{p.def.name}{p.def.one ? <span className="v4-one">ONE</span> : null}</span>)}</span></td>
                    <td className="v4-hide-sm">{r.is_active ? <span className="v4-chip v4-chip-green">Active</span> : <span className="v4-chip v4-chip-grey">Deactivated</span>}</td>
                    <td className="v4-r"><Link className="v4-btn v4-btn-secondary" href={`/admin/users/${r.id}`} style={{ minHeight: 38, padding: "0 14px" }}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Nobody matches.</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="staff" />
      </Card>

      <Modal open={!!form} title="Add staff" sub="Everyone starts as Staff. Give positions on their record after saving." onClose={() => setForm(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void create()} disabled={busy}><Icon name="check" />{busy ? "Adding…" : "Add staff"}</button></>}>
        {form ? (
          <div className="v4-form-grid">
            <label className="v4-field v4-span-2"><span className="v4-flabel">Full name <span className="v4-req">*</span></span><input className="v4-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <label className="v4-field v4-span-2"><span className="v4-flabel">Email <span className="v4-req">*</span></span><input className="v4-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <div className="v4-field"><span className="v4-flabel">Department</span><Select ariaLabel="Department" searchable value={form.deptId} placeholder="Choose the department" onChange={(v) => setForm({ ...form, deptId: v })} options={depts.map((d) => ({ value: d.id, label: d.name }))} /></div>
            <div className="v4-field"><span className="v4-flabel">First position</span><Select ariaLabel="First position" value={form.roleKey} onChange={(v) => setForm({ ...form, roleKey: v })} options={[{ value: "staff", label: "Staff only" }, ...ASSIGNABLE.map((a) => ({ value: a.key, label: a.label }))]} /></div>
            <label className="v4-field v4-span-2"><span className="v4-flabel">Temporary password</span><span className="v4-control"><Icon name="key" /><input className="v4-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></span><span className="v4-help">Give it to them in person. ReqGen asks them to change it, set up 2FA and add their signature at first sign-in.</span></label>
          </div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
