"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { promptDialog } from "@/lib/dialog";
import { loadCorrespondence, type Corr } from "@/lib/v4/registry";
import { monthName } from "@/lib/v4/reports";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "./useIdentity";
import Icon from "./Icon";
import Modal from "./Modal";
import PrivacyBar from "./PrivacyBar";
import { Select } from "./Select";
import { Card, Chip, Notice, PageHead, Pager, Skeleton, Tabs, V4Page, type ChipTone } from "./ui";

type Dept = { id: string; name: string };
type Dir = "incoming" | "outgoing";
const PAGE = 20;
const TABS: Record<Dir, Array<{ key: string; label: string }>> = {
  incoming: [{ key: "all", label: "All" }, { key: "New", label: "New" }, { key: "Acknowledged", label: "Acknowledged" }, { key: "Forwarded", label: "Forwarded" }],
  outgoing: [{ key: "all", label: "All" }, { key: "Ready to dispatch", label: "Ready to dispatch" }, { key: "In transit", label: "In transit" }, { key: "Delivered", label: "Delivered" }],
};
const TONE: Record<string, ChipTone> = { New: "amber", Acknowledged: "blue", Forwarded: "green", "Ready to dispatch": "amber", "In transit": "blue", Delivered: "green" };
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/** Registry › Incoming (mock-up 70) and Outgoing (mock-up 71). */
export default function Correspondence({ direction }: { direction: Dir }) {
  const me = useIdentity();
  const router = useRouter();
  const incoming = direction === "incoming";
  const [rows, setRows] = useState<Corr[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [prio, setPrio] = useState("all");
  const [month, setMonth] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ subject: string; party: string; dept: string; priority: string; received: string; items: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [c, d] = await Promise.all([loadCorrespondence(direction), supabase.from("departments").select("id,name").order("name")]);
    setError(c.error); setRows(c.rows); setDepts((d.data || []) as Dept[]);
  }, [direction]);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);
  const dated = (r: Corr) => r.received_at || r.created_at || "";
  const months = useMemo(() => [...new Set((rows || []).map((r) => dated(r).slice(0, 7)).filter(Boolean))].sort().reverse(), [rows]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((r) => (dept === "all" || r.department_id === dept) && (prio === "all" || (r.priority || "Normal") === prio) && (month === "all" || dated(r).startsWith(month))
      && (!t || `${r.reference_no} ${r.subject} ${r.from_to}`.toLowerCase().includes(t)));
  }, [rows, q, dept, prio, month]);
  const status = (r: Corr) => r.status || (incoming ? "New" : "Ready to dispatch");
  const shown = filtered.filter((r) => tab === "all" || status(r) === tab);

  async function save() {
    if (!form) return;
    setBusy(true);
    const { data, error: e } = await supabase.rpc("reqgen_registry_save", {
      p_direction: direction, p_subject: form.subject, p_party: form.party, p_department_id: form.dept || null, p_priority: form.priority,
      p_received_at: incoming && form.received ? new Date(form.received).toISOString() : null, p_note: form.note || null, p_items: Number(form.items || 1),
    });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    const res = (typeof data === "string" ? JSON.parse(data) : data) as { reference_no?: string };
    setMsg({ tone: "green", text: `${res?.reference_no || "Item"} recorded.${incoming ? " Acknowledge it, then forward it to the office." : " It is ready for Dispatch."}` });
    setForm(null);
    await load();
  }

  async function act(r: Corr, action: "acknowledge" | "forward" | "delivered") {
    let receiver: string | null = null;
    if (action === "delivered") {
      receiver = await promptDialog({ title: `${r.reference_no} delivered?`, message: "Write the name of the person who received it.", label: "Received by", defaultValue: r.receiver_name || "", confirmLabel: "Mark delivered" });
      if (!receiver) return;
    }
    setBusy(true);
    const { error: e } = await supabase.rpc("reqgen_registry_act", { p_id: r.id, p_action: action, p_department_id: r.department_id, p_receiver: receiver });
    setBusy(false);
    setMsg(e ? { tone: "red", text: e.message } : { tone: "green", text: `${r.reference_no} ${action === "acknowledge" ? "acknowledged" : action === "forward" ? `forwarded to ${deptName.get(r.department_id || "") || "the office"}` : "marked delivered"}.` });
    if (!e) await load();
  }

  const title = incoming ? "Incoming" : "Outgoing";
  return (
    <V4Page>
      <PageHead title={title} sub={incoming ? "Letters, files and parcels received by the Trust. Acknowledge, then forward to the office." : "Letters and files leaving the Trust. Ready items go to Dispatch."}
        actions={[
          { label: "Export Excel", icon: "download", kind: "secondary", disabled: !shown.length, onClick: () => downloadXlsx(`Registry_${title}`, [{ name: title, title: `ReqGen Registry — ${title}`, rows: shown.map((r) => ({ Reference: r.reference_no || "", Date: dated(r).slice(0, 10), Subject: r.subject || "", [incoming ? "From" : "To"]: r.from_to || "", Office: deptName.get(r.department_id || "") || "", Priority: r.priority || "Normal", Status: status(r) })) }]) },
          { label: `Record ${direction}`, icon: "plus", kind: "primary", onClick: () => setForm({ subject: "", party: "", dept: "", priority: "Normal", received: "", items: "1", note: "" }) },
        ]} />
      <PrivacyBar />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}><Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} label="Show" items={TABS[direction].map((t) => ({ ...t, count: t.key === "all" ? filtered.length : filtered.filter((r) => status(r) === t.key).length }))} /></div>
        <div className="v4-toolbar">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Reference, subject or sender" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Department</span><Select size="compact" ariaLabel="Department" value={dept} onChange={(v) => { setDept(v); setPage(1); }} options={[{ value: "all", label: "All departments" }, ...depts.map((d) => ({ value: d.id, label: d.name }))]} /></div>
          <div className="v4-field"><span className="v4-flabel">Priority</span><Select size="compact" ariaLabel="Priority" value={prio} onChange={(v) => { setPrio(v); setPage(1); }} options={[{ value: "all", label: "Any priority" }, { value: "Urgent", label: "Urgent" }, { value: "Confidential", label: "Confidential" }, { value: "Normal", label: "Normal" }]} /></div>
          <div className="v4-field v4-f-extra"><span className="v4-flabel">Month</span><Select size="compact" ariaLabel="Month" value={month} onChange={(v) => { setMonth(v); setPage(1); }} options={[{ value: "all", label: "Any month" }, ...months.map((m) => ({ value: m, label: monthName(m) }))]} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setDept("all"); setPrio("all"); setMonth("all"); setTab("all"); setPage(1); }}><Icon name="returned" />Reset</button>
        </div>
        {rows === null ? <Skeleton lines={6} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Reference</th><th>Subject</th><th className="v4-hide-sm">{incoming ? "To" : "From"}</th><th className="v4-hide-sm">Priority</th><th>Status</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {shown.slice((page - 1) * PAGE, page * PAGE).map((r) => {
                  const s = status(r);
                  return (
                    <tr key={r.id}>
                      <td><span className="v4-strong">{r.reference_no || "—"}</span><span className="v4-sub">{when(dated(r))}</span></td>
                      <td><span className="v4-strong">{r.subject}</span><span className="v4-sub">{incoming ? "From" : "To"} {r.from_to || "—"}{Number(r.items_count || 1) > 1 ? ` · ${r.items_count} items` : ""}</span></td>
                      <td className="v4-hide-sm">{deptName.get(r.department_id || "") || "—"}</td>
                      <td className="v4-hide-sm"><Chip tone={r.priority === "Urgent" ? "red" : r.priority === "Confidential" ? "brand" : "grey"}>{r.priority || "Normal"}</Chip></td>
                      <td data-label="Status"><Chip tone={TONE[s] || "grey"}>{s}</Chip>{s === "In transit" && r.dispatch_method ? <span className="v4-sub">{r.dispatch_method}</span> : null}{s === "Delivered" && r.receiver_name ? <span className="v4-sub">To {r.receiver_name}</span> : null}</td>
                      <td className="v4-r">
                        {incoming && s === "New" ? <button className="v4-btn v4-btn-primary" type="button" style={{ minHeight: 38, padding: "0 12px" }} disabled={busy} onClick={() => void act(r, "acknowledge")}>Acknowledge</button> : null}
                        {incoming && s === "Acknowledged" ? <button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38, padding: "0 12px" }} disabled={busy} onClick={() => void act(r, "forward")}>Forward</button> : null}
                        {!incoming && s === "Ready to dispatch" ? <button className="v4-btn v4-btn-primary" type="button" style={{ minHeight: 38, padding: "0 12px" }} onClick={() => router.push(`/registry/dispatch?pick=${r.id}`)}>Dispatch</button> : null}
                        {!incoming && s === "In transit" ? <button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38, padding: "0 12px" }} disabled={busy} onClick={() => void act(r, "delivered")}>Mark delivered</button> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Nothing here yet.</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="items" />
      </Card>
      <Modal open={!!form} title={`Record ${direction}`} sub={incoming ? "It is numbered IN/year/number when you save." : "It is numbered OUT/year/number and goes to Dispatch."} onClose={() => setForm(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void save()} disabled={busy}><Icon name="check" />{busy ? "Saving…" : "Save"}</button></>}>
        {form ? (
          <div className="v4-form-grid">
            <label className="v4-field v4-span-2"><span className="v4-flabel">What is it? <span className="v4-req">*</span></span><input className="v4-input" value={form.subject} placeholder={incoming ? "Letter — Niger State Ministry of Education" : "Reply — Ministry of Education"} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
            <label className="v4-field"><span className="v4-flabel">{incoming ? "From" : "To"} <span className="v4-req">*</span></span><input className="v4-input" value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} /></label>
            <div className="v4-field"><span className="v4-flabel">{incoming ? "For office" : "From office"}</span><Select ariaLabel={incoming ? "For office" : "From office"} value={form.dept} onChange={(v) => setForm({ ...form, dept: v })} placeholder="Choose the office" options={depts.map((d) => ({ value: d.id, label: d.name }))} /></div>
            <div className="v4-field"><span className="v4-flabel">Priority</span><Select ariaLabel="Priority" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={["Normal", "Urgent", "Confidential"].map((p) => ({ value: p, label: p }))} /></div>
            {incoming ? <label className="v4-field"><span className="v4-flabel">Received</span><input className="v4-input" type="datetime-local" value={form.received} onChange={(e) => setForm({ ...form, received: e.target.value })} /><span className="v4-help">Leave empty for now.</span></label> : <label className="v4-field"><span className="v4-flabel">Items</span><input className="v4-input" inputMode="numeric" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>}
            <label className="v4-field v4-span-2"><span className="v4-flabel">Note (optional)</span><input className="v4-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          </div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
