"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VoucherRow = {
  id: string;
  voucher_no: string;
  request_id: string;
  request_no: string | null;
  request_type: string | null;
  personal_category: string | null;
  payee_name: string | null;
  narration: string | null;
  amount: number | null;
  dept_name: string | null;
  subhead_code: string | null;
  subhead_name: string | null;
  prepared_by_name: string | null;
  checked_by_name: string | null;
  authorized_by_name: string | null;
  status: string | null;
  created_at: string;
};

type ReadyRequest = {
  id: string;
  request_no: string;
  title: string;
  details: string;
  amount: number | null;
  status: string | null;
  current_stage: string | null;
  created_at: string;
  request_type: string | null;
  personal_category: string | null;
  requester_name: string | null;
  dept_id: string | null;
  dept_name: string | null;
  subhead_id: string | null;
  subhead_code: string | null;
  subhead_name: string | null;
  account_name: string | null;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function normalize(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z]/g, "");
}

function naira(n: number | null | undefined) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function categoryLabel(v: { request_type: string | null; personal_category: string | null }) {
  const rt = normalize(v.request_type);
  const pc = normalize(v.personal_category);

  if (rt === "official") return "Official";
  if (rt === "personal" && pc === "fund") return "Personal Fund";
  if (rt === "personal" && pc === "nonfund") return "Personal NonFund";
  return v.request_type || "—";
}

