"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
import {
  HRAccessState,
  HRPageHero,
  HRRecordTable,
  HRSearchBox,
  HRStatCard,
  HRRequest,
  isArchived,
  isCompleted,
  isRejected,
  useFilteredRows,
  useHRRequests,
} from "@/app/components/hr/HRWorkspace";
import { supabase } from "@/lib/supabaseClient";

type StaffFile = {
  id: string;
  staff_id: string;
  department_id: string | null;
  file_no: string;
  employment_status: string;
  custody_status: string;
  current_location: string;
  completeness_score: number;
  missing_documents: string[];
  classification: string;
  retention_status: string;
  archive_reference: string | null;
  archive_reason: string | null;
  retention_review_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  restored_at: string | null;
  notes: string | null;
  updated_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  dept_id: string | null;
};

type Department = { id: string; name: string | null };

type Movement = {
  id: string;
  staff_file_id: string;
  movement_type: string;
  from_location: string | null;
  to_location: string | null;
  purpose: string | null;
  remarks: string | null;
  created_at: string;
};

type RoleRow = {
  role_key: string | null;
  role_name: string | null;
  is_active: boolean | null;
};

type ViewKey = "overview" | "personnel" | "workflow" | "movements";
type FileFilter = "all" | "archived" | "archive_ready" | "hold" | "restored";

type IconName =
  | "archive"
  | "folder"
  | "restore"
  | "search"
  | "refresh"
  | "history"
  | "shield"
  | "calendar"
  | "close"
  | "file";

