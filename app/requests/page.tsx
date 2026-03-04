"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Row = {
  id: string;
  request_no: string;
  title: string;
  amount: number;
  status: string;
  current_stage: string;
  created_at: string;
};

export default function MyRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

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
        .select("id,request_no,title,amount,status,current_stage,created_at")
        .eq("created_by", auth.user.id)
        .order("created_at", { ascending: false });

      if (error) setMsg("Failed to load: " + error.message);
      setRows((data || []) as any);
      setLoading(false);
    }

    load();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">My Requests</h1>
            <p className="mt-2 text-sm text-slate-600">All requests you created.</p>
          </div>

          <button
            onClick={() => router.push("/requests/new")}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            New Request
          </button>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        {loading ? (
          <div className="mt-6 text-slate-600">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            No requests yet.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
              <div className="col-span-3">Request No</div>
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Stage</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">₦</div>
            </div>

            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-12 items-center border-t px-4 py-3 text-sm">
                <button
                  onClick={() => router.push(`/requests/${r.id}`)}
                  className="col-span-3 text-left font-semibold text-slate-900 hover:underline"
                >
                  {r.request_no}
                </button>
                <div className="col-span-4 text-slate-800">{r.title}</div>
                <div className="col-span-2 text-slate-700">{r.current_stage}</div>
                <div className="col-span-2 text-slate-700">{r.status}</div>
                <div className="col-span-1 text-right font-semibold text-slate-900">
                  {Number(r.amount || 0).toLocaleString()}
                </div>

                <div className="col-span-12 mt-2 flex gap-2">
                  <button
                    onClick={() => router.push(`/requests/${r.id}`)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    View
                  </button>
                  <button
                    onClick={() => router.push(`/requests/${r.id}/print`)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}