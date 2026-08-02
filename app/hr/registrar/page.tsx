"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
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
  missing_documents: string[] | null;
  classification: string;
  retention_status: string;
  notes: string | null;
  last_reviewed_at: string | null;
  archived_at: string | null;
  is_active: boolean;
  updated_at: string;
};

type Movement = {
  id: string;
  staff_file_id: string;
  movement_type: string;
  from_location: string | null;
  to_location: string | null;
  purpose: string | null;
  expected_return_at: string | null;
  returned_at: string | null;
  remarks: string | null;
  created_at: string;
};

type Profile = { id: string; full_name: string | null; email: string | null };
type Department = { id: string; name: string | null };

type MovementType =
  | "checked_out"
  | "returned"
  | "transferred"
  | "archived"
  | "restored"
  | "marked_missing"
  | "located"
  | "reviewed";

const MOVEMENT_OPTIONS: Array<{ value: MovementType; label: string }> = [
  { value: "checked_out", label: "Check Out File" },
  { value: "returned", label: "Return to Registry" },
  { value: "transferred", label: "Transfer Custody" },
  { value: "archived", label: "Transfer to Archive" },
  { value: "restored", label: "Restore from Archive" },
  { value: "marked_missing", label: "Mark as Missing" },
  { value: "located", label: "Mark as Located" },
  { value: "reviewed", label: "Record File Review" },
];

