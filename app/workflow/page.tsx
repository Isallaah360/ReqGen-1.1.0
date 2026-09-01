"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, RefreshCw, Route, ShieldCheck, UserRoundCheck, WalletCards } from "lucide-react";
import StrictActiveRoleBoundary from "@/app/components/security/StrictActiveRoleBoundary";
import { supabase } from "@/lib/supabaseClient";
import styles from "./workflow.module.css";

type RequestRow = {
  id: string;
  request_no: string | null;
  title: string | null;
  request_type: string | null;
  personal_category: string | null;
  status: string | null;
  current_stage: string | null;
  current_owner: string | null;
  created_at: string | null;
};

type ProfileRow = { id: string; full_name: string | null; role: string | null };

type Flow = {
  key: string;
  title: string;
  description: string;
  stages: string[];
};

const CLOSED = new Set(["APPROVED", "REJECTED", "CANCELLED", "DELETED", "PAID", "CLOSED", "COMPLETED"]);

const FLOWS: Flow[] = [
  {
    key: "official",
    title: "Official Request",
    description: "Institutional requests follow the authorised departmental chain before DG approval and finance processing.",
    stages: ["Requester", "Department Review", "DG", "Account Officer", "Registry / Completion"],
  },
  {
    key: "personal-fund",
    title: "Personal Fund Request",
    description: "HR participates only as a request reviewer/minuting authority. There is no HR application module.",
    stages: ["Requester", "Department Review", "HR Review / Minute", "DG", "Account Officer", "Registry / Completion"],
  },
  {
    key: "personal-nonfund",
    title: "Personal Non-Fund Request",
    description: "Non-fund personal requests can receive an HR minute where required, then move to the DG for final decision.",
    stages: ["Requester", "Department Review", "HR Review / Minute", "DG", "Completion"],
  },
];

function key(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
}

function stageLabel(value: string | null | undefined) {
  const raw = String(value || "Pending").trim();
  const k = key(raw);
  const labels: Record<string, string> = {
    HR: "HR Review / Minute",
    HRREVIEW: "HR Review / Minute",
    HRFILING: "Workflow Filing",
    ACCOUNT: "Account Officer",
    ACCOUNTOFFICER: "Account Officer",
    DG: "DG Final Approval",
    DOD: "Director of Department",
    HOD: "Head of Department",
    PO: "Programme Officer",
    DINADMIN: "DIN Administration",
    REGISTRAR: "Registrar Review",
    DIRECTOR: "Director Review",
  };
  return labels[k] || raw;
}

function requestKind(row: RequestRow) {
  const type = key(row.request_type);
  if (type === "OFFICIAL") return "Official";
  if (type === "PERSONAL" && key(row.personal_category) === "FUND") return "Personal Fund";
  if (type === "PERSONAL") return "Personal Non-Fund";
  return row.request_type || "Request";
}

