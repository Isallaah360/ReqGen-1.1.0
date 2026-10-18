"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { REQGEN_VERSION } from "@/lib/version";
import { loadReleases, whenText, type Release } from "@/lib/v4/developer";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

/** Developer Console › Releases (v4.6.6): publish what changed; everyone reads it in "What's new". */
export default function DeveloperReleasesPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<Release[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [form, setForm] = useState<{ version: string; title: string; notes: string }>({ version: REQGEN_VERSION, title: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await loadReleases();
    setRows(r.rows);
    setError(r.error);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  async function publish() {
    setMsg(null);
    if (form.title.trim().length < 3) { setMsg({ tone: "red", text: "Give the release a short title." }); return; }
    if (form.notes.trim().length < 10) { setMsg({ tone: "red", text: "Write what changed (at least 10 characters)." }); return; }
    setBusy(true);
    const { error: e } = await supabase.rpc("reqgen_publish_release", { p_version: form.version.trim(), p_title: form.title.trim(), p_notes: form.notes.trim() });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    setMsg({ tone: "green", text: `${form.version.trim()} published. Staff see it in "What's new" and the Super Admin was told.` });
    setForm({ version: REQGEN_VERSION, title: "", notes: "" });
    await load();
  }

  const published = (rows || []).some((r) => r.version === REQGEN_VERSION);
  return (
    <V4Page>
      <PageHead title="Releases" sub="Tell the Trust what changed. Each release appears in What's new for everyone, and the Super Admin gets a notification." actions={[{ label: "What's new", icon: "eye", kind: "secondary", href: "/whats-new" }]} />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {rows && !published ? <Notice tone="amber" title={`${REQGEN_VERSION} is running but not published yet.`}>Publish it below so the Super Admin knows what changed.</Notice> : null}
      <div className="v4-cols">
        <Card title="Publish a release" pad>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="v4-field"><span className="v4-flabel">Version <span className="v4-req">*</span></span><input className="v4-input v4-mono" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></label>
            <label className="v4-field"><span className="v4-flabel">Title <span className="v4-req">*</span></span><input className="v4-input" value={form.title} placeholder="e.g. Super Admin and Developer accounts" onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="v4-field"><span className="v4-flabel">What changed <span className="v4-req">*</span></span><textarea className="v4-input" rows={7} value={form.notes} placeholder="One line per change, in plain words for staff." onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <button className="v4-btn v4-btn-primary" type="button" disabled={busy} onClick={() => void publish()}><Icon name="send" />{busy ? "Publishing…" : "Publish"}</button>
          </div>
        </Card>
        <Card title="Published">
          {rows === null ? <div className="v4-card-body"><Skeleton lines={5} /></div> : rows.length ? rows.map((r) => (
            <article key={r.id} className="v4-release">
              <h3><span className="v4-mono">{r.version}</span> · {r.title} {r.version === REQGEN_VERSION ? <Chip tone="green">Running</Chip> : null}</h3>
              <small className="v4-muted">{whenText(r.published_at)}{r.published_label ? ` · ${r.published_label}` : ""}</small>
              <p>{r.notes}</p>
            </article>
          )) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Nothing published yet.</p>}
        </Card>
      </div>
    </V4Page>
  );
}
