"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  dept_id: string | null;
  signature_url: string | null;
};

type Department = {
  id: string;
  name: string;
};

type LeaveType =
  | "Annual Leave"
  | "Casual Leave"
  | "Sick Leave"
  | "Study Leave"
  | "Maternity Leave"
  | "Paternity Leave"
  | "Compassionate Leave"
  | "Other Leave";

const LEAVE_TYPES: LeaveType[] = [
  "Annual Leave",
  "Casual Leave",
  "Sick Leave",
  "Study Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Compassionate Leave",
  "Other Leave",
];

function buildRequestNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const suffix = String(now.getTime()).slice(-6);
  return `REQ-${year}${month}-${suffix}`;
}

function calculateDays(start: string, end: string) {
  if (!start || !end) return 0;
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default function NewLeaveApplicationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [leaveType, setLeaveType] = useState<LeaveType>("Annual Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [handoverOfficer, setHandoverOfficer] = useState("");
  const [contactDuringLeave, setContactDuringLeave] = useState("");
  const [supportingStatus, setSupportingStatus] = useState("Not Required");
  const [declaration, setDeclaration] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const duration = useMemo(() => calculateDays(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      setLoading(true);
      setMessage(null);

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (sessionError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id,full_name,email,phone,role,dept_id,signature_url")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        if (profileError || !profileData) {
          setMessage("Your staff profile could not be loaded. Please contact the Administrator.");
          return;
        }

        const staffProfile = profileData as Profile;
        setProfile(staffProfile);
        setContactDuringLeave(staffProfile.phone || "");

        if (staffProfile.dept_id) {
          const { data: departmentData } = await supabase
            .from("departments")
            .select("id,name")
            .eq("id", staffProfile.dept_id)
            .maybeSingle();

          if (active && departmentData) setDepartment(departmentData as Department);
        }
      } catch (error) {
        console.error("Unable to load leave application identity:", error);
        if (active) setMessage("The leave application form could not be prepared at this time.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadIdentity();
    return () => {
      active = false;
    };
  }, [router]);

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!profile) {
      setMessage("Your staff profile is not available.");
      return;
    }

    if (!profile.dept_id) {
      setMessage("A department must be assigned to your profile before applying for leave.");
      return;
    }

    if (!profile.full_name?.trim()) {
      setMessage("Your full name is missing from your profile.");
      return;
    }

    if (!startDate || !endDate || duration < 1) {
      setMessage("Select a valid start date and end date.");
      return;
    }

    if (reason.trim().length < 10) {
      setMessage("Please provide a clear reason of at least 10 characters.");
      return;
    }

    if (!declaration) {
      setMessage("Confirm the declaration before submitting your application.");
      return;
    }

    setSaving(true);

    try {
      const requestNo = buildRequestNo();
      const title = `${leaveType} Application`;
      const details = [
        `Leave Type: ${leaveType}`,
        `Start Date: ${formatDate(startDate)}`,
        `End Date: ${formatDate(endDate)}`,
        `Duration: ${duration} day(s)`,
        `Reason: ${reason.trim()}`,
        `Handover Officer: ${handoverOfficer.trim() || "Not specified"}`,
        `Contact During Leave: ${contactDuringLeave.trim() || "Not specified"}`,
        `Supporting Documents: ${supportingStatus}`,
      ].join("\n");

      const { data, error } = await supabase.rpc("submit_request_with_reservation", {
        p_title: title,
        p_details: details,
        p_amount: 0,
        p_dept_id: profile.dept_id,
        p_subhead_id: null,
        p_request_type: "Personal",
        p_personal_category: "Leave",
        p_created_by: profile.id,
        p_requester_name: profile.full_name.trim(),
        p_requester_signature: profile.signature_url,
        p_request_no: requestNo,
      });

      if (error) throw new Error(error.message);

      const result = Array.isArray(data) ? data[0] : data;
      const requestId = (result as { request_id?: string } | null)?.request_id;

      if (!requestId) throw new Error("The request was created but no request ID was returned.");

      // Leave metadata supports the HR Leave Management Centre. Failure here does not
      // cancel the underlying personal request because some deployments may not yet
      // have the optional Phase 8B leave metadata table.
      const { error: metadataError } = await supabase.from("hr_leave_records").insert({
        request_id: requestId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        duration_days: duration,
        supporting_documents_status: supportingStatus,
        hr_status: "pending_hr_review",
        filing_status: "open",
      });

      if (metadataError) {
        console.warn("Leave request submitted without optional metadata:", metadataError.message);
      }

      setMessage("Leave application submitted successfully. Redirecting to your request record…");

      setTimeout(() => {
        router.push(`/requests/${requestId}`);
        router.refresh();
      }, 700);
    } catch (error) {
      console.error("Unable to submit leave application:", error);
      setMessage(error instanceof Error ? error.message : "The leave application could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto flex max-w-5xl items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 shadow-sm">
          <Loader2 className="mr-3 h-6 w-6 animate-spin text-cyan-700" />
          <span className="font-black text-slate-700">Preparing leave application…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-cyan-900 p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Staff Self-Service</p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">New Leave Application</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/80 sm:text-base">
                Submit an official personal leave request for routing through the approved ReqGen workflow.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/staff/leave" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-black text-white ring-1 ring-white/20 transition hover:bg-white/20">
                <ArrowLeft className="h-4 w-4" /> My Leave
              </Link>
              <Link href="/staff" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:bg-cyan-400">
                Staff Homepage
              </Link>
            </div>
          </div>
        </section>

        {message && (
          <div className={`rounded-2xl border p-4 text-sm font-bold ${message.toLowerCase().includes("success") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 p-5 text-white shadow-lg">
            <UserRound className="h-7 w-7" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/75">Applicant</p>
            <p className="mt-1 text-lg font-black">{profile?.full_name || "Staff Member"}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white shadow-lg">
            <ShieldCheck className="h-7 w-7" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/75">Department</p>
            <p className="mt-1 text-lg font-black">{department?.name || "Not assigned"}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-lg">
            <CalendarDays className="h-7 w-7" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/75">Requested Duration</p>
            <p className="mt-1 text-lg font-black">{duration || 0} day(s)</p>
          </div>
        </section>

        <form onSubmit={submitApplication} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Application Details</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Leave Information</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-black text-slate-700">Leave Type</span>
              <select value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
                {LEAVE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-700">Supporting Documents</span>
              <select value={supportingStatus} onChange={(event) => setSupportingStatus(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
                <option>Not Required</option>
                <option>Available</option>
                <option>To Be Submitted</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-700">Start Date</span>
              <input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-700">End Date</span>
              <input type="date" required min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-700">Handover Officer</span>
              <input value={handoverOfficer} onChange={(event) => setHandoverOfficer(event.target.value)} placeholder="Name of officer handling your duties" className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-700">Contact During Leave</span>
              <input value={contactDuringLeave} onChange={(event) => setContactDuringLeave(event.target.value)} placeholder="Phone number or email" className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-black text-slate-700">Reason for Leave</span>
            <textarea required rows={6} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the reason for the leave application and any relevant handover information." className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
          </label>

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <div className="flex gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
              <div>
                <p className="font-black text-cyan-950">Workflow Notice</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-cyan-900/80">
                  This application is submitted as a Personal Leave request. It will follow the approved ReqGen workflow and become available to authorized HR officers for review.
                </p>
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input type="checkbox" checked={declaration} onChange={(event) => setDeclaration(event.target.checked)} className="mt-1 h-5 w-5 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500" />
            <span className="text-sm font-semibold leading-6 text-slate-700">
              I confirm that the information supplied is accurate and that appropriate arrangements will be made for my official responsibilities during the requested leave period.
            </span>
          </label>

          {!profile?.signature_url && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              Your profile does not currently have a saved signature. The request may require a signature before final submission. <Link href="/profile" className="underline">Update Profile</Link>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <Link href="/staff/leave" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-700 px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-slate-800">
              Cancel
            </Link>
            <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {saving ? "Submitting…" : "Submit Leave Application"}
            </button>
          </div>
        </form>

        <section className="rounded-3xl bg-gradient-to-r from-emerald-700 to-cyan-700 p-5 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <h2 className="text-lg font-black">Before You Submit</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-white/85">
                Confirm the dates, duration, handover arrangements and your contact details. After submission, track progress from My Leave or My Requests.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
