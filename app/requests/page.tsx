"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: string;
  request_no: string;
  title: string;
  amount: number;
  status: string;
  current_stage: string;
  created_at: string;
  request_type?: string | null;
  personal_category?: string | null;
};

function naira(value: number | null | undefined) {
  return "₦" + Math.round(Number(value || 0)).toLocaleString();
}

function statusClass(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();

  if (s.includes("reject") || s.includes("delete") || s.includes("cancel")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (s.includes("paid") || s.includes("complete") || s.includes("approved")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (s.includes("submit") || s.includes("review") || s.includes("pending")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function stageClass(stage: string | null | undefined) {
  const s = String(stage || "").toLowerCase();

  if (s.includes("account")) return "border-purple-200 bg-purple-50 text-purple-700";
  if (s.includes("dg")) return "border-amber-200 bg-amber-50 text-amber-800";
  if (s.includes("registry")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (s.includes("director") || s.includes("hod")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (s.includes("reject") || s.includes("delete")) return "border-red-200 bg-red-50 text-red-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function requestTypeLabel(row: Row) {
  if (row.request_type === "Official") return "Official";
  if (row.request_type === "Personal" && row.personal_category === "Fund") return "Personal Fund";
  if (row.request_type === "Personal" && row.personal_category === "NonFund") {
    return "Personal NonFund";
  }

  return row.request_type || "—";
}

export default function MyRequestsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,amount,status,current_stage,created_at,request_type,personal_category"
        )
        .eq("created_by", auth.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMsg("Failed to load requests: " + error.message);
        setRows([]);
      } else {
        setRows((data || []) as Row[]);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    load();

    const refreshOnFocus = () => {
      load({ silent: true });
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  const counts = useMemo(() => {
    const total = rows.length;

    const active = rows.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return (
        !s.includes("reject") &&
        !s.includes("delete") &&
        !s.includes("cancel") &&
        !s.includes("paid") &&
        !s.includes("complete") &&
        !s.includes("closed")
      );
    }).length;

    const completed = rows.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return s.includes("paid") || s.includes("complete");
    }).length;

    const rejectedOrDeleted = rows.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return s.includes("reject") || s.includes("delete") || s.includes("cancel");
    }).length;

    return {
      total,
      active,
      completed,
      rejectedOrDeleted,
    };
  }, [rows]);

  function openRequest(requestId: string) {
    router.push(`/requests/${requestId}?updated=${Date.now()}`);
    router.refresh();
  }

  function printRequest(requestId: string) {
    router.push(`/requests/${requestId}/print?updated=${Date.now()}`);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              My Requests
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              All requests you created. This page refreshes automatically when you return to it.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load({ silent: true })}
              disabled={refreshing || loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/requests/new")}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              New Request
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <CountCard label="Total Requests" value={counts.total} tone="slate" />
          <CountCard label="Active / In Progress" value={counts.active} tone="blue" />
          <CountCard label="Completed / Paid" value={counts.completed} tone="emerald" />
          <CountCard label="Rejected / Deleted" value={counts.rejectedOrDeleted} tone="red" />
        </div>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 text-slate-600 shadow-sm">
            Loading requests...
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 text-slate-700 shadow-sm">
            No requests yet.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="hidden grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 md:grid">
              <div className="col-span-2">Request No</div>
              <div className="col-span-3">Title</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Stage</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Amount</div>
            </div>

            {rows.map((r) => (
              <div key={r.id} className="border-t px-4 py-4">
                <div className="grid gap-3 md:grid-cols-12 md:items-center">
                  <button
                    type="button"
                    onClick={() => openRequest(r.id)}
                    className="text-left font-extrabold text-slate-900 hover:underline md:col-span-2"
                  >
                    {r.request_no || "—"}
                  </button>

                  <div className="break-words text-sm font-semibold text-slate-800 md:col-span-3">
                    {r.title || "—"}
                  </div>

                  <div className="text-sm font-semibold text-slate-700 md:col-span-2">
                    {requestTypeLabel(r)}
                  </div>

                  <div className="md:col-span-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${stageClass(
                        r.current_stage
                      )}`}
                    >
                      {r.current_stage || "—"}
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                        r.status
                      )}`}
                    >
                      {r.status || "—"}
                    </span>
                  </div>

                  <div className="text-sm font-extrabold text-slate-900 md:col-span-1 md:text-right">
                    {naira(r.amount)}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openRequest(r.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => printRequest(r.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50"
                  >
                    Print
                  </button>
                </div>

                <div className="mt-2 text-xs font-semibold text-slate-500">
                  Created: {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function CountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "blue" | "emerald" | "red";
}) {
  const cls =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-slate-200 bg-white text-slate-800";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="text-xs font-black uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-2 text-3xl font-black leading-none">
        {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}