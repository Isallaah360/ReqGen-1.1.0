"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, FileCheck, FileText, FolderOpen, Search } from "lucide-react";
import StaffNavigation from "@/app/components/staff/StaffNavigation";
import { StaffAction, StaffEmpty, StaffHero, StaffSection, StaffShell, StaffStat } from "@/app/components/staff/StaffUI";
import { useStaffWorkspace } from "@/app/components/staff/useStaffWorkspace";
import { dateText, text, type GenericRow } from "@/app/components/enterprise/data";

type DownloadRecord = {
  id: string;
  title: string;
  category: string;
  date: string;
  href: string;
  action: string;
};

const printableStatuses = ["approved", "completed", "paid", "filed", "closed"];

function isPrintableRequest(row: GenericRow) {
  const status = text(row.status).toLowerCase();
  return printableStatuses.some((item) => status.includes(item));
}

export default function DownloadsPage() {
  const { profile, requests, leave, training, loading, warning } = useStaffWorkspace();
  const [search, setSearch] = useState("");

  const records = useMemo<DownloadRecord[]>(() => {
    const requestDocs = requests.filter(isPrintableRequest).map((row, index) => ({
      id: `request-${text(row.id) || index}`,
      title: `${text(row.request_no, "Request")} — ${text(row.title, "Approved Request")}`,
      category: "Approved Request",
      date: dateText(row.updated_at || row.created_at),
      href: text(row.id) ? `/requests/${text(row.id)}/print` : "/staff/requests",
      action: "Open Printout",
    }));

    const leaveDocs = leave
      .filter((row) => printableStatuses.some((item) => text(row.status).toLowerCase().includes(item)))
      .map((row, index) => ({
        id: `leave-${text(row.id) || index}`,
        title: `${text(row.leave_type, "Leave")} Approval Record`,
        category: "Leave",
        date: dateText(row.approved_at || row.updated_at || row.created_at),
        href: text(row.document_url) || text(row.letter_url) || "/staff/leave",
        action: text(row.document_url) || text(row.letter_url) ? "Download Letter" : "Open Leave Record",
      }));

    const trainingDocs = training.map((row, index) => {
      const directUrl = text(row.certificate_url) || text(row.evidence_url) || text(row.document_url);
      return {
        id: `training-${text(row.id) || index}`,
        title: `${text(row.programme_title || row.title, "Training Programme")} Certificate`,
        category: "Training",
        date: dateText(row.completed_at || row.updated_at || row.created_at),
        href: directUrl || "/staff/training",
        action: directUrl ? "Download Certificate" : "Open Training Record",
      };
    });

    return [...requestDocs, ...leaveDocs, ...trainingDocs];
  }, [leave, requests, training]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((row) => `${row.title} ${row.category}`.toLowerCase().includes(query));
  }, [records, search]);

  return (
    <StaffShell>
      <div className="space-y-6">
        <StaffHero
          name={profile?.fullName || "Staff Member"}
          designation="My Downloads"
          description="Access approved requests, leave documents and training records available to your account."
          actions={
            <>
              <StaffAction href="/staff" tone="slate">Staff Home</StaffAction>
              <StaffAction href="/output" tone="cyan">Print Centre</StaffAction>
            </>
          }
        />

        <StaffNavigation />

        {warning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StaffStat label="Available" value={loading ? "—" : records.length} note="Documents ready to open" tone="blue" />
          <StaffStat label="Requests" value={loading ? "—" : records.filter((row) => row.category === "Approved Request").length} note="Approved request printouts" tone="cyan" />
          <StaffStat label="Leave" value={loading ? "—" : records.filter((row) => row.category === "Leave").length} note="Leave documents" tone="violet" />
          <StaffStat label="Training" value={loading ? "—" : records.filter((row) => row.category === "Training").length} note="Certificates and records" tone="emerald" />
        </section>

        <StaffSection title="Available Documents" eyebrow="Personal Document Library">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your documents..."
                className="w-full rounded-xl border-2 border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-bold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800">
              <FolderOpen className="h-5 w-5" />
              {filtered.length} matching record{filtered.length === 1 ? "" : "s"}
            </div>
          </div>

          {filtered.length === 0 ? (
            <StaffEmpty
              title={loading ? "Loading documents" : "No matching document"}
              description={loading ? "Please wait while ReqGen checks your personal records." : "Approved requests and available HR documents will appear here."}
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filtered.map((record) => {
                const external = /^https?:\/\//i.test(record.href);
                return (
                  <article key={record.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-700 to-cyan-500 text-white shadow-sm">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="break-words font-black text-slate-950">{record.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">{record.category}</span>
                          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">{record.date}</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={record.href}
                      target={external || record.href.includes("/print") ? "_blank" : undefined}
                      rel={external ? "noreferrer" : undefined}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-500 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <Download className="h-4 w-4" />
                      {record.action}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </StaffSection>

        <section className="rounded-[1.75rem] bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-800 p-5 text-white shadow-xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">Official IET Document Access</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-cyan-50">
                Download controls open only records available to your authenticated account. Approved Request printouts continue to use the protected original IET Request template.
              </p>
            </div>
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
