"use client";

import { useCallback, useEffect, useState } from "react";
import { loadDeveloperActivity, type AuditEvent } from "@/lib/v4/developer";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Card, Notice, PageHead, Pager, Skeleton, V4Page, downloadCsv } from "@/app/components/v4/ui";

const PAGE = 25;

/** Developer Console › Developer Activity (v4.6.6): this account's own trail in the Audit Log. */
export default function DeveloperActivityPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const load = useCallback(async () => { const r = await loadDeveloperActivity(90); setRows(r.rows); setError(r.error); }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);
  const list = rows || [];

  return (
    <V4Page>
      <PageHead title="Developer Activity" sub="Everything the Developer account did in the last 90 days. It is kept in the Audit Log, which nobody can change or delete."
        actions={[{ label: "Export CSV", icon: "download", kind: "secondary", disabled: !list.length, onClick: () => downloadCsv(`ReqGen_Developer_Activity_${new Date().toISOString().slice(0, 10)}.csv`, list.map((r) => ({ Time: new Date(r.at).toLocaleString("en-GB"), Action: r.action, Record: r.record_no || "", Module: r.module, Device: r.device || "" }))) }]} />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Card>
        {rows === null ? <div className="v4-card-body"><Skeleton lines={6} /></div> : list.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Time</th><th>Action</th><th>Record</th><th className="v4-hide-md">Module</th><th className="v4-hide-sm">Device</th></tr></thead>
              <tbody>
                {list.slice((page - 1) * PAGE, page * PAGE).map((r, i) => (
                  <tr key={`${r.at}-${i}`}>
                    <td className="v4-num">{new Date(r.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td><span className="v4-strong">{r.action}</span></td>
                    <td data-label="Record">{r.record_no || "—"}</td>
                    <td className="v4-hide-md">{r.module}</td>
                    <td className="v4-hide-sm">{r.device || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Nothing yet in the last 90 days.</p>}
        <Pager page={page} pageSize={PAGE} total={list.length} onPage={setPage} label="events" />
      </Card>
      <Notice tone="blue">The Super Admin and the Auditor can read this trail too (Audit › Audit Log › Developer). It is what shows the Trust that the Developer never touched their decisions.</Notice>
    </V4Page>
  );
}
