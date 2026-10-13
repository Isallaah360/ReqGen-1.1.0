"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { promptDialog } from "@/lib/dialog";
import { ageText, loadCorrespondence, type Corr } from "@/lib/v4/registry";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import PrivacyBar from "@/app/components/v4/PrivacyBar";
import { Select } from "@/app/components/v4/Select";
import { Card, Notice, PageHead, Skeleton, Tabs, V4Page } from "@/app/components/v4/ui";

type Tab = "ready" | "transit" | "delivered";
type Dept = { id: string; name: string };
const METHODS = ["Hand delivery", "Courier", "Email", "Post"];

export default function DispatchPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={6} /></V4Page>}><Dispatch /></Suspense>;
}

/** Registry › Dispatch (mock-up 72): hand items over and record who received them. */
function Dispatch() {
  const me = useIdentity();
  const params = useSearchParams();
  const [now] = useState(() => Date.now());
  const [rows, setRows] = useState<Corr[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("ready");
  const [picked, setPicked] = useState<string[]>(() => (params.get("pick") ? [String(params.get("pick"))] : []));
  const [form, setForm] = useState<{ method: string; receiver: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [c, d] = await Promise.all([loadCorrespondence("outgoing"), supabase.from("departments").select("id,name")]);
    setError(c.error); setRows(c.rows); setDepts((d.data || []) as Dept[]);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);
  const of = (t: Tab) => (rows || []).filter((r) => (t === "ready" ? ["Ready to dispatch", "New", ""].includes(r.status || "") : t === "transit" ? r.status === "In transit" : r.status === "Delivered"));
  const shown = of(tab);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const ready = new Set(of("ready").map((r) => r.id));
  const chosen = picked.filter((id) => ready.has(id));

  async function dispatch() {
    if (!form) return;
    setBusy(true);
    const { data, error: e } = await supabase.rpc("reqgen_registry_dispatch", { p_ids: chosen, p_method: form.method, p_receiver: form.receiver, p_note: form.note || null });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    const n = (typeof data === "string" ? JSON.parse(data) : data) as { dispatched?: number };
    setMsg({ tone: "green", text: `${n?.dispatched || chosen.length} item${(n?.dispatched || chosen.length) === 1 ? "" : "s"} ${["Hand delivery", "Email"].includes(form.method) ? "delivered" : "sent"} by ${form.method.toLowerCase()}.` });
    setForm(null); setPicked([]);
    await load();
  }

  async function delivered(r: Corr) {
    const who = await promptDialog({ title: `${r.reference_no} delivered?`, message: "Write the name of the person who received it.", label: "Received by", confirmLabel: "Mark delivered" });
    if (!who) return;
    const { error: e } = await supabase.rpc("reqgen_registry_act", { p_id: r.id, p_action: "delivered", p_department_id: null, p_receiver: who });
    setMsg(e ? { tone: "red", text: e.message } : { tone: "green", text: `${r.reference_no} delivered to ${who}.` });
    if (!e) await load();
  }

  return (
    <V4Page>
      <PageHead title="Dispatch" sub="Hand items over and record who received them. Tick items going the same way and dispatch together."
        actions={[{ label: `Dispatch selected${chosen.length ? ` (${chosen.length})` : ""}`, icon: "send", kind: "primary", disabled: !chosen.length, onClick: () => setForm({ method: "Hand delivery", receiver: "", note: "" }) }]} />
      <PrivacyBar />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}><Tabs value={tab} onChange={setTab} label="Show" items={[{ key: "ready", label: "To dispatch", count: of("ready").length }, { key: "transit", label: "In transit", count: of("transit").length }, { key: "delivered", label: "Delivered", count: of("delivered").length }]} /></div>
        {rows === null ? <Skeleton lines={5} /> : shown.length ? (
          <div className="v4-dcards">
            {shown.map((r) => (
              <article className="v4-dcard" key={r.id}>
                {tab === "ready" ? <input className="v4-pick" type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.reference_no}`} /> : null}
                <strong>{r.reference_no}</strong>
                <span className="v4-help" style={{ margin: 0 }}>{r.subject}{r.priority && r.priority !== "Normal" ? ` · ${r.priority}` : ""}</span>
                <dl className="v4-kv" style={{ marginTop: 6 }}>
                  <dt>To</dt><dd>{r.from_to || "—"}</dd>
                  <dt>From</dt><dd>{deptName.get(r.department_id || "") || "—"}</dd>
                  {tab === "ready" ? <><dt>Waiting</dt><dd>{ageText(r.created_at, now)}</dd></> : <><dt>{tab === "transit" ? "Sent" : "Delivered"}</dt><dd>{r.dispatch_method || "—"} · {new Date((tab === "transit" ? r.dispatched_at : r.delivered_at) || r.created_at || now).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</dd>{r.receiver_name ? <><dt>Received by</dt><dd>{r.receiver_name}</dd></> : null}</>}
                </dl>
                {tab === "transit" ? <button type="button" className="v4-btn v4-btn-secondary" style={{ minHeight: 38, marginTop: 8 }} onClick={() => void delivered(r)}><Icon name="check" />Mark delivered</button> : null}
              </article>
            ))}
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>{tab === "ready" ? "Nothing is waiting to be dispatched." : "Nothing here."}</p>}
      </Card>
      <Modal open={!!form} title={`Dispatch ${chosen.length} item${chosen.length === 1 ? "" : "s"}`} sub="Hand delivery and email are delivered at once; courier and post stay in transit until delivered." onClose={() => setForm(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void dispatch()} disabled={busy}><Icon name="send" />{busy ? "Saving…" : "Dispatch"}</button></>}>
        {form ? (
          <div className="v4-form-grid">
            <div className="v4-field"><span className="v4-flabel">How</span><Select ariaLabel="How" value={form.method} onChange={(v) => setForm({ ...form, method: v })} options={METHODS.map((m) => ({ value: m, label: m }))} /></div>
            <label className="v4-field"><span className="v4-flabel">{["Hand delivery", "Email"].includes(form.method) ? "Received by" : "Courier or tracking no."}{["Hand delivery", "Email"].includes(form.method) ? <span className="v4-req"> *</span> : null}</span><input className="v4-input" value={form.receiver} onChange={(e) => setForm({ ...form, receiver: e.target.value })} /></label>
            <label className="v4-field v4-span-2"><span className="v4-flabel">Note (optional)</span><input className="v4-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          </div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
