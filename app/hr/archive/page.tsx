"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, CalendarClock, FileWarning, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
import { HRAlert, HRBadge, HREmpty, HRHero, HRPageShell, HRPanel, HRRefreshButton, HRStatCard, formatDate } from "@/app/components/hr/HREnterprisePage";

type FileRow = { id: string; staff_id: string; file_no: string; retention_status: string; archive_reference: string | null; archive_reason: string | null; retention_review_at: string | null; archived_at: string | null; restored_at: string | null; current_location: string; updated_at: string };
type Profile = { id: string; full_name: string | null; email: string | null };

export default function HRArchivePage() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [fileResult, profileResult] = await Promise.all([
      supabase.from("hr_staff_files").select("id,staff_id,file_no,retention_status,archive_reference,archive_reason,retention_review_at,archived_at,restored_at,current_location,updated_at").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,email").order("full_name"),
    ]);
    setFiles((fileResult.data || []) as FileRow[]);
    setProfiles((profileResult.data || []) as Profile[]);
    setMessage(fileResult.error?.message || profileResult.error?.message || "");
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const rows = useMemo(() => files.filter((file) => {
    const profile = profileMap.get(file.staff_id);
    const text = [file.file_no, profile?.full_name, profile?.email, file.archive_reference, file.archive_reason, file.current_location].filter(Boolean).join(" ").toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (status === "all" || file.retention_status === status);
  }), [files, profileMap, search, status]);

  return (
    <HRAccessGuard section="archive" permission="view">
      <HRPageShell>
        <HRHero eyebrow="Records Preservation & Retention" title="HR Archive Governance Centre" description="Institutional custody of archived personnel records, archive references, legal or management holds, scheduled retention reviews and restoration history." icon={Archive} tone="violet" action={<HRRefreshButton onClick={() => void load()} loading={loading} />} />
        <HRNavigation />
        {message ? <HRAlert message={message} /> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HRStatCard label="Archived Files" value={files.filter((file) => file.retention_status === "archived").length} note="Records in controlled archive custody" icon={Archive} tone="violet" />
          <HRStatCard label="Archive Ready" value={files.filter((file) => file.retention_status === "archive_ready").length} note="Files awaiting approved archive transfer" icon={CalendarClock} tone="amber" />
          <HRStatCard label="On Hold" value={files.filter((file) => file.retention_status === "hold").length} note="Records protected from disposal or movement" icon={ShieldCheck} tone="rose" />
          <HRStatCard label="Restored" value={files.filter((file) => Boolean(file.restored_at)).length} note="Records retrieved from archive custody" icon={ArchiveRestore} tone="emerald" />
        </section>
        <HRPanel title="Archive & Retention Register" eyebrow="Controlled Records Lifecycle" action={<div className="grid gap-2 sm:grid-cols-2"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search archive records..." className="min-h-11 rounded-xl border border-slate-200 pl-10 pr-4 text-sm font-semibold" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold"><option value="all">All retention states</option><option value="active">Active</option><option value="archive_ready">Archive Ready</option><option value="archived">Archived</option><option value="hold">Hold</option></select></div>}>
          {loading ? <p className="py-12 text-center font-bold text-slate-500">Loading archive register...</p> : rows.length === 0 ? <HREmpty title="No archive record matches the current view" /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((file) => { const profile = profileMap.get(file.staff_id); return <article key={file.id} className="rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-violet-700">{file.file_no}</p><h3 className="mt-2 text-lg font-black text-slate-950">{profile?.full_name || profile?.email || "Unnamed staff"}</h3></div><HRBadge value={file.retention_status} tone={file.retention_status === "archived" ? "violet" : file.retention_status === "hold" ? "rose" : "amber"} /></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="font-black text-slate-500">Archive Reference</dt><dd className="mt-1 font-semibold">{file.archive_reference || "Not assigned"}</dd></div><div><dt className="font-black text-slate-500">Review Date</dt><dd className="mt-1 font-semibold">{formatDate(file.retention_review_at)}</dd></div><div><dt className="font-black text-slate-500">Current Location</dt><dd className="mt-1 font-semibold">{file.current_location || "—"}</dd></div><div><dt className="font-black text-slate-500">Last Updated</dt><dd className="mt-1 font-semibold">{formatDate(file.updated_at)}</dd></div></dl>{file.archive_reason ? <p className="mt-4 rounded-xl border border-violet-100 bg-white p-3 text-sm font-semibold text-slate-600"><strong>Reason:</strong> {file.archive_reason}</p> : null}<div className="mt-4 flex gap-2"><Link href="/hr/registrar" className="flex-1 rounded-xl bg-violet-700 px-4 py-2.5 text-center text-sm font-black text-white">Manage Custody</Link>{file.retention_status === "hold" ? <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-100 text-rose-700" title="Protected hold"><FileWarning className="h-5 w-5" /></span> : null}</div></article>; })}
            </div>
          )}
        </HRPanel>
      </HRPageShell>
    </HRAccessGuard>
  );
}
