"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type RequestRow = {
  id: string;
  request_no: string;
  title: string;
  status: string;
  current_stage: string;
  created_at: string;
  amount: number;
};

export default function MyRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<RequestRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("requests")
        .select("id,request_no,title,status,current_stage,created_at,amount")
        .order("created_at", { ascending: false });

      if (error) setMsg("Failed to load requests: " + error.message);
      setRows((data || []) as RequestRow[]);
      setLoading(false);
    }

    load();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              My Requests
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              View and track all your submitted requests.
            </p>
          </div>

          <button
            onClick={() => router.push("/requests/new")}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            New Request
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-slate-600">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 text-sm text-slate-700 shadow-sm">
            No requests yet. Click <b>New Request</b> to create one.
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
              <div className="col-span-3">Request No</div>
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Stage</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">₦</div>
            </div>

            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => router.push(`/requests/${r.id}`)}
                className="grid w-full grid-cols-12 items-center border-t px-4 py-3 text-left text-sm hover:bg-slate-50"
              >
                <div className="col-span-3 font-semibold text-slate-900">
                  {r.request_no}
                </div>
                <div className="col-span-4 text-slate-800">{r.title}</div>
                <div className="col-span-2">
                  <StageBadge stage={r.current_stage} />
                </div>
                <div className="col-span-2">
                  <StatusBadge status={r.status} />
                </div>
                <div className="col-span-1 text-right font-semibold text-slate-900">
                  {Number(r.amount || 0).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className="inline-flex rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
      {stage || "—"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s.includes("submit")
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : s.includes("approve")
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s.includes("reject")
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  );
}