function pretty(value: string | null | undefined) {
  return (value || "Not set")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function custodyClasses(status: string) {
  switch (status) {
    case "in_registry":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "checked_out":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "with_hr_boss":
    case "with_hr_officer":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "in_archive":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "missing":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function retentionClasses(status: string) {
  switch (status) {
    case "archive_ready":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "archived":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "hold":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
}

function MetricCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number | string;
  note: string;
  tone: "blue" | "cyan" | "amber" | "violet" | "rose" | "emerald";
}) {
  const styles = {
    blue: "from-blue-700 to-blue-950",
    cyan: "from-cyan-600 to-blue-800",
    amber: "from-amber-500 to-orange-700",
    violet: "from-violet-600 to-indigo-900",
    rose: "from-rose-600 to-red-800",
    emerald: "from-emerald-600 to-teal-800",
  }[tone];

  return (
    <article className={`rounded-3xl bg-gradient-to-br ${styles} p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/75">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm font-semibold text-white/80">{note}</p>
    </article>
  );
}

export default function RegistrarPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [files, setFiles] = useState<StaffFile[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [departments, setDepartments] = useState<Record<string, Department>>({});
  const [search, setSearch] = useState("");
  const [custodyFilter, setCustodyFilter] = useState("all");
  const [retentionFilter, setRetentionFilter] = useState("all");
  const [selectedFile, setSelectedFile] = useState<StaffFile | null>(null);
  const [movementType, setMovementType] = useState<MovementType>("checked_out");
  const [toLocation, setToLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [remarks, setRemarks] = useState("");

  const loadData = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const [filesResult, movementsResult] = await Promise.all([
        supabase
          .from("hr_staff_files")
          .select(
            "id,staff_id,department_id,file_no,employment_status,custody_status,current_location,completeness_score,missing_documents,classification,retention_status,notes,last_reviewed_at,archived_at,is_active,updated_at"
          )
          .eq("is_active", true)
          .order("updated_at", { ascending: false }),
        supabase
          .from("hr_staff_file_movements")
          .select(
            "id,staff_file_id,movement_type,from_location,to_location,purpose,expected_return_at,returned_at,remarks,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (filesResult.error) throw filesResult.error;
      if (movementsResult.error) throw movementsResult.error;

      const fileRows = (filesResult.data || []) as StaffFile[];
      const profileIds = [...new Set(fileRows.map((item) => item.staff_id).filter(Boolean))];
      const departmentIds = [
        ...new Set(fileRows.map((item) => item.department_id).filter(Boolean) as string[]),
      ];

      const [profilesResult, departmentsResult] = await Promise.all([
        profileIds.length
          ? supabase.from("profiles").select("id,full_name,email").in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
        departmentIds.length
          ? supabase.from("departments").select("id,name").in("id", departmentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (departmentsResult.error) throw departmentsResult.error;

      const profileMap: Record<string, Profile> = {};
      ((profilesResult.data || []) as Profile[]).forEach((item) => {
        profileMap[item.id] = item;
      });

      const departmentMap: Record<string, Department> = {};
      ((departmentsResult.data || []) as Department[]).forEach((item) => {
        departmentMap[item.id] = item;
      });

      setFiles(fileRows);
      setMovements((movementsResult.data || []) as Movement[]);
      setProfiles(profileMap);
      setDepartments(departmentMap);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the Registrar Centre. Confirm that the Staff Files migration has been applied."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("hr-registrar-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hr_staff_files" },
        () => loadData(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hr_staff_file_movements" },
        () => loadData(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return files.filter((file) => {
      const profile = profiles[file.staff_id];
      const department = file.department_id ? departments[file.department_id] : undefined;
      const matchesSearch =
        !query ||
        file.file_no.toLowerCase().includes(query) ||
        (profile?.full_name || "").toLowerCase().includes(query) ||
        (profile?.email || "").toLowerCase().includes(query) ||
        (department?.name || "").toLowerCase().includes(query) ||
        file.current_location.toLowerCase().includes(query);
      const matchesCustody = custodyFilter === "all" || file.custody_status === custodyFilter;
      const matchesRetention =
        retentionFilter === "all" || file.retention_status === retentionFilter;
      return matchesSearch && matchesCustody && matchesRetention;
    });
  }, [custodyFilter, departments, files, profiles, retentionFilter, search]);

  const counts = useMemo(
    () => ({
      total: files.length,
      inRegistry: files.filter((item) => item.custody_status === "in_registry").length,
      checkedOut: files.filter((item) => item.custody_status === "checked_out").length,
      outstanding: files.filter(
        (item) => ["checked_out", "with_hr_boss", "with_hr_officer"].includes(item.custody_status)
      ).length,
      missing: files.filter((item) => item.custody_status === "missing").length,
      archiveReady: files.filter((item) => item.retention_status === "archive_ready").length,
      incomplete: files.filter((item) => item.completeness_score < 100).length,
      archived: files.filter((item) => item.retention_status === "archived").length,
    }),
    [files]
  );

  function openMovement(file: StaffFile, type: MovementType) {
    setSelectedFile(file);
    setMovementType(type);
    setToLocation(
      type === "returned" || type === "located" || type === "restored"
        ? "HR Registry"
        : type === "archived"
          ? "HR Archive"
          : file.current_location
    );
    setPurpose("");
    setExpectedReturnAt("");
    setRemarks("");
    setError(null);
    setSuccess(null);
  }

  function closeMovement() {
    if (saving) return;
    setSelectedFile(null);
  }

  async function submitMovement(event: FormEvent) {
    event.preventDefault();
    if (!selectedFile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!toLocation.trim()) throw new Error("Enter the destination or current location.");
      const { error: rpcError } = await supabase.rpc("hr_move_staff_file", {
        p_staff_file_id: selectedFile.id,
        p_movement_type: movementType,
        p_to_location: toLocation.trim(),
        p_purpose: purpose.trim() || null,
        p_received_by: null,
        p_expected_return_at: expectedReturnAt || null,
        p_remarks: remarks.trim() || null,
      });
      if (rpcError) throw rpcError;

      setSuccess(`${selectedFile.file_no} updated successfully.`);
      setSelectedFile(null);
      await loadData(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record the file movement.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <HRAccessGuard section="registrar">
        <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
          <div className="mx-auto max-w-7xl animate-pulse space-y-6 blur-[0.2px]">
            <div className="h-44 rounded-[2rem] bg-slate-200" />
            <div className="h-28 rounded-[1.6rem] bg-slate-200" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-32 rounded-3xl bg-slate-200" />
              ))}
            </div>
            <div className="h-96 rounded-3xl bg-slate-200" />
          </div>
        </main>
      </HRAccessGuard>
    );
  }

  return (
    <HRAccessGuard section="registrar">
      <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-700 p-7 text-white shadow-xl sm:p-9">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                  Controlled Personnel Records
                </p>
                <h1 className="mt-3 text-3xl font-black sm:text-4xl">Registrar Centre</h1>
                <p className="mt-3 max-w-3xl font-semibold leading-7 text-blue-100">
                  Manage personnel-file custody, classification, movement, completeness, archive readiness and institutional accountability from one secured workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/hr/staff" className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-800">Staff Files</Link>
                <Link href="/hr/archive" className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-700">HR Archive</Link>
                <Link href="/hr/audit" className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800">Audit Evidence</Link>
                <button
                  type="button"
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? "Refreshing…" : "Refresh Registry"}
                </button>
              </div>
            </div>
          </section>

          <HRNavigation />

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              {success}
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Registered Files" value={counts.total} note="Active personnel files" tone="blue" />
            <MetricCard label="In Registry" value={counts.inRegistry} note="Currently under Registry custody" tone="emerald" />
            <MetricCard label="Checked Out" value={counts.checkedOut} note="Files issued temporarily" tone="amber" />
            <MetricCard label="Outstanding" value={counts.outstanding} note="Files outside Registry custody" tone="cyan" />
            <MetricCard label="Missing Files" value={counts.missing} note="Require immediate follow-up" tone="rose" />
            <MetricCard label="Archive Ready" value={counts.archiveReady} note="Eligible for controlled archive" tone="violet" />
            <MetricCard label="Incomplete Files" value={counts.incomplete} note="Missing required documents" tone="amber" />
            <MetricCard label="Archived" value={counts.archived} note="Transferred to HR Archive" tone="violet" />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Personnel File Register</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Custody & Classification Control</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Search by staff name, file number, department or location, then apply movement controls to the selected record.
                </p>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">Search</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Name, file no., department..."
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">Custody</span>
                  <select
                    value={custodyFilter}
                    onChange={(event) => setCustodyFilter(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="all">All custody states</option>
                    <option value="in_registry">In Registry</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="with_hr_boss">With HR Boss</option>
                    <option value="with_hr_officer">With HR Officer</option>
                    <option value="in_archive">In Archive</option>
                    <option value="missing">Missing</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">Retention</span>
                  <select
                    value={retentionFilter}
                    onChange={(event) => setRetentionFilter(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="all">All retention states</option>
                    <option value="active">Active</option>
                    <option value="archive_ready">Archive Ready</option>
                    <option value="archived">Archived</option>
                    <option value="hold">Hold</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-5 py-4 font-black">Staff File</th>
                    <th className="px-5 py-4 font-black">Department</th>
                    <th className="px-5 py-4 font-black">Custody</th>
                    <th className="px-5 py-4 font-black">Completeness</th>
                    <th className="px-5 py-4 font-black">Retention</th>
                    <th className="px-5 py-4 font-black">Updated</th>
                    <th className="px-5 py-4 text-right font-black">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFiles.map((file) => {
                    const profile = profiles[file.staff_id];
                    const department = file.department_id ? departments[file.department_id] : undefined;
                    return (
                      <tr key={file.id} className="align-top transition hover:bg-blue-50/50">
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-950">{profile?.full_name || "Unnamed staff"}</p>
                          <p className="mt-1 font-bold text-blue-700">{file.file_no}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{profile?.email || pretty(file.classification)}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-700">{department?.name || "Unassigned"}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${custodyClasses(file.custody_status)}`}>
                            {pretty(file.custody_status)}
                          </span>
                          <p className="mt-2 max-w-[220px] text-xs font-semibold text-slate-500">{file.current_location}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2.5 w-24 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${file.completeness_score}%` }} />
                            </div>
                            <span className="font-black text-slate-800">{file.completeness_score}%</span>
                          </div>
                          {!!file.missing_documents?.length && (
                            <p className="mt-2 text-xs font-bold text-amber-700">{file.missing_documents.length} missing document(s)</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${retentionClasses(file.retention_status)}`}>
                            {pretty(file.retention_status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-600">{formatDate(file.updated_at)}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openMovement(file, file.custody_status === "checked_out" ? "returned" : "checked_out")}
                              className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-blue-800"
                            >
                              {file.custody_status === "checked_out" ? "Return" : "Move File"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openMovement(file, file.custody_status === "missing" ? "located" : "marked_missing")}
                              className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-rose-800"
                            >
                              {file.custody_status === "missing" ? "Located" : "Missing"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredFiles.length && (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center">
                        <p className="text-lg font-black text-slate-800">No staff files match the current filters.</p>
                        <p className="mt-2 text-sm font-semibold text-slate-500">Register files in the Staff Files Centre or clear the filters.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Recent Movement History</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Registry Activity</h2>
                </div>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">Latest 100</span>
              </div>
              <div className="mt-5 space-y-3">
                {movements.slice(0, 10).map((movement) => {
                  const file = files.find((item) => item.id === movement.staff_file_id);
                  return (
                    <div key={movement.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900">{file?.file_no || "Staff file"}</p>
                          <p className="mt-1 text-sm font-bold text-blue-700">{pretty(movement.movement_type)}</p>
                        </div>
                        <span className="text-xs font-bold text-slate-500">{formatDate(movement.created_at)}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        {movement.from_location || "Unknown location"} → {movement.to_location || "Unknown location"}
                      </p>
                      {(movement.purpose || movement.remarks) && (
                        <p className="mt-2 text-xs font-semibold text-slate-500">{movement.purpose || movement.remarks}</p>
                      )}
                    </div>
                  );
                })}
                {!movements.length && <p className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">No file movement has been recorded yet.</p>}
              </div>
            </article>

            <article className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Registrar Control Notes</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Records Governance</h2>
              <div className="mt-5 space-y-3 text-sm font-semibold leading-6 text-slate-700">
                <p className="rounded-2xl bg-white/80 p-4 ring-1 ring-blue-100">Every checkout, transfer, archive action and missing-file declaration is written to the file movement register.</p>
                <p className="rounded-2xl bg-white/80 p-4 ring-1 ring-blue-100">Only Admin, HR Boss and officers with an active Registrar or Staff Filing assignment can manage personnel files.</p>
                <p className="rounded-2xl bg-white/80 p-4 ring-1 ring-blue-100">Completed employment records should be reviewed for retention status before transfer into the HR Archive.</p>
              </div>
            </article>
          </section>
        </div>

        {selectedFile && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <form onSubmit={submitMovement} className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">File Movement Control</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedFile.file_no}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Current location: {selectedFile.current_location}</p>
                </div>
                <button type="button" onClick={closeMovement} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-slate-800">Close</button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-black text-slate-800">Movement Type</span>
                  <select value={movementType} onChange={(event) => setMovementType(event.target.value as MovementType)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                    {MOVEMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-800">Destination / Current Location</span>
                  <input value={toLocation} onChange={(event) => setToLocation(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" required />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-black text-slate-800">Purpose</span>
                  <input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Reason for the movement" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-800">Expected Return</span>
                  <div className="mt-2 flex w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                    <input type="datetime-local" value={expectedReturnAt} onChange={(event) => setExpectedReturnAt(event.target.value)} className="block w-full min-w-0 border-0 bg-transparent p-0 font-semibold outline-none" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-800">Remarks</span>
                  <input value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional control note" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                </label>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeMovement} className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-black text-white shadow transition hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "Recording…" : "Record Movement"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </HRAccessGuard>
  );
}
