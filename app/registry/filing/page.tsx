"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { RETENTION } from "@/lib/v4/registry";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import PrivacyBar from "@/app/components/v4/PrivacyBar";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Item = { kind: "request" | "voucher"; record_id: string; record_no: string; office: string; paid_at: string | null };
const addYears = (y: number) => { const d = new Date(); d.setFullYear(d.getFullYear() + y); return d.toISOString().slice(0, 10); };

/** Registry › Registry Filing (mock-up 68 tile): paid requests and vouchers to file — numbers only. */
export default function FilingPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [form, setForm] = useState<{ category: string; keep: string; location: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red" | "amber"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("reqgen_registry_filing_queue");
    setError(e ? e.message : null);
    setRows((data || []) as Item[]);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const key = (i: Item) => `${i.kind}:${i.record_id}`;
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  async function file() {
    if (!form) return;
    setBusy(true);
    const failed: string[] = [];
    for (const it of (rows || []).filter((i) => picked.includes(key(i)))) {
      const { error: e } = await supabase.rpc("reqgen_registry_archive_add", { p_kind: it.kind, p_record_id: it.record_id, p_record_no: it.record_no, p_description: null, p_category: form.category, p_keep_until: form.keep, p_permanent: false, p_location: form.location });
      if (e) failed.push(`${it.record_no}: ${e.message}`);
    }
    setBusy(false);
    setMsg(failed.length ? { tone: "amber", text: `Some were not filed — ${failed.join("; ")}` } : { tone: "green", text: `${picked.length} record${picked.length === 1 ? "" : "s"} filed at ${form.location}.` });
    setForm(null); setPicked([]);
    await load();
  }

  return (
    <V4Page>
      <PageHead title="Registry Filing" sub="Paid requests and their vouchers waiting to be filed. Numbers and offices only."
        actions={[{ label: `File selected${picked.length ? ` (${picked.length})` : ""}`, icon: "archive", kind: "primary", disabled: !picked.length, onClick: () => setForm({ category: RETENTION[0].value, keep: addYears(6), location: "" }) }]} />
      <PrivacyBar />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Card>
        {rows === null ? <Skeleton lines={6} /> : rows.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th style={{ width: 44 }}><input className="v4-pick" type="checkbox" aria-label="Select all" checked={picked.length === rows.length} onChange={(e) => setPicked(e.target.checked ? rows.map(key) : [])} /></th><th>Record</th><th>Office</th><th>Paid</th></tr></thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={key(i)}>
                    <td><input className="v4-pick" type="checkbox" checked={picked.includes(key(i))} onChange={() => toggle(key(i))} aria-label={`Select ${i.record_no}`} /></td>
                    <td><span className="v4-strong">{i.record_no}</span><span className="v4-sub">{i.kind === "request" ? "Request file" : "Payment voucher + receipts"}</span></td>
                    <td data-label="Office">{i.office || "—"}</td>
                    <td data-label="Paid">{i.paid_at ? new Date(i.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"} <Chip tone="green">Paid</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Everything paid has been filed.</p>}
      </Card>
      <Modal open={!!form} title={`File ${picked.length} record${picked.length === 1 ? "" : "s"}`} sub="Financial records are kept 6 years." onClose={() => setForm(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void file()} disabled={busy}><Icon name="archive" />{busy ? "Filing…" : "File"}</button></>}>
        {form ? (
          <div className="v4-form-grid">
            <div className="v4-field v4-span-2"><span className="v4-flabel">How long it is kept</span><Select ariaLabel="How long it is kept" value={form.category} onChange={(v) => { const r = RETENTION.find((x) => x.value === v); setForm({ ...form, category: v, keep: r && r.years ? addYears(r.years) : form.keep }); }} options={RETENTION.filter((r) => r.years > 0).map((r) => ({ value: r.value, label: r.value }))} /></div>
            <label className="v4-field"><span className="v4-flabel">Keep until</span><input className="v4-input" type="date" value={form.keep} onChange={(e) => setForm({ ...form, keep: e.target.value })} /></label>
            <label className="v4-field"><span className="v4-flabel">Shelf location <span className="v4-req">*</span></span><input className="v4-input" value={form.location} placeholder="Cabinet B · Shelf 2 · Box 15" onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
          </div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
