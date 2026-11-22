"use client";

import { useRef, useState } from "react";
import Modal from "@/app/components/v4/Modal";
import Icon from "@/app/components/v4/Icon";
import { useApp } from "@/lib/app/useApp";
import { downloadAndInstall, type AppRelease } from "@/lib/app/update";

/**
 * ReqGen v4.6.12 (Kit K3): the update box inside the app.
 *   1. "Do you want to upgrade?" with what is new, Later and Upgrade.
 *   2. "Downloading ReqGen 1.0.2": the bar, "1,204 KB of 4,812 KB", the %,
 *      and Cancel.
 *   3. Android's installer opens. The sign-in stays.
 */
const kb = (n: number) => `${Math.round(n / 1024).toLocaleString("en-GB")} KB`;

export default function UpdateSheet({ open, release, onClose }: { open: boolean; release: AppRelease; onClose: () => void }) {
  const { version } = useApp();
  const [pct, setPct] = useState<number | null>(null);
  const [bytes, setBytes] = useState<{ got: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const stop = useRef(false);
  const downloading = pct !== null && pct < 100 && !msg;

  async function go() {
    stop.current = false;
    setMsg(null); setPct(0); setBytes(null);
    try {
      await downloadAndInstall(release, (p, got, total) => { setPct(p); if (got !== undefined && total) setBytes({ got, total }); }, () => stop.current);
      if (stop.current) { setPct(null); setBytes(null); }
    } catch (e) {
      setPct(null); setBytes(null);
      if (!stop.current) setMsg(e instanceof Error && e.message ? `The update did not download: ${e.message}` : "The update did not download. Check the network and try again.");
    }
  }
  function cancel() { stop.current = true; setPct(null); setBytes(null); onClose(); }

  const items = [...(release.new || []), ...(release.fixed || []), ...(release.better || [])].slice(0, 6);

  if (pct !== null) {
    return (
      <Modal open={open} title={pct < 100 ? `Downloading ReqGen ${release.version}` : "Ready to install"} onClose={cancel}
        footer={<button className="v4-btn v4-btn-secondary" type="button" onClick={cancel} disabled={pct >= 100}>Cancel</button>}>
        <div className="k-update">
          <div className="k-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Download progress"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>
          <div className="k-progress-row"><span>{bytes ? `${kb(bytes.got)} of ${kb(bytes.total)}` : release.size || "Starting…"}</span><span>{pct}%</span></div>
          <p className="v4-muted" style={{ fontSize: 13 }}>{pct < 100 ? "When it finishes, Android opens the installer. Keep ReqGen open." : "Android will ask you to Install. Your sign-in stays."}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} title="Do you want to upgrade?" sub={`ReqGen ${release.version} is ready.${version ? ` You have ${version}.` : ""}${release.size ? ` Size ${release.size}.` : ""}`} onClose={onClose} busy={downloading}
      footer={<>
        <button className="v4-btn v4-btn-secondary" type="button" onClick={onClose}>Later</button>
        <button className="v4-btn v4-btn-primary" type="button" onClick={() => void go()}><Icon name="download" />Upgrade</button>
      </>}>
      <div className="k-update">
        {items.length ? <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul> : null}
        {msg ? <p role="alert" style={{ color: "var(--v4-red)", fontWeight: 700 }}>{msg}</p> : null}
      </div>
    </Modal>
  );
}
