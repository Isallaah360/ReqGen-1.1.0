"use client";

import { useEffect, useState } from "react";
import Icon from "@/app/components/v4/Icon";
import { latestRelease, type AppRelease } from "@/lib/app/update";

/** The download button, the size and date, and the APK's SHA-256 fingerprint in full (brief §7). */
export default function AppDownload() {
  const [info, setInfo] = useState<AppRelease | null | undefined>(undefined);
  useEffect(() => { void latestRelease().then(setInfo); }, []);
  if (info === undefined) return <span className="v4-sk" style={{ height: 52, borderRadius: 14 }} aria-label="Loading" />;
  if (!info) return <p className="v4-notice v4-notice-amber" style={{ margin: 0 }}>The Android app is being prepared. Please check again soon.</p>;
  return (
    <>
      <a className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" href={info.apk || "/downloads/ReqGen.apk"} download="ReqGen.apk"><Icon name="download" />Download ReqGen {info.version}</a>
      <p className="v4-muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>{["Android 7 or newer", info.size, info.date ? `released ${info.date}` : ""].filter(Boolean).join(", ")}</p>
      {info.sha256 ? (
        <div style={{ marginTop: 14, textAlign: "left" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 14 }}>Check the file is ours</p>
          <p className="v4-muted" style={{ margin: "0 0 6px", fontSize: 12.5 }}>SHA-256 fingerprint of ReqGen.apk</p>
          <div className="v4-sha">{info.sha256}</div>
        </div>
      ) : null}
    </>
  );
}
