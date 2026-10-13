"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { promptDialog } from "@/lib/dialog";
import { RETENTION, loadCorrespondence, type Corr } from "@/lib/v4/registry";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import PrivacyBar from "@/app/components/v4/PrivacyBar";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Pager, Skeleton, Stats, V4Page, type StatItem } from "@/app/components/v4/ui";

type Rec = { id: string; record_kind: string; record_id: string | null; record_no: string; description: string | null; category: string; keep_until: string | null; permanent: boolean; location: string | null; archived_by_label: string | null; archived_at: string; restored_at: string | null; reviewed_at: string | null; review_note: string | null };
type Form = { kind: string; letter: string; no: string; desc: string; category: string; keep: string; permanent: boolean; location: string };
const PAGE = 20;
const addYears = (y: number) => { const d = new Date(); d.setFullYear(d.getFullYear() + y); return d.toISOString().slice(0, 10); };
const ukDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "—");

/** Registry › Archive (mock-up 73): filed records with retention and shelf location. */
export default function ArchivePage() {
  const me = useIdentity();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [letters, setLetters] = useState<Corr[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [cab, setCab] = useState("all");
  const [year, setYear] = useState("all");
  const [show, setShow] = useState<"all" | "due" | "restored" | "permanent">("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const [a, c] = await Promise.all([
      supabase.from("reqgen_registry_archive").select("*").order("archived_at", { ascending: false }).limit(20000),
      loadCorrespondence("all"),
    ]);
    setError(a.error?.message || null);
    setRows((a.data || []) as Rec[]);
    setLetters(c.rows.filter((r) => !r.archived_at));
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const cabinet = (loc: string | null) => (String(loc || "").match(/cabinet\s*[A-Za-z0-9]+/i)?.[0] || "").replace(/^cabinet/i, "Cabinet");
  const live = (rows || []).filter((r) => !r.restored_at);
  const due = live.filter((r) => !r.permanent && r.keep_until && r.keep_until < today);
  const restoredThisYear = (rows || []).filter((r) => r.restored_at && r.restored_at.slice(0, 4) === today.slice(0, 4));
  const cabinets = useMemo(() => [...new Set(live.map((r) => cabinet(r.location)).filter(Boolean))].sort(), [live]);
  const years = useMemo(() => [...new Set((rows || []).map((r) => r.archived_at.slice(0, 4)))].sort().reverse(), [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = show === "restored" ? (rows || []).filter((r) => r.restored_at) : show === "due" ? due : show === "permanent" ? live.filter((r) => r.permanent) : live;
    return base.filter((r) => (cat === "all" || r.category === cat) && (cab === "all" || cabinet(r.location) === cab) && (year === "all" || r.archived_at.startsWith(year)) && (!t || `${r.record_no} ${r.description} ${r.location}`.toLowerCase().includes(t)));
  }, [rows, live, due, show, q, cat, cab, year]);

  const stats: StatItem[] = [
    { label: "Archived", value: rows ? live.length : "…", note: "All time", icon: "archive", tone: "green", pressed: show === "all", onClick: () => setShow("all") },
    { label: "Due for review", value: rows ? due.length : "…", note: "Keep-until date passed", icon: "alert", tone: "amber", pressed: show === "due", onClick: () => setShow(show === "due" ? "all" : "due") },
    { label: "Restored", value: rows ? restoredThisYear.length : "…", note: "This year", icon: "returned", tone: "blue", pressed: show === "restored", onClick: () => setShow(show === "restored" ? "all" : "restored") },
    { label: "Kept permanently", value: rows ? live.filter((r) => r.permanent).length : "…", note: "Board minutes, deeds", icon: "lock", tone: "brand", pressed: show === "permanent", onClick: () => setShow(show === "permanent" ? "all" : "permanent") },
  ];

  function setCategory(f: Form, c: string) {
    const r = RETENTION.find((x) => x.value === c);
    return { ...f, category: c, permanent: r ? r.years === 0 : f.permanent, keep: r && r.years ? addYears(r.years) : f.keep };
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    const letter = letters.find((l) => l.id === form.letter);
    const { error: e } = await supabase.rpc("reqgen_registry_archive_add", {
      p_kind: form.kind, p_record_id: form.kind === "letter" ? letter?.id || null : null, p_record_no: form.kind === "letter" ? letter?.reference_no || "" : form.no,
      p_description: form.kind === "letter" ? `${letter?.subject || "Letter"}` : form.desc, p_category: form.category, p_keep_until: form.permanent ? null : form.keep || null,
      p_permanent: form.permanent, p_location: form.location,
    });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    setMsg({ tone: "green", text: "Record archived." }); setForm(null);
    await load();
  }

  async function restore(r: Rec) {
    const why = await promptDialog({ title: `Take ${r.record_no} out of the archive?`, message: "The reason is kept with the record.", label: "Reason", confirmLabel: "Take out" });
    if (!why) return;
    const { error: e } = await supabase.rpc("reqgen_registry_archive_restore", { p_id: r.id, p_reason: why });
    setMsg(e ? { tone: "red", text: e.message } : { tone: "green", text: `${r.record_no} taken out of the archive.` });
    if (!e) await load();
  }

  async function review(r: Rec) {
    const note = await promptDialog({ title: `Review ${r.record_no}`, message: "Its keep-until date has passed. Write the decision (keep for longer, or ready to destroy with approval).", label: "Decision", confirmLabel: "Save review" });
    if (!note) return;
    const { error: e } = await supabase.rpc("reqgen_registry_archive_review", { p_id: r.id, p_keep_until: /keep/i.test(note) ? addYears(1) : null, p_note: note });
    setMsg(e ? { tone: "red", text: e.message } : { tone: "green", text: `Review saved for ${r.record_no}.` });
    if (!e) await load();
  }

  return (
    <V4Page>
      <PageHead title="Archive" sub="Filed records with how long they must be kept and where they are on the shelf."
        actions={[
          { label: "Export Excel", icon: "download", kind: "secondary", disabled: !shown.length, onClick: () => downloadXlsx("Registry_Archive", [{ name: "Archive", title: "ReqGen Registry — Archive", rows: shown.map((r) => ({ Record: r.record_no, Description: r.description || "", Retention: r.category, "Keep until": r.permanent ? "Permanent" : ukDate(r.keep_until), Location: r.location || "", Archived: ukDate(r.archived_at), "Archived by": r.archived_by_label || "", Restored: ukDate(r.restored_at) })) }]) },
          { label: "Archive a record", icon: "plus", kind: "primary", onClick: () => setForm({ kind: "letter", letter: "", no: "", desc: "", category: RETENTION[1].value, keep: addYears(3), permanent: false, location: "" }) },
        ]} />
      <PrivacyBar />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Stats items={stats} />
      <Card>
        <div className="v4-toolbar">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Number, description or shelf" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Retention</span><Select size="compact" ariaLabel="Retention" value={cat} onChange={(v) => { setCat(v); setPage(1); }} options={[{ value: "all", label: "All categories" }, ...RETENTION.map((r) => ({ value: r.value, label: r.value }))]} /></div>
          <div className="v4-field"><span className="v4-flabel">Cabinet</span><Select size="compact" ariaLabel="Cabinet" value={cab} onChange={(v) => { setCab(v); setPage(1); }} options={[{ value: "all", label: "All cabinets" }, ...cabinets.map((c) => ({ value: c, label: c }))]} /></div>
          <div className="v4-field v4-f-extra"><span className="v4-flabel">Year archived</span><Select size="compact" ariaLabel="Year archived" value={year} onChange={(v) => { setYear(v); setPage(1); }} options={[{ value: "all", label: "All years" }, ...years.map((y) => ({ value: y, label: y }))]} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setCat("all"); setCab("all"); setYear("all"); setShow("all"); setPage(1); }}><Icon name="returned" />Reset</button>
        </div>
        {rows === null ? <Skeleton lines={6} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Record</th><th>Retention</th><th>Keep until</th><th className="v4-hide-sm">Location</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {shown.slice((page - 1) * PAGE, page * PAGE).map((r) => {
                  const isDue = !r.restored_at && !r.permanent && r.keep_until && r.keep_until < today;
                  return (
                    <tr key={r.id}>
                      <td><span className="v4-strong">{r.record_no}</span><span className="v4-sub">{r.description || r.record_kind}</span></td>
                      <td data-label="Retention">{r.category}</td>
                      <td data-label="Keep until" className="v4-num">{r.permanent ? <Chip tone="brand">Permanent</Chip> : isDue ? <Chip tone="amber">{ukDate(r.keep_until)} · review</Chip> : ukDate(r.keep_until)}</td>
                      <td className="v4-hide-sm">{r.location || "—"}</td>
                      <td className="v4-r">
                        {r.restored_at ? <Chip tone="blue">Taken out {ukDate(r.restored_at)}</Chip> : (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            {isDue ? <button type="button" className="v4-btn v4-btn-primary" style={{ minHeight: 38, padding: "0 12px" }} onClick={() => void review(r)}>Review</button> : null}
                            <button type="button" className="v4-btn v4-btn-secondary" style={{ minHeight: 38, padding: "0 12px" }} onClick={() => void restore(r)}>Take out</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No record here yet.</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="records" />
      </Card>
      <Modal open={!!form} title="Archive a record" sub="Request files and vouchers are filed from Registry Filing. Here you archive letters and other records." onClose={() => setForm(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void save()} disabled={busy}><Icon name="archive" />{busy ? "Saving…" : "Archive"}</button></>}>
        {form ? (
          <div className="v4-form-grid">
            <div className="v4-field"><span className="v4-flabel">What</span><Select ariaLabel="What" value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={[{ value: "letter", label: "A letter or file from Registry" }, { value: "other", label: "Another record" }]} /></div>
            {form.kind === "letter" ? (
              <div className="v4-field"><span className="v4-flabel">Letter or file <span className="v4-req">*</span></span><Select ariaLabel="Letter or file" searchable value={form.letter} onChange={(v) => setForm({ ...form, letter: v })} placeholder="Choose" options={letters.map((l) => ({ value: l.id, label: l.reference_no || "—", hint: l.subject || undefined }))} /></div>
            ) : (
              <>
                <label className="v4-field"><span className="v4-flabel">Record number <span className="v4-req">*</span></span><input className="v4-input" value={form.no} onChange={(e) => setForm({ ...form, no: e.target.value })} /></label>
                <label className="v4-field v4-span-2"><span className="v4-flabel">Description</span><input className="v4-input" value={form.desc} placeholder="Board minutes, 2026" onChange={(e) => setForm({ ...form, desc: e.target.value })} /></label>
              </>
            )}
            <div className="v4-field v4-span-2"><span className="v4-flabel">How long it is kept <span className="v4-req">*</span></span><Select ariaLabel="How long it is kept" value={form.category} onChange={(v) => setForm(setCategory(form, v))} options={RETENTION.map((r) => ({ value: r.value, label: r.value }))} /></div>
            <label className="v4-field"><span className="v4-flabel">Keep until</span><input className="v4-input" type="date" disabled={form.permanent} value={form.keep} onChange={(e) => setForm({ ...form, keep: e.target.value })} /></label>
            <label className="v4-check" style={{ alignSelf: "end", paddingBottom: 10 }}><input type="checkbox" checked={form.permanent} onChange={(e) => setForm({ ...form, permanent: e.target.checked })} /> Keep permanently</label>
            <label className="v4-field v4-span-2"><span className="v4-flabel">Shelf location <span className="v4-req">*</span></span><input className="v4-input" value={form.location} placeholder="Cabinet B · Shelf 2 · Box 14" onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
          </div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