function compact(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function pretty(value: string | null | undefined) {
  return (value || "Not available")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readableDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    archive: <><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" /></>,
    folder: <><path d="M3 6h6l2 2h10v11H3z" /><path d="M3 6v13" /></>,
    restore: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v8h8" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0 2 5" /><path d="M20 4v7h-7" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6M12 7v5l3 2" /></>,
    shield: <><path d="M12 3 4.5 6v5.2c0 4.8 3 8.1 7.5 9.8 4.5-1.7 7.5-5 7.5-9.8V6L12 3Z" /><path d="m9.5 12 1.7 1.7 3.7-4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function StatusBadge({ value }: { value: string }) {
  const key = compact(value);
  const style = key.includes("archive")
    ? "border-violet-200 bg-violet-50 text-violet-700"
    : key.includes("hold")
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : key.includes("restore") || key.includes("active")
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${style}`}>{pretty(value)}</span>;
}

export default function HRArchivePage() {
  const workflow = useHRRequests();
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [refreshingFiles, setRefreshingFiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [files, setFiles] = useState<StaffFile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const [view, setView] = useState<ViewKey>("overview");
  const [search, setSearch] = useState("");
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [selectedFile, setSelectedFile] = useState<StaffFile | null>(null);
  const [action, setAction] = useState<"archive" | "restore">("archive");
  const [archiveReference, setArchiveReference] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveLocation, setArchiveLocation] = useState("HR Archive Room");
  const [reviewDate, setReviewDate] = useState("");
  const [remarks, setRemarks] = useState("");

  const loadFiles = useCallback(async (silent = false) => {
    silent ? setRefreshingFiles(true) : setLoadingFiles(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;
      if (authError || !user) throw new Error("Your session has expired. Please sign in again.");

      const [profileRole, extraRoles, assignments, filesResult, profilesResult, departmentsResult, movementsResult] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        supabase.from("profile_roles").select("role_key,role_name,is_active").eq("profile_id", user.id).eq("is_active", true),
        supabase.from("hr_officer_assignments").select("section_key,permission_key,is_active").eq("officer_id", user.id).eq("is_active", true),
        supabase.from("hr_staff_files").select("id,staff_id,department_id,file_no,employment_status,custody_status,current_location,completeness_score,missing_documents,classification,retention_status,archive_reference,archive_reason,retention_review_at,archived_at,archived_by,restored_at,notes,updated_at").order("updated_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,email,dept_id").order("full_name"),
        supabase.from("departments").select("id,name").order("name"),
        supabase.from("hr_staff_file_movements").select("id,staff_file_id,movement_type,from_location,to_location,purpose,remarks,created_at").in("movement_type", ["archived", "restored"]).order("created_at", { ascending: false }).limit(150),
      ]);

      if (filesResult.error) throw filesResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      if (movementsResult.error) throw movementsResult.error;

      const roles = new Set<string>([compact(profileRole.data?.role)]);
      ((extraRoles.data || []) as RoleRow[]).forEach((role) => {
        roles.add(compact(role.role_key));
        roles.add(compact(role.role_name));
      });

      const isBoss = roles.has("admin") || roles.has("hrboss") || roles.has("hr");
      const hasArchivePermission = (assignments.data || []).some((assignment: any) =>
        compact(assignment.section_key) === "archive" && ["process", "file", "archive", "manage"].includes(compact(assignment.permission_key)),
      );

      setCanManage(isBoss || hasArchivePermission);
      setFiles((filesResult.data || []) as StaffFile[]);
      setProfiles((profilesResult.data || []) as Profile[]);
      setDepartments((departmentsResult.data || []) as Department[]);
      setMovements((movementsResult.data || []) as Movement[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the HR Archive Centre.");
    } finally {
      setLoadingFiles(false);
      setRefreshingFiles(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const departmentMap = useMemo(() => new Map(departments.map((department) => [department.id, department.name || "Unnamed Department"])), [departments]);

  const archivedWorkflow = useMemo(
    () => workflow.rows.filter(isArchived).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [workflow.rows],
  );
  const filteredWorkflow = useFilteredRows(archivedWorkflow, search);

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return files.filter((file) => {
      const profile = profileMap.get(file.staff_id);
      const department = departmentMap.get(file.department_id || "") || "";
      const text = [file.file_no, profile?.full_name, profile?.email, department, file.archive_reference, file.archive_reason, file.current_location, file.retention_status].join(" ").toLowerCase();
      const matchesSearch = !query || text.includes(query);
      const matchesFilter = fileFilter === "all"
        || (fileFilter === "archived" && file.retention_status === "archived")
        || (fileFilter === "archive_ready" && file.retention_status === "archive_ready")
        || (fileFilter === "hold" && file.retention_status === "hold")
        || (fileFilter === "restored" && Boolean(file.restored_at) && file.retention_status !== "archived");
      return matchesSearch && matchesFilter;
    });
  }, [departmentMap, fileFilter, files, profileMap, search]);

  const archivedFiles = files.filter((file) => file.retention_status === "archived");
  const archiveReady = files.filter((file) => file.retention_status === "archive_ready");
  const retentionHold = files.filter((file) => file.retention_status === "hold");
  const restoredFiles = files.filter((file) => Boolean(file.restored_at) && file.retention_status !== "archived");
  const completedWorkflow = archivedWorkflow.filter(isCompleted).length;
  const rejectedWorkflow = archivedWorkflow.filter(isRejected).length;
  const reviewDue = archivedFiles.filter((file) => file.retention_review_at && new Date(file.retention_review_at).getTime() <= Date.now()).length;

  const departmentArchiveStats = useMemo(() => {
    const totals = new Map<string, number>();
    archivedFiles.forEach((file) => {
      const name = departmentMap.get(file.department_id || "") || "Unassigned Department";
      totals.set(name, (totals.get(name) || 0) + 1);
    });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [archivedFiles, departmentMap]);

  function openAction(file: StaffFile, nextAction: "archive" | "restore") {
    setSelectedFile(file);
    setAction(nextAction);
    setArchiveReference(file.archive_reference || "");
    setArchiveReason(file.archive_reason || "");
    setArchiveLocation(nextAction === "archive" ? "HR Archive Room" : "HR Registry");
    setReviewDate(file.retention_review_at || "");
    setRemarks("");
    setError(null);
    setSuccess(null);
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!selectedFile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (action === "archive" && !archiveReference.trim()) {
        throw new Error("Enter an archive reference before archiving the file.");
      }

      const { error: rpcError } = await supabase.rpc("hr_archive_staff_file", {
        p_staff_file_id: selectedFile.id,
        p_action: action,
        p_archive_reference: archiveReference.trim() || null,
        p_reason: archiveReason.trim() || null,
        p_to_location: archiveLocation.trim() || (action === "archive" ? "HR Archive Room" : "HR Registry"),
        p_retention_review_at: reviewDate || null,
        p_remarks: remarks.trim() || null,
      });

      if (rpcError) throw rpcError;
      setSuccess(action === "archive" ? "Personnel file archived successfully." : "Personnel file restored to active custody successfully.");
      setSelectedFile(null);
      await loadFiles(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the archive record.");
    } finally {
      setSaving(false);
    }
  }

  const loading = workflow.loading || loadingFiles;
  const refreshing = workflow.refreshing || refreshingFiles;

  if (loading || !workflow.allowed) {
    return <HRAccessState loading={loading} allowed={workflow.allowed} message={workflow.message || error} />;
  }

  return (
    <HRAccessGuard section="archive" permission="view">
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <HRPageHero
            eyebrow="HR Records Governance"
            title="HR Archive Centre"
            description="Manage completed HR workflow records and the formal retention lifecycle of personnel files. Archive, restore, review and retrieve records without changing the original source documents."
            icon="archive"
            roleSummary={workflow.roleSummary}
            refreshing={refreshing}
            onRefresh={() => {
              workflow.refresh();
              void loadFiles(true);
            }}
          />

          <HRNavigation />

          {(error || workflow.message) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              {error || workflow.message}
            </div>
          )}
          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
              {success}
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <HRStatCard label="Archived personnel files" value={archivedFiles.length} note="Formal archive custody" tone="violet" />
            <HRStatCard label="Archive-ready files" value={archiveReady.length} note="Awaiting approved transfer" tone="blue" />
            <HRStatCard label="Archived HR workflows" value={archivedWorkflow.length} note={`${completedWorkflow} completed; ${rejectedWorkflow} closed`} tone="emerald" />
            <HRStatCard label="Retention attention" value={retentionHold.length + reviewDue} note={`${reviewDue} review date(s) due`} tone="amber" />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              {([
                ["overview", "Archive Overview", "archive", "bg-slate-800 hover:bg-slate-700"],
                ["personnel", "Personnel Files", "folder", "bg-violet-600 hover:bg-violet-500"],
                ["workflow", "HR Workflow Records", "file", "bg-emerald-600 hover:bg-emerald-500"],
                ["movements", "Archive Movement", "history", "bg-cyan-600 hover:bg-cyan-500"],
              ] as const).map(([key, label, icon, tone]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={`reqgen-btn flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100 ${tone} ${view === key ? "ring-4 ring-slate-200" : ""}`}
                >
                  <Icon name={icon} className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Archive Search</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Find retained HR records</h2>
                <div className="mt-4">
                  <HRSearchBox value={search} onChange={setSearch} placeholder="Search file number, staff, department, reference or HR workflow..." />
                </div>
              </div>
              {view === "personnel" && (
                <label>
                  <span className="text-sm font-black text-slate-800">Retention Status</span>
                  <select value={fileFilter} onChange={(event) => setFileFilter(event.target.value as FileFilter)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                    <option value="all">All personnel files</option>
                    <option value="archived">Archived</option>
                    <option value="archive_ready">Archive ready</option>
                    <option value="hold">Retention hold</option>
                    <option value="restored">Recently restored</option>
                  </select>
                </label>
              )}
            </div>
          </section>

          {view === "overview" && (
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Archive Position</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">Personnel record lifecycle</h2>
                  </div>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Icon name="archive" /></span>
                </div>
                <div className="mt-6 space-y-4">
                  {[
                    ["Formal archive", archivedFiles.length, "bg-violet-600"],
                    ["Archive ready", archiveReady.length, "bg-blue-600"],
                    ["Retention hold", retentionHold.length, "bg-amber-500"],
                    ["Restored records", restoredFiles.length, "bg-emerald-600"],
                  ].map(([label, count, color]) => {
                    const maximum = Math.max(files.length, 1);
                    return (
                      <div key={String(label)}>
                        <div className="flex items-center justify-between text-sm"><span className="font-black text-slate-700">{label}</span><span className="font-black text-slate-950">{count}</span></div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (Number(count) / maximum) * 100)}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Department Coverage</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">Archived files by department</h2>
                  </div>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700"><Icon name="folder" /></span>
                </div>
                <div className="mt-5 space-y-3">
                  {departmentArchiveStats.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center font-semibold text-slate-500">No personnel files have entered formal archive custody.</p>
                  ) : departmentArchiveStats.map(([department, count]) => (
                    <div key={department} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="font-bold text-slate-800">{department}</span>
                      <span className="rounded-full bg-blue-700 px-3 py-1 text-xs font-black text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Records Governance</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">Archive controls and retention safeguards</h2>
                    <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-600">Archiving preserves the authoritative personnel record. Restoration returns custody to HR Registry but never deletes the archive movement history. Files under legal, disciplinary or administrative hold should remain protected until the HR Boss or Admin authorizes release.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/hr/staff" className="reqgen-btn reqgen-btn-blue inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-md hover:bg-blue-800"><Icon name="folder" />Open Staff Files</Link>
                    <Link href="/hr/audit" className="reqgen-btn reqgen-btn-violet inline-flex min-h-12 items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-black text-white shadow-md hover:bg-violet-800"><Icon name="shield" />Open HR Audit</Link>
                  </div>
                </div>
              </section>
            </div>
          )}

          {view === "personnel" && (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-5 py-4 font-black">File / Staff</th>
                      <th className="px-5 py-4 font-black">Department</th>
                      <th className="px-5 py-4 font-black">Retention</th>
                      <th className="px-5 py-4 font-black">Archive Reference</th>
                      <th className="px-5 py-4 font-black">Archive / Review Date</th>
                      <th className="px-5 py-4 text-right font-black">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFiles.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-14 text-center font-semibold text-slate-500">No personnel archive records match the current filters.</td></tr>
                    ) : filteredFiles.map((file) => {
                      const profile = profileMap.get(file.staff_id);
                      return (
                        <tr key={file.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4"><p className="font-black text-slate-950">{file.file_no}</p><p className="mt-1 text-xs font-semibold text-slate-500">{profile?.full_name || profile?.email || "Unknown Staff"}</p></td>
                          <td className="px-5 py-4 font-bold text-slate-700">{departmentMap.get(file.department_id || "") || "Unassigned Department"}</td>
                          <td className="px-5 py-4"><StatusBadge value={file.retention_status} /></td>
                          <td className="px-5 py-4"><p className="font-bold text-slate-800">{file.archive_reference || "—"}</p><p className="mt-1 max-w-xs truncate text-xs text-slate-500">{file.archive_reason || file.current_location}</p></td>
                          <td className="px-5 py-4"><p className="font-bold text-slate-700">{readableDate(file.archived_at || file.restored_at)}</p><p className="mt-1 text-xs text-slate-500">Review: {readableDate(file.retention_review_at)}</p></td>
                          <td className="px-5 py-4 text-right">
                            {canManage && file.retention_status === "archived" ? (
                              <button type="button" onClick={() => openAction(file, "restore")} className="reqgen-btn reqgen-btn-emerald inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700"><Icon name="restore" className="h-4 w-4" />Restore</button>
                            ) : canManage && ["archive_ready", "active", "hold"].includes(file.retention_status) ? (
                              <button type="button" onClick={() => openAction(file, "archive")} className="reqgen-btn reqgen-btn-violet inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-violet-700"><Icon name="archive" className="h-4 w-4" />Archive</button>
                            ) : <span className="text-xs font-bold text-slate-400">Read only</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {view === "workflow" && <HRRecordTable rows={filteredWorkflow} emptyText="No archived HR workflow records match the current search." />}

          {view === "movements" && (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-950 text-white"><tr><th className="px-5 py-4 font-black">Date</th><th className="px-5 py-4 font-black">Personnel File</th><th className="px-5 py-4 font-black">Movement</th><th className="px-5 py-4 font-black">Location</th><th className="px-5 py-4 font-black">Purpose / Remarks</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.length === 0 ? <tr><td colSpan={5} className="px-6 py-14 text-center font-semibold text-slate-500">No archive movement has been recorded.</td></tr> : movements.map((movement) => {
                      const file = files.find((item) => item.id === movement.staff_file_id);
                      const profile = file ? profileMap.get(file.staff_id) : null;
                      return <tr key={movement.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-bold text-slate-700">{readableDate(movement.created_at)}</td><td className="px-5 py-4"><p className="font-black text-slate-950">{file?.file_no || "Unknown file"}</p><p className="mt-1 text-xs text-slate-500">{profile?.full_name || "—"}</p></td><td className="px-5 py-4"><StatusBadge value={movement.movement_type} /></td><td className="px-5 py-4"><p className="font-bold text-slate-700">{movement.to_location || "—"}</p><p className="mt-1 text-xs text-slate-500">From: {movement.from_location || "—"}</p></td><td className="px-5 py-4"><p className="max-w-md font-semibold text-slate-700">{movement.purpose || "—"}</p><p className="mt-1 max-w-md text-xs text-slate-500">{movement.remarks || ""}</p></td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {selectedFile && (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <form onSubmit={submitAction} className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-slate-950 via-violet-950 to-blue-950 px-6 py-5 text-white">
                <div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Personnel Archive Control</p><h2 className="mt-1 text-2xl font-black">{action === "archive" ? "Archive Personnel File" : "Restore Personnel File"}</h2></div>
                <button type="button" onClick={() => setSelectedFile(null)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white hover:bg-white/25"><Icon name="close" /></button>
              </div>
              <div className="grid gap-5 p-6 sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-950">{selectedFile.file_no}</p><p className="mt-1 text-sm font-semibold text-slate-500">{profileMap.get(selectedFile.staff_id)?.full_name || "Unknown Staff"}</p></div>
                <label><span className="text-sm font-black text-slate-800">Archive Reference {action === "archive" ? "*" : ""}</span><input value={archiveReference} onChange={(event) => setArchiveReference(event.target.value)} disabled={action === "restore"} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" placeholder="HR/ARC/2026/0001" /></label>
                <label><span className="text-sm font-black text-slate-800">Destination Location</span><input value={archiveLocation} onChange={(event) => setArchiveLocation(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
                <label className="sm:col-span-2"><span className="text-sm font-black text-slate-800">Reason / Retention Basis</span><textarea value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Retirement, completed employment cycle, closed personnel action…" /></label>
                <label><span className="text-sm font-black text-slate-800">Retention Review Date</span><span className="mt-2 flex min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3"><input type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} className="block w-full min-w-0 border-0 bg-transparent p-0 font-semibold outline-none" /></span></label>
                <label><span className="text-sm font-black text-slate-800">Movement Remarks</span><input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Optional control note" /></label>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 p-6 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setSelectedFile(null)} className="reqgen-btn reqgen-btn-slate rounded-xl bg-slate-700 px-5 py-3 font-black text-white shadow-md hover:bg-slate-800">Cancel</button>
                <button disabled={saving} className={`reqgen-btn inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-black text-white shadow-lg disabled:opacity-60 ${action === "archive" ? "reqgen-btn-violet bg-violet-700 hover:bg-violet-800" : "reqgen-btn-emerald bg-emerald-600 hover:bg-emerald-700"}`}><Icon name={action === "archive" ? "archive" : "restore"} />{saving ? "Processing…" : action === "archive" ? "Confirm Archive" : "Confirm Restore"}</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </HRAccessGuard>
  );
}
