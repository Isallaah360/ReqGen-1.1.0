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
  amount: number;
  created_at: string;
};

export default function ApprovalsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.push("/login");
        return;
      }

      // 1) Load approvals assigned to you
      const { data, error } = await supabase
        .from("requests")
        .select("id,request_no,title,status,current_stage,amount,created_at")
        .eq("current_owner", user.id)
        .order("created_at", { ascending: false });

      if (error) setMsg("Failed to load approvals: " + error.message);
      setRows((data || []) as RequestRow[]);

      // 2) Load unread notifications count
      const { count, error: nErr } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (!nErr) setUnreadCount(count || 0);

      setLoading(false);
    }

    load();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Approvals Inbox
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Requests currently assigned to you.
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                {unreadCount} new
              </span>
            )}
          </p>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-slate-600">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            No pending approvals.
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
              <button
                key={r.id}
                onClick={() => router.push(`/requests/${r.id}`)}
                className="grid w-full grid-cols-12 items-center border-t px-4 py-3 text-left text-sm hover:bg-slate-50"
              >
                <div className="col-span-3 font-semibold text-slate-900">
                  {r.request_no}
                </div>
                <div className="col-span-4 text-slate-800">{r.title}</div>
                <div className="col-span-2 text-slate-700">{r.current_stage}</div>
                <div className="col-span-2 text-slate-700">{r.status}</div>
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