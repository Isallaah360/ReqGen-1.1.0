"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Dept = { id: string; name: string };
type Subhead = { id: string; code: string; name: string; dept_id: string };
type Row = {
  id: string;
  created_at: string;
  request_no: string;
  title: string;
  amount: number;
  dept_id: string;
  subhead_id: string | null;
  funds_state: string;
  status: string;
};

export default function FinanceReportsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subheads, setSubheads] = useState<Subhead[]>([]);
  const [rows, setRows] = useState<Row[]>([]);

  const [deptId, setDeptId] = useState("");
  const [subheadId, setSubheadId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const deptMap = useMemo(() => Object.fromEntries(depts.map((d) => [d.id, d.name])), [depts]);
  const shMap = useMemo(() => Object.fromEntries(subheads.map((s) => [s.id, `${s.code} — ${s.name}`])), [subheads]);

  const total = useMemo(() => rows.reduce((a, b) => a + Number(b.amount || 0), 0), [rows]);

  useEffect(() => {
    async function boot() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setMsg("Please login.");
        setLoading(false);
        return;
      }

      const { data: d } = await supabase.from("departments").select("id,name").order("name");
      setDepts((d || []) as any);

      const { data: s } = await supabase.from("subheads").select("id,code,name,dept_id").order("code");
      setSubheads((s || []) as any);

      setLoading(false);
    }
    boot();
  }, []);

  async function run() {
    setMsg(null);
    setLoading(true);

    try {
      let q = supabase
        .from("requests")
        .select("id,created_at,request_no,title,amount,dept_id,subhead_id,funds_state,status")
        .eq("status", "Approved")
        .eq("funds_state", "final")
        .order("created_at", { ascending: false });

      if (deptId) q = q.eq("dept_id", deptId);
      if (subheadId) q = q.eq("subhead_id", subheadId);

      if (fromDate) q = q.gte("created_at", new Date(fromDate).toISOString());
      if (toDate) q = q.lte("created_at", new Date(toDate + "T23:59:59").toISOString());

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      setRows((data || []) as any);
    } catch (e: any) {
      setMsg("❌ Failed: " + (e?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Finance Reports</h1>
        <p className="mt-2 text-sm text-slate-600">Approved + Finalized requests only.</p>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptId}
                onChange={(e) => {
                  setDeptId(e.target.value);
                  setSubheadId("");
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">All</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Subhead</label>
              <select
                value={subheadId}
                onChange={(e) => setSubheadId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">All</option>
                {subheads
                  .filter((s) => !deptId || s.dept_id === deptId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>

          <button
            onClick={run}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Run Report
          </button>

          <div className="mt-4 text-sm text-slate-700">
            Total: <b className="text-slate-900">₦{Number(total).toLocaleString()}</b>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Request No</div>
            <div className="col-span-3">Department</div>
            <div className="col-span-3">Subhead</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>

          {loading ? (
            <div className="p-4 text-slate-600">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-slate-700">No records.</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                <div className="col-span-2 text-slate-700">{new Date(r.created_at).toLocaleDateString()}</div>
                <div className="col-span-2 font-semibold text-slate-900">{r.request_no}</div>
                <div className="col-span-3 text-slate-800">{deptMap[r.dept_id] || r.dept_id}</div>
                <div className="col-span-3 text-slate-800">{r.subhead_id ? shMap[r.subhead_id] : "—"}</div>
                <div className="col-span-2 text-right font-semibold text-slate-900">
                  ₦{Number(r.amount || 0).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}