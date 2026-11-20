"use client";

import { useState } from "react";
import Modal from "@/app/components/v4/Modal";
import Icon from "@/app/components/v4/Icon";
import { downloadAndInstall, type AppRelease } from "@/lib/app/update";

/** ReqGen v4.6.11 — Update inside the app: what is new, then download with progress and Install. */
export default function UpdateSheet({ open, release, onClose }: { open: boolean; release: AppRelease; onClose: () => void }) {
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const busy = pct !== null && pct < 100 && !msg;
  async function go() {
    setMsg(null); setPct(0);
    try { await downloadAndInstall(release, setPct); }
    catch (e) { setPct(null); setMsg(e instanceof Error && e.message ? `The update did not download: ${e.message}` : "The update did not download. Check the network and try again."); }
  }
  const list = (title: string, items?: string[]) => (items && items.length ? <><p style={{ margin: "8px 0 0", fontWeight: 800 }}>{title}</p><ul className="v4-update-list">{items.map((t) => <li key={t}>{t}</li>)}</ul></> : null);
  return (
    <Modal open={open} title={`ReqGen ${release.version}`} sub={[release.size, release.date ? `released ${release.date}` : ""].filter(Boolean).join(", ")} onClose={onClose} busy={busy}
      footer={<>
        <button className="v4-btn v4-btn-secondary" type="button" onClick={onClose} disabled={busy}>Later</button>
        <button className="v4-btn v4-btn-primary" type="button" onClick={() => void go()} disabled={busy}><Icon name="download" />{pct === null ? "Update" : pct < 100 ? `Downloading ${pct}%` : "Install"}</button>
      </>}>
      {list("New", release.new)}
      {list("Fixed", release.fixed)}
      {list("Better", release.better)}
      {pct !== null ? (
        <div style={{ marginTop: 10 }}>
          <div className="v4-update-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Download progress"><i style={{ width: `${pct}%` }} /></div>
          <p className="v4-muted" style={{ margin: "6px 0 0", fontSize: 13 }}>{pct < 100 ? "Downloading. Keep ReqGen open." : "Android will ask you to Install. Your sign-in stays."}</p>
        </div>
      ) : null}
      {msg ? <p role="alert" style={{ color: "var(--v4-red)", fontWeight: 700, margin: "10px 0 0" }}>{msg}</p> : null}
    </Modal>
  );
}