function categoryBadgeClass(v: { request_type: string | null; personal_category: string | null }) {
  const rt = normalize(v.request_type);
  const pc = normalize(v.personal_category);

  if (rt === "official") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (rt === "personal" && pc === "fund") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusBadgeClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s.includes("paid")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (s.includes("cancel")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (s.includes("authorized") || s.includes("checked")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (s.includes("cheque") || s.includes("counter")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (s.includes("prepared")) {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  if (s.includes("complete")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function PaymentVouchersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState("Staff");
  const rk = roleKey(myRole);
  const canAccess = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);

  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [readyRows, setReadyRows] = useState<ReadyRequest[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profErr) {
      setMsg("Failed to load your profile: " + profErr.message);
      setLoading(false);
      return;
    }

    const role = (prof?.role || "Staff") as string;
    setMyRole(role);

    if (!["admin", "auditor", "account", "accounts", "accountofficer"].includes(roleKey(role))) {
      setMsg("Access denied. Only Admin, Auditor and Account Officers can view payment vouchers.");
      setRows([]);
      setReadyRows([]);
      setLoading(false);
      return;
    }

    const [voucherRes, readyRes] = await Promise.all([
      supabase.rpc("get_payment_vouchers"),
      supabase.rpc("get_requests_ready_for_payment_voucher"),
    ]);

    if (voucherRes.error) {
      setMsg("Failed to load payment vouchers: " + voucherRes.error.message);
      setRows([]);
    } else {
      setRows((voucherRes.data || []) as VoucherRow[]);
    }

    if (readyRes.error) {
      setMsg("Failed to load voucher-ready requests: " + readyRes.error.message);
      setReadyRows([]);
    } else {
      setReadyRows((readyRes.data || []) as ReadyRequest[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateVoucher(requestId: string) {
    const ok = confirm("Generate payment voucher for this request?");
    if (!ok) return;

    setGeneratingId(requestId);
    setMsg(null);

    try {
      const { data, error } = await supabase.rpc("generate_payment_voucher", {
        p_request_id: requestId,
      });

      if (error) throw new Error(error.message);

      const voucherNo = (data as any)?.voucher_no || "Payment Voucher";
      const voucherId = (data as any)?.voucher_id;

      setMsg(`✅ ${voucherNo} generated successfully.`);

      await load();

      if (voucherId) {
        setTimeout(() => {
          router.push(`/payment-vouchers/${voucherId}/print`);
        }, 600);
      }
    } catch (e: any) {
      setMsg("❌ Failed to generate voucher: " + (e?.message || "Unknown error"));
    } finally {
      setGeneratingId(null);
    }
  }

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();

    return rows.filter((v) => {
      if (statusFilter !== "ALL" && (v.status || "") !== statusFilter) return false;

      if (typeFilter === "Official" && normalize(v.request_type) !== "official") return false;

      if (typeFilter === "PersonalFund") {
        if (!(normalize(v.request_type) === "personal" && normalize(v.personal_category) === "fund")) {
          return false;
        }
      }

      if (s) {
        const haystack = [
          v.voucher_no,
          v.request_no,
          v.payee_name,
          v.narration,
          v.dept_name,
          v.subhead_code,
          v.subhead_name,
          v.prepared_by_name,
          v.checked_by_name,
          v.authorized_by_name,
          v.status,
          v.request_type,
          v.personal_category,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(s)) return false;
      }

      return true;
    });
  }, [rows, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const prepared = rows.filter((x) => (x.status || "") === "Prepared").length;
    const checked = rows.filter((x) => (x.status || "") === "Checked").length;
    const authorized = rows.filter((x) => (x.status || "") === "Authorized").length;
    const paid = rows.filter((x) => (x.status || "") === "Paid").length;
    const cancelled = rows.filter((x) => (x.status || "") === "Cancelled").length;

    const totalAmount = rows
      .filter((x) => (x.status || "") !== "Cancelled")
      .reduce((a, x) => a + Number(x.amount || 0), 0);

    return { total, prepared, checked, authorized, paid, cancelled, totalAmount };
  }, [rows]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">
          Loading payment vouchers...
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">
              Payment Voucher Access
            </h1>

            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {msg || "Access denied."}
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-7xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Payment Vouchers
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Official IET payment voucher register for paid/completed financial requests.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/finance/subheads")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Back to Finance
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard title="Total Vouchers" value={String(stats.total)} tone="blue" />
          <StatCard title="Prepared" value={String(stats.prepared)} tone="slate" />
          <StatCard title="Checked" value={String(stats.checked)} tone="blue" />
          <StatCard title="Authorized" value={String(stats.authorized)} tone="purple" />
          <StatCard title="Paid" value={String(stats.paid)} tone="emerald" />
          <StatCard title="Cancelled" value={String(stats.cancelled)} tone="red" />
          <StatCard title="Total Value" value={naira(stats.totalAmount)} tone="amber" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Requests Ready for Voucher
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Paid/completed Official and Personal Fund requests without existing vouchers.
              </p>
            </div>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {readyRows.length} ready
            </span>
          </div>

          {readyRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-700">
              No request is currently ready for voucher generation.
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 xl:hidden">
                {readyRows.map((r) => (
                  <div key={r.id} className="rounded-2xl border bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-slate-900">{r.request_no}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">{r.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {r.dept_name || "—"}
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${categoryBadgeClass(r)}`}
                      >
                        {categoryLabel(r)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <InfoLine label="Requester" value={r.requester_name || "—"} />
                      <InfoLine label="Amount" value={naira(r.amount)} />
                      <InfoLine label="Status" value={r.status || "—"} />
                      <InfoLine label="Account" value={r.account_name || "—"} />
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => router.push(`/requests/${r.id}`)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        Request
                      </button>

                      <button
                        onClick={() => generateVoucher(r.id)}
                        disabled={generatingId === r.id}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {generatingId === r.id ? "Generating..." : "Generate Voucher"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden xl:block overflow-x-auto">
                <div className="min-w-[1180px]">
                  <div className="grid grid-cols-14 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <div className="col-span-2">Request No</div>
                    <div className="col-span-3">Title</div>
                    <div className="col-span-2">Department</div>
                    <div className="col-span-1">Type</div>
                    <div className="col-span-1 text-right">Amount</div>
                    <div className="col-span-2">Requester</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-2 text-right">Action</div>
                  </div>

                  {readyRows.map((r) => (
                    <div
                      key={r.id}
                      className="grid grid-cols-14 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                    >
                      <div className="col-span-2 font-extrabold text-slate-900">
                        {r.request_no}
                      </div>

                      <div className="col-span-3">
                        <div className="font-semibold text-slate-900">{r.title}</div>
                        <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                          {r.details}
                        </div>
                      </div>

                      <div className="col-span-2 text-slate-700">
                        {r.dept_name || "—"}
                      </div>

                      <div className="col-span-1">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-bold ${categoryBadgeClass(r)}`}
                        >
                          {categoryLabel(r)}
                        </span>
                      </div>

                      <div className="col-span-1 text-right font-bold text-slate-900">
                        {naira(r.amount)}
                      </div>

                      <div className="col-span-2 text-slate-700">
                        {r.requester_name || "—"}
                      </div>

                      <div className="col-span-1">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(r.status)}`}
                        >
                          {r.status || "—"}
                        </span>
                      </div>

                      <div className="col-span-2 flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/requests/${r.id}`)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                        >
                          Request
                        </button>

                        <button
                          onClick={() => generateVoucher(r.id)}
                          disabled={generatingId === r.id}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {generatingId === r.id ? "Generating..." : "Generate"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-800">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voucher no, request no, payee..."
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Request Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Financial Requests</option>
                <option value="Official">Official</option>
                <option value="PersonalFund">Personal Fund</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Voucher Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Prepared">Prepared</option>
                <option value="Checked">Checked</option>
                <option value="Authorized">Authorized</option>
                <option value="Cheque Prepared">Cheque Prepared</option>
                <option value="Cheque Signed">Cheque Signed</option>
                <option value="Counter Signed">Counter Signed</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 hidden xl:block rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Voucher Register</h2>
            <p className="mt-1 text-sm text-slate-600">
              Generated payment vouchers linked to approved payment requests.
            </p>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1320px]">
                <div className="grid grid-cols-16 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <div className="col-span-2">Voucher No</div>
                  <div className="col-span-2">Request No</div>
                  <div className="col-span-2">Payee</div>
                  <div className="col-span-2">Narration</div>
                  <div className="col-span-1 text-right">Amount</div>
                  <div className="col-span-2">Department</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Date</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {filteredRows.map((v) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-16 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                  >
                    <div className="col-span-2 font-extrabold text-slate-900">
                      {v.voucher_no}
                    </div>

                    <div className="col-span-2 text-slate-700">{v.request_no || "—"}</div>

                    <div className="col-span-2 font-semibold text-slate-900">
                      {v.payee_name || "—"}
                    </div>

                    <div className="col-span-2">
                      <div className="line-clamp-2 text-slate-700">{v.narration || "—"}</div>
                    </div>

                    <div className="col-span-1 text-right font-bold text-slate-900">
                      {naira(v.amount)}
                    </div>

                    <div className="col-span-2 text-slate-700">{v.dept_name || "—"}</div>

                    <div className="col-span-1">
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-bold ${categoryBadgeClass(v)}`}
                      >
                        {categoryLabel(v)}
                      </span>
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(v.status)}`}
                      >
                        {v.status || "—"}
                      </span>
                    </div>

                    <div className="col-span-1 text-slate-600">{shortDate(v.created_at)}</div>

                    <div className="col-span-2 flex justify-end gap-2">
                      <button
                        onClick={() => router.push(`/requests/${v.request_id}`)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        Request
                      </button>

                      <button
                        onClick={() => router.push(`/payment-vouchers/${v.id}`)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        View
                      </button>

                      <button
                        onClick={() => router.push(`/payment-vouchers/${v.id}/print`)}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Print
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 xl:hidden">
          {filteredRows.length === 0 ? (
            <EmptyState />
          ) : (
            filteredRows.map((v) => (
              <div key={v.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">{v.voucher_no}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      Request: {v.request_no || "—"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{v.dept_name || "—"}</div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${categoryBadgeClass(v)}`}
                    >
                      {categoryLabel(v)}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(v.status)}`}
                    >
                      {v.status || "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <InfoLine label="Payee" value={v.payee_name || "—"} />
                  <InfoLine label="Amount" value={naira(v.amount)} />
                  <InfoLine label="Prepared By" value={v.prepared_by_name || "—"} />
                  <InfoLine label="Checked By" value={v.checked_by_name || "—"} />
                  <InfoLine label="Authorized By" value={v.authorized_by_name || "—"} />
                  <InfoLine label="Date" value={shortDate(v.created_at)} />
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">Narration</div>
                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap">{v.narration || "—"}</div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => router.push(`/requests/${v.request_id}`)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Request
                  </button>

                  <button
                    onClick={() => router.push(`/payment-vouchers/${v.id}`)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    View
                  </button>

                  <button
                    onClick={() => router.push(`/payment-vouchers/${v.id}/print`)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Print
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="font-bold">Payment Voucher Note</div>
          <p className="mt-1">
            Vouchers are generated only for Official and Personal Fund requests that have already
            been paid or completed. Personal NonFund requests do not require payment vouchers.
          </p>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "emerald" | "purple" | "slate" | "amber" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "slate"
      ? "bg-slate-50 text-slate-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span>{" "}
      <b className="text-slate-900">{value}</b>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-white p-6 text-sm text-slate-700 shadow-sm xl:rounded-none xl:border-0 xl:shadow-none">
      No payment voucher found for the selected filter.
    </div>
  );
}