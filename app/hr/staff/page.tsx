"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  FileSearch,
  FolderOpen,
  MapPin,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
import {
  HRAlert,
  HRBadge,
  HREmpty,
  HRHero,
  HRPageShell,
  HRPanel,
  HRRefreshButton,
  HRStatCard,
  formatDate,
  pretty,
} from "@/app/components/hr/HREnterprisePage";

type FileRow = {
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
  updated_at: string;
};
type Profile = { id: string; full_name: string | null; email: string | null; dept_id: string | null };
type Department = { id: string; name: string | null };

export default function HRStaffPage() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [custody, setCustody] = useState("all");
  const [retention, setRetention] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [fileResult, profileResult, departmentResult] = await Promise.all([
      supabase.from("hr_staff_files").select("id,staff_id,department_id,file_no,employment_status,custody_status,current_location,completeness_score,missing_documents,classification,retention_status,updated_at").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,email,dept_id").order("full_name"),
      supabase.from("departments").select("id,name").order("name"),
    ]);
    setFiles((fileResult.data || []) as FileRow[]);
    setProfiles((profileResult.data || []) as Profile[]);
    setDepartments((departmentResult.data || []) as Department[]);
    setMessage(fileResult.error?.message || profileResult.error?.message || departmentResult.error?.message || "");
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const departmentMap = useMemo(() => new Map(departments.map((department) => [department.id, department.name || "Unnamed Department"])), [departments]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return files.filter((file) => {
      const profile = profileMap.get(file.staff_id);
      const text = [file.file_no, profile?.full_name, profile?.email, departmentMap.get(file.department_id || ""), file.current_location, file.custody_status, file.retention_status].filter(Boolean).join(" ").toLowerCase();
      return (!needle || text.includes(needle)) && (custody === "all" || file.custody_status === custody) && (retention === "all" || file.retention_status === retention);
    });
  }, [files, profileMap, departmentMap, search, custody, retention]);

  const incomplete = files.filter((file) => Number(file.completeness_score || 0) < 80).length;
  const missing = files.filter((file) => file.custody_status === "missing").length;
  const archiveReady = files.filter((file) => file.retention_status === "archive_ready").length;

  return (
    <HRAccessGuard section="staff_filing" permission="view">
      <HRPageShell>
        <HRHero
          eyebrow="Personnel Records"
          title="Staff Files & Records Intelligence"
          description="A complete ERP view of personnel-file registration, document completeness, custody, classification, retention status and current physical location."
          icon={FolderOpen}
          tone="blue"
          action={<HRRefreshButton onClick={() => void load()} loading={loading} />}
        />
        <HRNavigation />
        {message ? <HRAlert message={message} /> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HRStatCard label="Registered Files" value={files.length} note="Personnel files under HR control" icon={UsersRound} tone="blue" />
          <HRStatCard label="Complete Files" value={files.length - incomplete} note="Records at or above 80% completeness" icon={UserRoundCheck} tone="emerald" />
          <HRStatCard label="Incomplete" value={incomplete} note="Files requiring supporting documents" icon={AlertTriangle} tone="amber" />
          <HRStatCard label="Archive Ready" value={archiveReady} note={`${missing} file(s) currently marked missing`} icon={Archive} tone={missing ? "rose" : "violet"} />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/hr/registrar" className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-600 to-blue-800 p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
            <MapPin className="h-8 w-8" /><h3 className="mt-4 text-xl font-black">Registrar Centre</h3><p className="mt-2 text-sm font-semibold text-white/80">Control custody, checkout, return, transfer and missing-file actions.</p>
          </Link>
          <Link href="/hr/archive" className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-600 to-purple-800 p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
            <Archive className="h-8 w-8" /><h3 className="mt-4 text-xl font-black">Archive Centre</h3><p className="mt-2 text-sm font-semibold text-white/80">Manage retention, archive references, legal holds and restoration.</p>
          </Link>
          <Link href="/hr/audit" className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-700 to-slate-950 p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
            <ShieldCheck className="h-8 w-8" /><h3 className="mt-4 text-xl font-black">Records Audit</h3><p className="mt-2 text-sm font-semibold text-white/80">Review who changed, moved, archived or restored each personnel record.</p>
          </Link>
        </section>

        <HRPanel
          title="Personnel File Register"
          eyebrow="Live Records Control"
          action={<div className="grid gap-2 sm:grid-cols-3"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff, file or location..." className="min-h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm font-semibold" /></div><select value={custody} onChange={(event) => setCustody(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold"><option value="all">All custody</option><option value="in_registry">In Registry</option><option value="checked_out">Checked Out</option><option value="with_hr_boss">With HR Boss</option><option value="with_hr_officer">With HR Officer</option><option value="in_archive">In Archive</option><option value="missing">Missing</option></select><select value={retention} onChange={(event) => setRetention(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold"><option value="all">All retention</option><option value="active">Active</option><option value="archive_ready">Archive Ready</option><option value="archived">Archived</option><option value="hold">Hold</option></select></div>}
        >
          {loading ? <p className="py-12 text-center font-bold text-slate-500">Loading personnel files...</p> : rows.length === 0 ? <HREmpty title="No staff files found" /> : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white"><tr><th className="p-4">Staff File</th><th className="p-4">Department</th><th className="p-4">Custody</th><th className="p-4">Completeness</th><th className="p-4">Retention</th><th className="p-4">Updated</th><th className="p-4">Action</th></tr></thead>
                  <tbody>{rows.map((file) => { const profile = profileMap.get(file.staff_id); return <tr key={file.id} className="border-t align-top hover:bg-blue-50/50"><td className="p-4"><p className="font-black text-slate-950">{profile?.full_name || profile?.email || "Unnamed staff"}</p><p className="mt-1 font-bold text-blue-700">{file.file_no}</p></td><td className="p-4 font-semibold">{departmentMap.get(file.department_id || "") || "Unassigned"}</td><td className="p-4"><HRBadge value={file.custody_status} tone={file.custody_status === "missing" ? "rose" : file.custody_status === "in_registry" ? "emerald" : "blue"} /><p className="mt-2 text-xs font-semibold text-slate-500">{file.current_location || "—"}</p></td><td className="p-4"><div className="flex items-center gap-3"><div className="h-2.5 w-24 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${file.completeness_score >= 80 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.max(0, Math.min(100, file.completeness_score || 0))}%` }} /></div><strong>{file.completeness_score || 0}%</strong></div>{file.missing_documents?.length ? <p className="mt-2 max-w-xs text-xs font-semibold text-rose-700">Missing: {file.missing_documents.join(", ")}</p> : null}</td><td className="p-4"><HRBadge value={file.retention_status} tone={file.retention_status === "archived" ? "violet" : file.retention_status === "hold" ? "rose" : "amber"} /></td><td className="p-4">{formatDate(file.updated_at)}</td><td className="p-4"><Link href="/hr/registrar" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white"><FileSearch className="h-4 w-4" />Manage File</Link></td></tr>; })}</tbody>
                </table>
              </div>
              <div className="grid gap-4 lg:hidden">
                {rows.map((file) => { const profile = profileMap.get(file.staff_id); return <article key={file.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">{profile?.full_name || profile?.email || "Unnamed staff"}</h3><p className="mt-1 font-bold text-blue-700">{file.file_no}</p></div><HRBadge value={file.custody_status} tone={file.custody_status === "missing" ? "rose" : "blue"} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="font-black text-slate-500">Department</dt><dd className="mt-1 font-semibold">{departmentMap.get(file.department_id || "") || "Unassigned"}</dd></div><div><dt className="font-black text-slate-500">Completeness</dt><dd className="mt-1 font-semibold">{file.completeness_score || 0}%</dd></div><div><dt className="font-black text-slate-500">Retention</dt><dd className="mt-1">{pretty(file.retention_status)}</dd></div><div><dt className="font-black text-slate-500">Location</dt><dd className="mt-1">{file.current_location || "—"}</dd></div></dl><Link href="/hr/registrar" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white"><FileSearch className="h-4 w-4" />Open Registrar Control</Link></article>; })}
              </div>
            </>
          )}
        </HRPanel>
      </HRPageShell>
    </HRAccessGuard>
  );
}
