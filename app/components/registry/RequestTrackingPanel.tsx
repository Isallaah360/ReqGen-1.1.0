"use client";

import { useMemo, useState } from "react";
import { Download, Eye, Printer, X } from "lucide-react";
import { PersonName } from "@/app/components/ui/PersonName";
import { IconAction, IconActions } from "@/app/components/ui/IconAction";
import { useRoleDirectory } from "@/app/components/ui/useRoleDirectory";
import { nameWithRole } from "@/lib/userIdentity";
import { REQGEN_PRODUCT_LABEL } from "@/lib/version";

/**
 * ReqGen v3.0.2 — Registry request tracking.
 *
 * Registry TRACKS request movement; it never reads or edits request content.
 * This panel therefore shows only: request number, requester, dates, the
 * workflow action, the stage it moved to, who acted (with role), where it is
 * now and its status. There are deliberately no links to open, view, edit or
 * print a request — only its movement trail.
 */
export type TrackingRequest = {
  id: string;
  request_no: string | null;
  status: string | null;
  current_stage: string | null;
  current_owner: string | null;
  created_by: string | null;
  created_at: string | null;
};

export type TrackingEvent = {
  id: string;
  request_id: string;
  action_type: string | null;
  to_stage: string | null;
  actor_name: string | null;
  actor_role_name: string | null;
  created_at: string | null;
};

type Period = "today" | "7d" | "month" | "custom";
type Kind = "submitted" | "approved" | "rejected" | "returned" | "edited" | "other";

const KIND_LABEL: Record<Kind, string> = {
  submitted: "Submitted / Forwarded",
  approved: "Approved",
  rejected: "Rejected",
  returned: "Returned / Queried",
  edited: "Edited",
  other: "Other",
};

/** Keyword classification — robust to the exact wording the database writes. */
export function classifyAction(action: string | null | undefined): Kind {
  const a = String(action || "").toLowerCase();
  if (/reject|declin|disapprov/.test(a)) return "rejected";
  if (/return|query|queried|sent back|revert/.test(a)) return "returned";
  if (/approv|endorse|sign.?off/.test(a)) return "approved";
  if (/submit|forward|sent to|route|escalat|creat/.test(a)) return "submitted";
  if (/edit|update|amend/.test(a)) return "edited";
  return "other";
}

