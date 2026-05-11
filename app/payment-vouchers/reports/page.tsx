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
  disbursement_mode: string | null;
  is_multi_request: boolean | null;
  item_count: number | null;
  total_amount: number | null;
  voucher_scope: string | null;
  status: string | null;
  created_at: string;
};

type ProfileMini = {
  id: string;
  role: string | null;
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

function inputDateValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function categoryKey(v: { request_type: string | null; personal_category: string | null }) {
  const rt = normalize(v.request_type);
  const pc = normalize(v.personal_category);

  if (rt === "official") return "official";
  if (rt === "personal" && pc === "fund") return "personalfund";
  if (rt === "personal" && pc === "nonfund") return "personalnonfund";

  return "unknown";
}

function categoryLabel(v: { request_type: string | null; personal_category: string | null }) {
  const key = categoryKey(v);

  if (key === "official") return "Official";
  if (key === "personalfund") return "Personal Fund";
  if (key === "personalnonfund") return "Personal NonFund";

  return v.request_type || "—";
}

function categoryBadgeClass(v: { request_type: string | null; personal_category: string | null }) {
  const key = categoryKey(v);

  if (key === "official") return "border-blue-200 bg-blue-50 text-blue-700";
  if (key === "personalfund") return "border-purple-200 bg-purple-50 text-purple-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusBadgeClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s.includes("paid")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("cancel")) return "border-red-200 bg-red-50 text-red-700";
  if (s.includes("counter")) return "border-purple-200 bg-purple-50 text-purple-700";
  if (s.includes("authorized") || s.includes("checked")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (s.includes("cheque")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("complete")) return "border-emerald-200 bg-emerald-50 text-emerald-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function modeBadgeClass(mode: string | null | undefined) {
  const m = normalize(mode);

  if (m === "transfer") return "border-blue-200 bg-blue-50 text-blue-700";
  if (m === "cash") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (m === "cheque") return "border-amber-200 bg-amber-50 text-amber-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function scopeBadgeClass(scope: string | null | undefined) {
  const s = normalize(scope);

  if (s === "multiple") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function isWithinDateRange(createdAt: string | null | undefined, from: string, to: string) {
  if (!createdAt) return false;

  const d = new Date(createdAt);
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59`) : null;

  if (start && d < start) return false;
  if (end && d > end) return false;

  return true;
}

export default function PaymentVoucherReportsPage() {
  const router = useRouter();

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const rk = roleKey(me?.role);

  const canAccess = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);

  const [rows, setRows] = useState<VoucherRow[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState(inputDateValue(firstDay));
  const [toDate, setToDate] = useState(inputDateValue(today));

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
      .select("id,role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profErr || !prof) {
      setMsg("Failed to load your profile: " + (profErr?.message || "Profile not found."));
      setLoading(false);
      return;
    }

    setMe(prof as ProfileMini);

    const role = roleKey(prof.role);
    if (!["admin", "auditor", "account", "accounts", "accountofficer"].includes(role)) {
      setMsg("Access denied. Only Admin, Auditor and Account Officers can access PV Reports.");
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("get_payment_vouchers");

    if (error) {
      setMsg("Failed to load payment vouchers: " + error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as VoucherRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();

    return rows.filter((v) => {
      if (!isWithinDateRange(v.created_at, fromDate, toDate)) return false;

      if (statusFilter !== "ALL" && (v.status || "") !== statusFilter) return false;

      if (modeFilter !== "ALL" && normalize(v.disbursement_mode) !== normalize(modeFilter)) {
        return false;
      }

      if (scopeFilter !== "ALL" && normalize(v.voucher_scope) !== normalize(scopeFilter)) {
        return false;
      }

      if (typeFilter === "Official" && categoryKey(v) !== "official") return false;
      if (typeFilter === "PersonalFund" && categoryKey(v) !== "personalfund") return false;

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
          v.disbursement_mode,
          v.voucher_scope,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(s)) return false;
      }

      return true;
    });
  }, [rows, search, statusFilter, modeFilter, typeFilter, scopeFilter, fromDate, toDate]);

  const stats = useMemo(() => {
    const activeRows = filteredRows.filter((x) => (x.status || "") !== "Cancelled");

    const total = filteredRows.length;
    const active = activeRows.length;
    const paid = filteredRows.filter((x) => (x.status || "") === "Paid").length;
    const cancelled = filteredRows.filter((x) => (x.status || "") === "Cancelled").length;
    const pending = filteredRows.filter((x) => {
      const s = x.status || "";
      return s !== "Paid" && s !== "Cancelled";
    }).length;

    const transfer = filteredRows.filter((x) => normalize(x.disbursement_mode) === "transfer").length;
    const cash = filteredRows.filter((x) => normalize(x.disbursement_mode) === "cash").length;
    const cheque = filteredRows.filter((x) => normalize(x.disbursement_mode) === "cheque").length;

    const single = filteredRows.filter((x) => normalize(x.voucher_scope) === "single").length;
    const multiple = filteredRows.filter((x) => normalize(x.voucher_scope) === "multiple").length;

    const official = filteredRows.filter((x) => categoryKey(x) === "official").length;
    const personalFund = filteredRows.filter((x) => categoryKey(x) === "personalfund").length;

    const totalValue = activeRows.reduce((a, x) => a + Number(x.total_amount || x.amount || 0), 0);

    const paidValue = filteredRows
      .filter((x) => (x.status || "") === "Paid")
      .reduce((a, x) => a + Number(x.total_amount || x.amount || 0), 0);

    const pendingValue = filteredRows
      .filter((x) => {
        const s = x.status || "";
        return s !== "Paid" && s !== "Cancelled";
      })
      .reduce((a, x) => a + Number(x.total_amount || x.amount || 0), 0);

    return {
      total,
      active,
      paid,
      cancelled,
      pending,
      transfer,
      cash,
      cheque,
      single,
      multiple,
      official,
      personalFund,
      totalValue,
      paidValue,
      pendingValue,
    };
  }, [filteredRows]);

  function resetFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setModeFilter("ALL");
    setTypeFilter("ALL");
    setScopeFilter("ALL");
    setFromDate(inputDateValue(firstDay));
    setToDate(inputDateValue(today));
  }

  function handlePrintReport() {
    window.print();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">
          Loading PV reports...
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">PV Reports Access</h1>

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
      <style>{`
        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="print-sheet mx-auto max-w-7xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Payment Voucher Reports
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Audit register for single and combined payment vouchers.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Period: {fromDate || "Beginning"} to {toDate || "Today"}
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Refresh
            </button>

            <button
              onClick={handlePrintReport}
              style={{ color: "#ffffff" }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Print Report
            </button>

            <button
              onClick={() => router.push("/payment-vouchers")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Back to Vouchers
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total PVs" value={String(stats.total)} tone="blue" />
          <StatCard title="Active PVs" value={String(stats.active)} tone="slate" />
          <StatCard title="Paid PVs" value={String(stats.paid)} tone="emerald" />
          <StatCard title="Pending PVs" value={String(stats.pending)} tone="amber" />
          <StatCard title="Cancelled PVs" value={String(stats.cancelled)} tone="red" />
          <StatCard title="Total Value" value={naira(stats.totalValue)} tone="purple" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MiniCard title="Paid Value" value={naira(stats.paidValue)} />
          <MiniCard title="Pending Value" value={naira(stats.pendingValue)} />
          <MiniCard title="Transfer" value={String(stats.transfer)} />
          <MiniCard title="Cash" value={String(stats.cash)} />
          <MiniCard title="Cheque" value={String(stats.cheque)} />
          <MiniCard title="Combined PVs" value={String(stats.multiple)} />
        </div>

        <div className="no-print mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PV no, request no, payee, department..."
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Authorized">Authorized</option>
                <option value="Cheque Prepared">Cheque Prepared</option>
                <option value="Cheque Signed">Cheque Signed</option>
                <option value="Counter Signed">Counter Signed</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Mode</label>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Modes</option>
                <option value="Transfer">Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="Official">Official</option>
                <option value="PersonalFund">Personal Fund</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Scope</label>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Scopes</option>
                <option value="Single">Single</option>
                <option value="Multiple">Combined</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 hidden xl:block rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">PV Audit Register</h2>
            <p className="mt-1 text-sm text-slate-600">
              {filteredRows.length} voucher(s) found for the selected filters.
            </p>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1500px]">
                <div className="grid grid-cols-19 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <div className="col-span-2">PV No</div>
                  <div className="col-span-2">Request</div>
                  <div className="col-span-2">Payee</div>
                  <div className="col-span-2">Department</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-1">Mode</div>
                  <div className="col-span-1">Scope</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Items</div>
                  <div className="col-span-1">Date</div>
                  <div className="col-span-3 text-right no-print">Actions</div>
                </div>

                {filteredRows.map((v) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-19 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                  >
                    <div className="col-span-2 font-extrabold text-slate-900">
                      {v.voucher_no}
                    </div>

                    <div className="col-span-2 text-slate-700">
                      {v.request_no || "—"}
                    </div>

                    <div className="col-span-2 font-semibold text-slate-900">
                      {v.payee_name || "—"}
                    </div>

                    <div className="col-span-2 text-slate-700">
                      {v.dept_name || "—"}
                    </div>

                    <div className="col-span-1">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${categoryBadgeClass(v)}`}>
                        {categoryLabel(v)}
                      </span>
                    </div>

                    <div className="col-span-1">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${modeBadgeClass(v.disbursement_mode)}`}>
                        {v.disbursement_mode || "—"}
                      </span>
                    </div>

                    <div className="col-span-1">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${scopeBadgeClass(v.voucher_scope)}`}>
                        {v.voucher_scope || "Single"}
                      </span>
                    </div>

                    <div className="col-span-2 text-right font-extrabold text-slate-900">
                      {naira(v.total_amount || v.amount)}
                    </div>

                    <div className="col-span-1">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(v.status)}`}>
                        {v.status || "—"}
                      </span>
                    </div>

                    <div className="col-span-1 font-semibold text-slate-700">
                      {v.item_count || 1}
                    </div>

                    <div className="col-span-1 text-slate-600">
                      {shortDate(v.created_at)}
                    </div>

                    <div className="col-span-3 flex justify-end gap-2 no-print">
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

                <div className="grid grid-cols-19 border-t bg-slate-50 px-6 py-4 text-sm">
                  <div className="col-span-10 font-black uppercase text-slate-900">
                    Report Total
                  </div>
                  <div className="col-span-2 text-right font-black text-slate-900">
                    {naira(stats.totalValue)}
                  </div>
                  <div className="col-span-7 text-right text-xs font-semibold text-slate-500">
                    Excludes cancelled vouchers
                  </div>
                </div>
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
                    <div className="mt-1 text-sm text-slate-500">
                      {v.dept_name || "—"}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(v.status)}`}>
                      {v.status || "—"}
                    </span>

                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${scopeBadgeClass(v.voucher_scope)}`}>
                      {v.voucher_scope || "Single"} • {v.item_count || 1}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <InfoLine label="Payee" value={v.payee_name || "—"} />
                  <InfoLine label="Amount" value={naira(v.total_amount || v.amount)} />
                  <InfoLine label="Mode" value={v.disbursement_mode || "—"} />
                  <InfoLine label="Type" value={categoryLabel(v)} />
                  <InfoLine label="Status" value={v.status || "—"} />
                  <InfoLine label="Date" value={shortDate(v.created_at)} />
                </div>

                <div className="no-print mt-4 flex flex-wrap justify-end gap-2">
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
          <div className="font-bold">PV Reports Note</div>
          <p className="mt-1">
            This report summarizes payment vouchers by date, status, payment mode, request type and
            voucher scope. Cancelled vouchers are counted separately and excluded from total active value.
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

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-lg font-extrabold text-slate-900">
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
      No payment voucher found for the selected report filters.
    </div>
  );
}