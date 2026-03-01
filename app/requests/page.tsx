"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type ReqRow = {
  id: string;
  request_no: string;
  title: string | null;
  request_type: "Personal" | "Official";
  personal_category: "Fund" | "NonFund" | null;
  amount: number;
  status: string;
  current_stage: string;
  created_at: string;
};

export default function MyRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<ReqRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,request_type,personal_category,amount,status,current_stage,created_at"
        )
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMsg("Failed to load requests: " + error.message);
        setLoading(false);
        return;
      }

      setRows((data || []) as ReqRow[]);
      setLoading(false);
    }

    load();
  }, [router]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Requests</h1>
          <p className="mt-2 text-sm text-gray-600">
            All requests you have submitted.
          </p>
        </div>

        <Link
          href="/requests/new"
          className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          New Request
        </Link>
      </div>

      {loading && <p className="mt-6 text-gray-600">Loading...</p>}

      {msg && (
        <div className="mt-6 rounded-xl bg-gray-100 px-3 py-2 text-sm">
          {msg}
        </div>
      )}

      {!loading && !msg && rows.length === 0 && (
        <div className="mt-6 rounded-2xl border bg-white p-6 text-sm text-gray-600">
          No requests yet. Click <b>New Request</b> to submit one.
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Request No</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{r.request_no}</td>
                  <td className="px-4 py-3">{r.title || "—"}</td>
                  <td className="px-4 py-3">
                    {r.request_type}
                    {r.personal_category ? ` (${r.personal_category})` : ""}
                  </td>
                  <td className="px-4 py-3">₦{Number(r.amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">{r.current_stage}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/requests/${r.id}`}
                      className="text-sm font-semibold text-black underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}