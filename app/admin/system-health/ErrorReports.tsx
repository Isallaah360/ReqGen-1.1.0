"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { whenText } from "@/lib/v4/admin";
import Icon from "@/app/components/v4/Icon";
import { Notice, Skeleton } from "@/app/components/v4/ui";

/** 6.3.2: error reports from the app (with a picture of the screen), for the Super Admin and the Developer. */
type Row = { id: number; at: string; full_name: string | null; app_version: string | null; screen: string | null; code: string | null; message: string | null; severity: string; source: string; shot_path: string | null };

export default function ErrorReports() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [pic, setPic] = useState<{ url: string; row: Row } | null>(null);
  useEffect(() => {
    void supabase.rpc("reqgen_app_error_list", { p_limit: 50 }).then(({ data, error }) => {
      if (error) { setMissing(true); setRows([]); return; }
      setRows(((data || []) as Row[]).filter((r) => r.severity !== "warning"));
    });
  }, []);
  async function open(r: Row) {
    if (!r.shot_path) return;
    const { data } = await supabase.storage.from("app-error-shots").createSignedUrl(r.shot_path, 600);
    if (data?.signedUrl) setPic({ url: data.signedUrl, row: r });
  }
  return (
    <section className="v4-card" id="app-errors">
      <div className="v4-card-pad" style={{ paddingBottom: 0 }}><h2 style={{ margin: 0, fontSize: 18 }}>Error reports</h2><p className="v4-help" style={{ margin: "4px 0 0" }}>Every error in the app comes here with a picture of the screen, and the Super Admin gets a notice at once.</p></div>
      {missing ? <div className="v4-card-pad"><Notice tone="amber">Error reports need the 6.3.2 database step (database/v6_3_2_error_reports.sql).</Notice></div> : !rows ? <div className="v4-card-pad"><Skeleton lines={3} /></div> : !rows.length ? <div className="v4-card-pad"><Notice tone="green">No errors reported.</Notice></div> : (
        <ul className="v4-health">
          {rows.slice(0, 50).map((r) => (
            <li key={r.id}>
              <span className={`v4-hi ${r.severity === "crash" ? "v4-t-red" : "v4-t-amber"}`}><Icon name="alert" /></span>
              <span><strong>{r.full_name || "Staff"}, {r.screen || "ReqGen"}</strong><span className="v4-s">{whenText(r.at)}, {r.source === "website" ? "website" : `app ${r.app_version || ""}`}: {(r.message || r.code || "").slice(0, 200)}</span></span>
              {r.shot_path ? <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void open(r)}><Icon name="eye" />Picture</button> : <span className="v4-chip v4-chip-amber">{r.severity === "crash" ? "Crash" : "Error"}</span>}
            </li>
          ))}
        </ul>
      )}
      {pic ? (
        <div role="dialog" aria-label="Picture of the screen" onClick={() => setPic(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(4,30,44,.6)", display: "grid", placeItems: "center", padding: 16 }}>
          <figure style={{ margin: 0, maxWidth: 460, width: "100%", background: "#fff", borderRadius: 14, padding: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed picture from storage */}
            <img src={pic.url} alt={`Screen when the error happened: ${pic.row.message || ""}`} style={{ width: "100%", borderRadius: 8, display: "block" }} />
            <figcaption style={{ fontSize: 13, marginTop: 8, color: "#333" }}>{pic.row.message}. Click to close.</figcaption>
          </figure>
        </div>
      ) : null}
    </section>
  );
}
