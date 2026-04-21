"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type MeRow = {
  id: string;
  role: string | null;
};

type AuditRow = {
  id: string;
  request_no: string;
  title: string;
  amount: number;
  status: string;
  created_at: string;
  dept_id: string | null;
  subhead_id: string | null;
  requester_name: string | null;
  checked_by_name: string | null;
  dg_name: string | null;
  account_name: string | null;
};

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

export default function FinanceAuditPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [me, setMe] = useState<MeRow | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);

  const rk = roleKey(me?.role || "");
  const canAudit = useMemo(() => {
    return ["admin", "auditor", "account", "accountofficer"].includes(rk);
  }, [rk]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { data: myProf, error: myErr } = await supabase
        .from("profiles")
        .select("id,role")
        .eq("id", auth.user.id)
        .single();

      if (myErr) {
        setMsg("Failed to load your role: " + myErr.message);
        setLoading(false);
        return;
      }

      setMe(myProf as MeRow);

      const role = roleKey((myProf?.role || "") as string);
      if (!["admin", "auditor", "account", "accountofficer"].includes(role)) {
        router.push("/dashboard");
        return;
      }

      const { data, error } = await supabase
        .from("requests")
        .select(`
          id,
          request_no,
          title,
          amount,
          status,
          created_at,
          dept_id,
          subhead_id,
          requester_name,
          checked_by_name,
          dg_name,
          account_name
        `)
        .in("status", ["Paid", "Completed"])
        .order("created_at", { ascending: false });

      if (error) {
        setMsg("Failed to load audit records: " + error.message);
      } else {
        setRows((data || []) as AuditRow[]);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!canAudit) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Audit Trail & Reconciliation
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Paid and completed requests available for audit review.
            </p>
          </div>

          <button
            onClick={() => router.push("/finance/subheads")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          {rows.length === 0 ? (
            <div className="text-sm text-slate-700">No completed audit records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-sm text-slate-600">
                    <th className="py-2 pr-4">Request No</th>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Requester</th>
                    <th className="py-2 pr-4">Checked By</th>
                    <th className="py-2 pr-4">DG</th>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 text-sm text-slate-800">
                      <td className="py-2 pr-4 font-semibold">{r.request_no}</td>
                      <td className="py-2 pr-4">{r.title}</td>
                      <td className="py-2 pr-4">₦{Number(r.amount || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4">{r.requester_name || "—"}</td>
                      <td className="py-2 pr-4">{r.checked_by_name || "—"}</td>
                      <td className="py-2 pr-4">{r.dg_name || "—"}</td>
                      <td className="py-2 pr-4">{r.account_name || "—"}</td>
                      <td className="py-2 pr-4">{r.status}</td>
                      <td className="py-2 pr-4">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="py-2 pr-4">
                        <button
                          onClick={() => router.push(`/requests/${r.id}`)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}