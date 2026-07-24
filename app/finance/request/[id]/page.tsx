"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type FinanceRequest = {
  id: string;
  request_no: string | null;
  title: string | null;
  description: string | null;
  amount: number | string | null;
  status: string | null;
  current_stage: string | null;
  assigned_account_officer_id: string | null;
  assigned_account_officer_name: string | null;
  subhead_id: string | null;
  created_at: string;
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function FinanceRequestPage() {
  const params = useParams<{ id: string }>();
  const requestId = params?.id;
  const [request, setRequest] = useState<FinanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        setError("Your session has expired. Please sign in again.");
        setLoading(false);
        return;
      }

      const { data, error: requestError } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,description,amount,status,current_stage,assigned_account_officer_id,assigned_account_officer_name,subhead_id,created_at"
        )
        .eq("id", requestId)
        .eq("assigned_account_officer_id", user.id)
        .maybeSingle();

      if (requestError) {
        setError(requestError.message);
      } else if (!data) {
        setError("This finance request is not assigned to your AccountOfficer profile.");
      } else {
        setRequest(data as FinanceRequest);
      }

      setLoading(false);
    }

    if (requestId) load();
  }, [requestId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-96 animate-pulse rounded-3xl bg-slate-200" />
      </main>
    );
  }

  if (error || !request) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-red-200 bg-red-50 p-7">
          <h1 className="text-2xl font-black text-red-950">Unable to open finance request</h1>
          <p className="mt-3 font-semibold text-red-800">{error || "Request not found."}</p>
          <Link href="/finance" className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
            Return to Finance
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5">
        <Link href="/finance" className="text-sm font-black text-blue-700 hover:underline">
          ← Finance Dashboard
        </Link>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Finance Request</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              {request.request_no || "Request"}
            </h1>
            <p className="mt-2 text-lg font-bold text-slate-700">{request.title || "Untitled request"}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
            <div className="text-xs font-black uppercase tracking-wide text-emerald-700">Amount</div>
            <div className="mt-1 text-2xl font-black text-emerald-950">{money(request.amount)}</div>
          </div>
        </div>

        <dl className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="mt-1 font-black text-slate-950">{request.status || "Pending Payment"}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Current Stage</dt>
            <dd className="mt-1 font-black text-slate-950">{request.current_stage || "Account"}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 sm:col-span-2">
            <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Purpose / Description</dt>
            <dd className="mt-2 whitespace-pre-wrap font-semibold leading-7 text-slate-700">
              {request.description || "No description supplied."}
            </dd>
          </div>
        </dl>

        <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-black text-blue-950">Payment processing panel</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
            The voucher-generation, evidence-upload and payment-posting controls will be connected in Sprint 2.
          </p>
        </div>
      </section>
    </main>
  );
}
