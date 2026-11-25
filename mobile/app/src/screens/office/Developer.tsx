import { useState } from "react";
import { Power, Send } from "lucide-react";
import { db } from "../../lib/core";
import { when } from "../../lib/text";
import { Body, Cell, Chip, FormSheet, Head, Item, Note, Skeleton } from "../../ui";
import { AuditLog } from "./Audit";
import { Err, call, useAction, useLoad } from "./kit";

/** App 4.1.0: the Developer Console (Barderian Enterprises): module switches, releases and own activity. */
type Mod = { module_key: string; label: string; enabled: boolean; note: string | null; changed_label: string | null; changed_at: string };
export function DevModules() {
  const { data, error, reload } = useLoad(async () => { const { data: d, error: e } = await (await db()).from("reqgen_module_switches").select("module_key,label,enabled,note,changed_label,changed_at"); if (e) throw new Error(e.message); return (d || []) as Mod[]; }, []);
  const [dlg, setDlg] = useState<Mod | null>(null);
  const [note, setNote] = useState("");
  const { busy, err, setErr, run } = useAction();
  return (
    <>
      <Head title="Modules" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Switch a module off for maintenance, with a message for staff.</p>
        <Err text={error} />
        {!data ? <Skeleton rows={4} /> : <div className="grp">{data.map((m) => <Cell key={m.module_key} icon={<Power size={18} />} iconTone={m.enabled ? "ok" : "er"} title={m.label} sub={m.enabled ? "On" : `Off: ${m.note || ""}`} wrap right={<Chip tone={m.enabled ? "ok" : "er"}>{m.enabled ? "On" : "Off"}</Chip>} onClick={() => { setNote(m.note || ""); setDlg(m); }} />)}</div>}
      </Body>
      <FormSheet open={!!dlg} title={dlg ? `${dlg.enabled ? "Switch off" : "Switch on"} ${dlg.label}?` : ""} onClose={() => setDlg(null)} saveLabel={dlg?.enabled ? "Switch off" : "Switch on"} busy={busy} error={err} onSave={() => {
        if (!dlg) return;
        if (dlg.enabled && note.trim().length < 5) { setErr("Write the message staff see."); return; }
        void run(null, () => call("reqgen_set_module", { p_key: dlg.module_key, p_enabled: !dlg.enabled, p_note: note.trim() || null }), "Saved.", async () => { setDlg(null); await reload(); });
      }}>{dlg?.enabled ? <label><span className="lbl">Message for staff</span><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Back at 4 pm" /></label> : <p className="mu">Staff can use it again at once.</p>}</FormSheet>
    </>
  );
}

type Release = { id: string; version: string; title: string; notes: string; published_label: string | null; published_at: string };
export function DevReleases() {
  const { data, error, reload } = useLoad(async () => { const { data: d, error: e } = await (await db()).from("reqgen_releases").select("id,version,title,notes,published_label,published_at").order("published_at", { ascending: false }).limit(100); if (e) throw new Error(e.message); return (d || []) as Release[]; }, []);
  const [form, setForm] = useState<null | { version: string; title: string; notes: string }>(null);
  const { busy, err, setErr, run } = useAction();
  return (
    <>
      <Head title="Releases" />
      <Body onRefresh={reload}>
        <button type="button" className="btn bp block" onClick={() => setForm({ version: "", title: "", notes: "" })}><Send size={18} />Publish a release</button>
        <Note tone="mu">The Super Admin is told. App updates are announced from App releases in Supabase.</Note>
        <Err text={error} />
        {!data ? <Skeleton rows={3} /> : data.map((r) => <Item key={r.id} title={`${r.version}: ${r.title}`} sub={r.notes} facts={[["Published", `${when(r.published_at)}${r.published_label ? `, ${r.published_label}` : ""}`]]} />)}
      </Body>
      <FormSheet open={!!form} title="Publish a release" onClose={() => setForm(null)} saveLabel="Publish" busy={busy} error={err} onSave={() => {
        if (!form) return;
        if (!form.version.trim() || form.title.trim().length < 3 || form.notes.trim().length < 5) { setErr("Type the version, the title and what changed."); return; }
        void run(null, () => call("reqgen_publish_release", { p_version: form.version.trim(), p_title: form.title.trim(), p_notes: form.notes.trim() }), "Published. The Super Admin is told.", async () => { setForm(null); await reload(); });
      }}>
        {form ? (<>
          <label><span className="lbl">Version</span><input className="inp" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 6.1.0" /></label>
          <label><span className="lbl">Title</span><input className="inp" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label><span className="lbl">What changed</span><textarea className="inp" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </>) : null}
      </FormSheet>
    </>
  );
}

export function DevActivity() {
  return <AuditLog title="Developer Activity" only="developer" />;
}