export default function WorkflowCentrePage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [owners, setOwners] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase
      .from("requests")
      .select("id,request_no,title,request_type,personal_category,status,current_stage,current_owner,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      setRows([]);
      setOwners({});
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const requestRows = (data || []) as RequestRow[];
    setRows(requestRows);

    const ownerIds = Array.from(new Set(requestRows.map((row) => row.current_owner).filter(Boolean))) as string[];
    if (ownerIds.length) {
      const { data: profileRows } = await supabase.from("profiles").select("id,full_name,role").in("id", ownerIds);
      const index: Record<string, ProfileRow> = {};
      ((profileRows || []) as ProfileRow[]).forEach((profile) => { index[profile.id] = profile; });
      setOwners(index);
    } else {
      setOwners({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const active = useMemo(() => rows.filter((row) => !CLOSED.has(key(row.status))), [rows]);
  const metrics = useMemo(() => ({
    active: active.length,
    hrReview: active.filter((row) => ["HR", "HRREVIEW", "HRFILING"].includes(key(row.current_stage))).length,
    dg: active.filter((row) => key(row.current_stage) === "DG").length,
    account: active.filter((row) => ["ACCOUNT", "ACCOUNTOFFICER"].includes(key(row.current_stage))).length,
    completed: rows.filter((row) => ["APPROVED", "PAID", "CLOSED", "COMPLETED"].includes(key(row.status))).length,
  }), [active, rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active.filter((row) => {
      const kind = requestKind(row);
      if (filter !== "ALL" && kind !== filter) return false;
      if (!q) return true;
      const owner = row.current_owner ? owners[row.current_owner] : undefined;
      return [row.request_no, row.title, kind, row.status, stageLabel(row.current_stage), owner?.full_name, owner?.role]
        .join(" ").toLowerCase().includes(q);
    });
  }, [active, filter, owners, query]);

  return (
    <StrictActiveRoleBoundary allowedRoles={["admin", "auditor", "dg"]} label="Workflow Centre">
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>REQGEN CORE WORKFLOW</p>
            <h1>Request Workflow Centre</h1>
            <p>Monitor the request-processing backbone without introducing unrelated HR or staff-management modules.</p>
          </div>
          <button type="button" className={styles.refresh} onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? styles.spin : ""} /> {loading ? "Refreshing" : "Refresh"}
          </button>
        </header>

        {message ? <div className={styles.warning}>{message}</div> : null}

        <section className={styles.metrics} aria-label="Workflow summary">
          <article><Route size={20} /><div><span>Active Requests</span><strong>{loading ? "—" : metrics.active}</strong></div></article>
          <article><UserRoundCheck size={20} /><div><span>HR Review / Minute</span><strong>{loading ? "—" : metrics.hrReview}</strong></div></article>
          <article><ShieldCheck size={20} /><div><span>At DG</span><strong>{loading ? "—" : metrics.dg}</strong></div></article>
          <article><WalletCards size={20} /><div><span>Account Processing</span><strong>{loading ? "—" : metrics.account}</strong></div></article>
          <article><CheckCircle2 size={20} /><div><span>Completed</span><strong>{loading ? "—" : metrics.completed}</strong></div></article>
        </section>

        <section className={styles.blueprints}>
          {FLOWS.map((flow) => (
            <article key={flow.key} className={styles.flowCard}>
              <div className={styles.flowHead}><div><span>Controlled Route</span><h2>{flow.title}</h2></div><Route size={20} /></div>
              <p>{flow.description}</p>
              <div className={styles.stageTrack}>
                {flow.stages.map((stage, index) => (
                  <div className={styles.stage} key={stage}>
                    <span>{index + 1}</span><b>{stage}</b>{index < flow.stages.length - 1 ? <ArrowRight size={14} /> : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className={styles.queueCard}>
          <div className={styles.queueHead}>
            <div><span>LIVE REQUEST PIPELINE</span><h2>Current Workflow Queue</h2></div>
            <div className={styles.filters}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request, stage or owner" />
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="ALL">All Request Types</option>
                <option value="Official">Official</option>
                <option value="Personal Fund">Personal Fund</option>
                <option value="Personal Non-Fund">Personal Non-Fund</option>
              </select>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Request</th><th>Type</th><th>Current Stage</th><th>Current Owner</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {!loading && filtered.length === 0 ? <tr><td colSpan={6} className={styles.empty}>No active workflow matches the current filter.</td></tr> : null}
                {filtered.map((row) => {
                  const owner = row.current_owner ? owners[row.current_owner] : undefined;
                  return <tr key={row.id}>
                    <td><strong>{row.request_no || "Request"}</strong><span>{row.title || "Untitled request"}</span></td>
                    <td>{requestKind(row)}</td>
                    <td><span className={styles.stagePill}><Clock3 size={13} />{stageLabel(row.current_stage)}</span></td>
                    <td>{owner?.full_name || "Assigned officer"}<small>{owner?.role || ""}</small></td>
                    <td><span className={styles.statusPill}>{row.status || "In Progress"}</span></td>
                    <td><Link href={`/requests/${row.id}`}>Open Request</Link></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </StrictActiveRoleBoundary>
  );
}