function isOpen(r: TrackingRequest) {
  return !/approved|complete|paid|closed|reject|cancel|delet/i.test(`${r.status || ""} ${r.current_stage || ""}`);
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function dateTime(value: string | null | undefined) {
  const d = toDate(value);
  return d ? d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

function stageLabel(value: string | null | undefined) {
  const v = String(value || "").trim();
  return v ? v.replace(/_/g, " ") : "—";
}

function withinRange(value: string | null | undefined, range: { start: Date; end: Date }) {
  const d = toDate(value);
  return !!d && d >= range.start && d <= range.end;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function RequestTrackingPanel({
  requests,
  history,
  loading,
}: {
  requests: TrackingRequest[];
  history: TrackingEvent[];
  loading: boolean;
}) {
  const directory = useRoleDirectory();
  const [period, setPeriod] = useState<Period>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [trailFor, setTrailFor] = useState<string | null>(null);
  const pageSize = 15;

  const range = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (period === "today") return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end, label: "Today" };
    if (period === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end, label: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
    if (period === "custom") {
      const s = from ? new Date(`${from}T00:00:00`) : new Date(0);
      const e = to ? new Date(`${to}T23:59:59`) : end;
      return { start: s, end: e, label: `${from || "Start"} to ${to || "today"}` };
    }
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { start: s, end, label: "Last 7 days" };
  }, [period, from, to]);

  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const periodRequests = useMemo(() => requests.filter((r) => withinRange(r.created_at, range)), [requests, range]);
  const periodEvents = useMemo(() => history.filter((e) => withinRange(e.created_at, range)), [history, range]);

  const totals = useMemo(() => {
    const t: Record<Kind, number> = { submitted: 0, approved: 0, rejected: 0, returned: 0, edited: 0, other: 0 };
    periodEvents.forEach((e) => { t[classifyAction(e.action_type)] += 1; });
    return t;
  }, [periodEvents]);

  const pendingNow = requests.filter(isOpen).length;

  const daily = useMemo(() => {
    const map = new Map<string, { generated: number } & Record<Kind, number>>();
    const bucket = (key: string) => {
      if (!map.has(key)) map.set(key, { generated: 0, submitted: 0, approved: 0, rejected: 0, returned: 0, edited: 0, other: 0 });
      return map.get(key)!;
    };
    periodRequests.forEach((r) => { const d = toDate(r.created_at); if (d) bucket(dayKey(d)).generated += 1; });
    periodEvents.forEach((e) => { const d = toDate(e.created_at); if (d) bucket(dayKey(d))[classifyAction(e.action_type)] += 1; });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [periodRequests, periodEvents]);

  const byStage = useMemo(() => {
    const map = new Map<string, { movedIn: number; waiting: number }>();
    periodEvents.forEach((e) => {
      if (!e.to_stage) return;
      const k = stageLabel(e.to_stage);
      const row = map.get(k) || { movedIn: 0, waiting: 0 };
      row.movedIn += 1;
      map.set(k, row);
    });
    requests.filter(isOpen).forEach((r) => {
      const k = stageLabel(r.current_stage);
      const row = map.get(k) || { movedIn: 0, waiting: 0 };
      row.waiting += 1;
      map.set(k, row);
    });
    return [...map.entries()].sort((a, b) => b[1].movedIn + b[1].waiting - (a[1].movedIn + a[1].waiting));
  }, [periodEvents, requests]);

  const byOfficer = useMemo(() => {
    const map = new Map<string, { name: string; role: string } & Record<Kind, number>>();
    periodEvents.forEach((e) => {
      const name = String(e.actor_name || "System").trim();
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { name, role: e.actor_role_name || "", submitted: 0, approved: 0, rejected: 0, returned: 0, edited: 0, other: 0 });
      const row = map.get(key)!;
      if (!row.role && e.actor_role_name) row.role = e.actor_role_name;
      row[classifyAction(e.action_type)] += 1;
    });
    return [...map.values()].sort((a, b) => (b.approved + b.rejected + b.submitted + b.returned) - (a.approved + a.rejected + a.submitted + a.returned));
  }, [periodEvents]);

  const register = useMemo(() => {
    const lastEvent = new Map<string, TrackingEvent>();
    history.forEach((e) => {
      const prev = lastEvent.get(e.request_id);
      if (!prev || (toDate(e.created_at)?.getTime() || 0) > (toDate(prev.created_at)?.getTime() || 0)) lastEvent.set(e.request_id, e);
    });
    return requests
      .filter((r) => withinRange(r.created_at, range) || (lastEvent.has(r.id) && withinRange(lastEvent.get(r.id)?.created_at, range)))
      .map((r) => ({ request: r, last: lastEvent.get(r.id) || null }))
      .sort((a, b) => (toDate(b.last?.created_at || b.request.created_at)?.getTime() || 0) - (toDate(a.last?.created_at || a.request.created_at)?.getTime() || 0));
  }, [requests, history, range]);

  const pages = Math.max(1, Math.ceil(register.length / pageSize));
  const safePage = Math.min(page, pages);
  const paged = register.slice((safePage - 1) * pageSize, safePage * pageSize);

  const requesterName = (r: TrackingRequest) => directory?.nameById(r.created_by) || "—";
  const ownerName = (r: TrackingRequest) => (r.current_owner ? directory?.nameById(r.current_owner) || "—" : "—");

  const trail = trailFor
    ? history.filter((e) => e.request_id === trailFor).sort((a, b) => (toDate(a.created_at)?.getTime() || 0) - (toDate(b.created_at)?.getTime() || 0))
    : [];
  const trailRequest = trailFor ? requestById.get(trailFor) : undefined;

  function exportCsv() {
    const lines: string[] = [];
    lines.push(csvCell(`${REQGEN_PRODUCT_LABEL} — Registry Request Tracking Report — ${range.label}`));
    lines.push("");
    lines.push(["Generated", "Submitted / Forwarded", "Approved", "Rejected", "Returned / Queried", "Pending now"].map(csvCell).join(","));
    lines.push([periodRequests.length, totals.submitted, totals.approved, totals.rejected, totals.returned, pendingNow].map(csvCell).join(","));
    lines.push("");
    lines.push(["Date", "Generated", "Submitted", "Approved", "Rejected", "Returned"].map(csvCell).join(","));
    daily.forEach(([k, v]) => lines.push([dayLabel(k), v.generated, v.submitted, v.approved, v.rejected, v.returned].map(csvCell).join(",")));
    lines.push("");
    lines.push(["Officer", "Submitted / Forwarded", "Approved", "Rejected", "Returned"].map(csvCell).join(","));
    byOfficer.forEach((o) => lines.push([nameWithRole(o.name, o.role), o.submitted, o.approved, o.rejected, o.returned].map(csvCell).join(",")));
    lines.push("");
    lines.push(["Request No.", "Requester", "Created", "Last Action", "Moved To", "By", "When", "Now At", "Now With", "Status"].map(csvCell).join(","));
    register.forEach(({ request: r, last }) => lines.push([
      r.request_no || r.id,
      nameWithRole(requesterName(r), directory?.roleById(r.created_by)),
      dateTime(r.created_at),
      last?.action_type || "Created",
      stageLabel(last?.to_stage),
      nameWithRole(last?.actor_name, last?.actor_role_name),
      dateTime(last?.created_at),
      stageLabel(r.current_stage),
      r.current_owner ? nameWithRole(ownerName(r), directory?.roleById(r.current_owner)) : "—",
      r.status || "—",
    ].map(csvCell).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registry-request-tracking-${dayKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    document.body.classList.add("rg-printing-report");
    const cleanup = () => { document.body.classList.remove("rg-printing-report"); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  const kpis: Array<[string, number]> = [
    ["Requests generated", periodRequests.length],
    ["Submitted / forwarded", totals.submitted],
    ["Approved", totals.approved],
    ["Rejected", totals.rejected],
    ["Returned / queried", totals.returned],
    ["Pending now (all time)", pendingNow],
  ];

  return (
    <section className="rg-track" aria-label="Registry request tracking">
      <div className="rg-track-print-head">
        <strong>{REQGEN_PRODUCT_LABEL} — Registry Request Tracking Report</strong>
        <span>Period: {range.label} · Printed {new Date().toLocaleString("en-GB")}</span>
      </div>

      <div className="rg-track-toolbar rg-no-print">
        <label>Period
          <select value={period} onChange={(e) => { setPeriod(e.target.value as Period); setPage(1); }}>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {period === "custom" ? (
          <>
            <label>From<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
            <label>To<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
          </>
        ) : null}
        <div className="rg-track-toolbar-actions">
          <button type="button" className="rg-btn rg-btn-secondary" onClick={exportCsv} disabled={loading}><Download size={15} />Export CSV</button>
          <button type="button" className="rg-btn rg-btn-primary" onClick={printReport} disabled={loading}><Printer size={15} />Print Report</button>
        </div>
      </div>

      <p className="rg-track-note rg-no-print">Registry tracks request movement only. Request contents are not shown here and cannot be opened or edited from Registry.</p>

      <div className="rg-track-kpis">
        {kpis.map(([label, value]) => (
          <div key={label} className="rg-track-kpi"><span>{label}</span><strong>{loading ? "—" : value.toLocaleString()}</strong></div>
        ))}
      </div>

      <div className="rg-track-grid">
        <article className="rg-track-card">
          <h3>Daily activity</h3>
          <div className="rg-track-scroll">
            <table className="rg-std-table">
              <thead><tr><th>Date</th><th className="rg-col-fit">Generated</th><th className="rg-col-fit">Submitted</th><th className="rg-col-fit">Approved</th><th className="rg-col-fit">Rejected</th><th className="rg-col-fit">Returned</th></tr></thead>
              <tbody>
                {daily.map(([k, v]) => (
                  <tr key={k}><td>{dayLabel(k)}</td><td className="rg-col-fit">{v.generated}</td><td className="rg-col-fit">{v.submitted}</td><td className="rg-col-fit">{v.approved}</td><td className="rg-col-fit">{v.rejected}</td><td className="rg-col-fit">{v.returned}</td></tr>
                ))}
                {!daily.length ? <tr><td colSpan={6} className="rg-track-empty">No request activity in this period.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rg-track-card">
          <h3>Submitted to — by approval level</h3>
          <div className="rg-track-scroll">
            <table className="rg-std-table">
              <thead><tr><th>Stage</th><th className="rg-col-fit">Moved in (period)</th><th className="rg-col-fit">Waiting now</th></tr></thead>
              <tbody>
                {byStage.map(([stage, v]) => (
                  <tr key={stage}><td><strong>{stage}</strong></td><td className="rg-col-fit">{v.movedIn}</td><td className="rg-col-fit">{v.waiting}</td></tr>
                ))}
                {!byStage.length ? <tr><td colSpan={3} className="rg-track-empty">No stage movement recorded.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="rg-track-card">
        <h3>Officer actions</h3>
        <div className="rg-track-scroll">
          <table className="rg-std-table">
            <thead><tr><th className="rg-col-index">#</th><th>Officer</th><th className="rg-col-fit">Submitted / Forwarded</th><th className="rg-col-fit">Approved</th><th className="rg-col-fit">Rejected</th><th className="rg-col-fit">Returned</th></tr></thead>
            <tbody>
              {byOfficer.map((o, i) => (
                <tr key={o.name}><td className="rg-col-index">{i + 1}</td><td><PersonName name={o.name} role={o.role} /></td><td className="rg-col-fit">{o.submitted}</td><td className="rg-col-fit">{o.approved}</td><td className="rg-col-fit">{o.rejected}</td><td className="rg-col-fit">{o.returned}</td></tr>
              ))}
              {!byOfficer.length ? <tr><td colSpan={6} className="rg-track-empty">No officer actions in this period.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rg-track-card">
        <h3>Request movement register <small>{register.length.toLocaleString()} request(s)</small></h3>
        <div className="rg-track-scroll">
          <table className="rg-std-table">
            <thead><tr><th>Request No.</th><th>Requester</th><th>Created</th><th>Last action</th><th>Moved to</th><th>By</th><th>When</th><th>Now at</th><th>Now with</th><th>Status</th><th className="rg-col-actions rg-no-print">Trail</th></tr></thead>
            <tbody>
              {paged.map(({ request: r, last }) => (
                <tr key={r.id}>
                  <td><strong>{r.request_no || "—"}</strong></td>
                  <td><PersonName name={requesterName(r)} userId={r.created_by} /></td>
                  <td>{dateTime(r.created_at)}</td>
                  <td>{last?.action_type || "Created"}</td>
                  <td>{stageLabel(last?.to_stage)}</td>
                  <td>{last ? <PersonName name={last.actor_name || "System"} role={last.actor_role_name} /> : "—"}</td>
                  <td>{dateTime(last?.created_at)}</td>
                  <td>{stageLabel(r.current_stage)}</td>
                  <td>{r.current_owner ? <PersonName name={ownerName(r)} userId={r.current_owner} /> : "—"}</td>
                  <td>{r.status || "—"}</td>
                  <td className="rg-col-actions rg-no-print"><IconActions><IconAction kind="view" label={`Movement trail for ${r.request_no || "request"}`} onClick={() => setTrailFor(r.id)} /></IconActions></td>
                </tr>
              ))}
              {!paged.length ? <tr><td colSpan={11} className="rg-track-empty">No requests moved in this period.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {pages > 1 ? (
          <div className="rg-track-pager rg-no-print">
            <span>Page {safePage} of {pages}</span>
            <div>
              <button type="button" className="rg-btn rg-btn-secondary" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button>
              <button type="button" className="rg-btn rg-btn-secondary" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>Next</button>
            </div>
          </div>
        ) : null}
      </article>

      {trailFor ? (
        <div className="rg-modal-backdrop rg-no-print" role="presentation" onMouseDown={() => setTrailFor(null)}>
          <div className="rg-modal" role="dialog" aria-modal="true" aria-label="Request movement trail" onMouseDown={(e) => e.stopPropagation()}>
            <div className="rg-track-modal-head">
              <div>
                <h3><Eye size={17} /> Movement trail · {trailRequest?.request_no || "Request"}</h3>
                <p>Requested by <PersonName name={trailRequest ? requesterName(trailRequest) : "—"} userId={trailRequest?.created_by} /> on {dateTime(trailRequest?.created_at)}</p>
              </div>
              <button type="button" className="rg-icon-action is-neutral" aria-label="Close" onClick={() => setTrailFor(null)}><X size={16} /></button>
            </div>
            <ol className="rg-track-trail">
              {trail.map((e) => (
                <li key={e.id}>
                  <span className={`rg-track-dot is-${classifyAction(e.action_type)}`} aria-hidden="true" />
                  <div>
                    <strong>{e.action_type || KIND_LABEL[classifyAction(e.action_type)]}</strong>
                    <span>→ {stageLabel(e.to_stage)} · by <PersonName name={e.actor_name || "System"} role={e.actor_role_name} /></span>
                    <small>{dateTime(e.created_at)}</small>
                  </div>
                </li>
              ))}
              {!trail.length ? <li className="rg-track-empty">No movement recorded yet for this request.</li> : null}
            </ol>
            <p className="rg-track-note">Now at <strong>{stageLabel(trailRequest?.current_stage)}</strong> · Status <strong>{trailRequest?.status || "—"}</strong></p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
