"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Req = {
  id: string;
  request_no: string;
  title: string;
  details: string;
  amount: number;
  created_by: string;
  dept_id: string;
  subhead_id: string | null;
  current_stage: string;
  status: string;
  created_at: string;
  requester_signature_url: string | null;
  hod_signature_url: string | null;
  director_signature_url: string | null;
  dg_signature_url: string | null;
  registry_signature_url: string | null;
  account_signature_url: string | null;
};

type Dept = {
  id: string;
  name: string;
};

type Subhead = {
  id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  expenditure: number | null;
  balance: number | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  signature_url: string | null;
};

type Hist = {
  id: string;
  action_type: string;
  to_stage: string | null;
  created_at: string;
  signature_url: string | null;
  action_by: string;
};

function naira(n: number | null | undefined) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

function displayPersonName(p: Profile | null | undefined) {
  return (p?.full_name || "").trim();
}

async function signedUrl(path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("signatures")
    .createSignedUrl(path, 60 * 10);
  return data?.signedUrl || null;
}

export default function PrintRequestPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [req, setReq] = useState<Req | null>(null);
  const [dept, setDept] = useState<Dept | null>(null);
  const [subhead, setSubhead] = useState<Subhead | null>(null);
  const [requester, setRequester] = useState<Profile | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);

  const [checkedByProfile, setCheckedByProfile] = useState<Profile | null>(null);
  const [dgProfile, setDgProfile] = useState<Profile | null>(null);
  const [accountProfile, setAccountProfile] = useState<Profile | null>(null);

  const [sigRequester, setSigRequester] = useState<string | null>(null);
  const [sigChecked, setSigChecked] = useState<string | null>(null);
  const [sigDG, setSigDG] = useState<string | null>(null);
  const [sigAccount, setSigAccount] = useState<string | null>(null);

  const checkedRecord = useMemo(() => {
    const approvals = hist.filter((h) =>
      (h.action_type || "").toLowerCase().includes("approve")
    );

    return (
      approvals.find((h) => (h.to_stage || "").toLowerCase() === "dg") ||
      approvals.find((h) => (h.to_stage || "").toLowerCase() === "registry") ||
      approvals.find((h) => (h.to_stage || "").toLowerCase() === "hr") ||
      approvals.find((h) => (h.to_stage || "").toLowerCase() === "hod") ||
      approvals.find((h) => (h.to_stage || "").toLowerCase() === "director") ||
      approvals[0] ||
      null
    );
  }, [hist]);

  const dgRecord = useMemo(() => {
    const approvals = hist.filter((h) =>
      (h.action_type || "").toLowerCase().includes("approve")
    );

    return (
      approvals.find((h) => (h.to_stage || "").toLowerCase() === "account") ||
      approvals.find((h) => (h.to_stage || "").toLowerCase() === "completed") ||
      null
    );
  }, [hist]);

  const accountRecord = useMemo(() => {
    const approvals = hist.filter((h) =>
      (h.action_type || "").toLowerCase().includes("approve")
    );

    return (
      approvals.find((h) => (h.to_stage || "").toLowerCase() === "completed") ||
      null
    );
  }, [hist]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { data: r, error: rErr } = await supabase
        .from("requests")
        .select(`
          id,
          request_no,
          title,
          details,
          amount,
          created_by,
          dept_id,
          subhead_id,
          current_stage,
          status,
          created_at,
          requester_signature_url,
          hod_signature_url,
          director_signature_url,
          dg_signature_url,
          registry_signature_url,
          account_signature_url
        `)
        .eq("id", id)
        .single();

      if (rErr) {
        setMsg("Failed to load request: " + rErr.message);
        setLoading(false);
        return;
      }

      const requestRow = r as Req;
      setReq(requestRow);

      const [{ data: d }, { data: sh }, { data: prof }, { data: h }] =
        await Promise.all([
          supabase.from("departments").select("id,name").eq("id", requestRow.dept_id).single(),
          requestRow.subhead_id
            ? supabase
                .from("subheads")
                .select("id,code,name,approved_allocation,expenditure,balance")
                .eq("id", requestRow.subhead_id)
                .single()
            : Promise.resolve({ data: null } as any),
          supabase
            .from("profiles")
            .select("id,full_name,signature_url")
            .eq("id", requestRow.created_by)
            .single(),
          supabase
            .from("request_history")
            .select("id,action_type,to_stage,created_at,signature_url,action_by")
            .eq("request_id", requestRow.id)
            .order("created_at", { ascending: true }),
        ]);

      setDept((d as Dept) || null);
      setSubhead((sh as Subhead) || null);
      setRequester((prof as Profile) || null);
      setHist((h || []) as Hist[]);

      setLoading(false);
    }

    load();
  }, [id, router]);

  useEffect(() => {
    if (req?.request_no) {
      document.title = req.request_no;
    } else {
      document.title = "request-print";
    }
  }, [req?.request_no]);

  useEffect(() => {
    async function loadApproverProfiles() {
      const ids = [
        checkedRecord?.action_by,
        dgRecord?.action_by,
        accountRecord?.action_by,
      ].filter(Boolean) as string[];

      if (ids.length === 0) return;

      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,signature_url")
        .in("id", ids);

      const rows = (data || []) as Profile[];
      const byId = new Map<string, Profile>();
      rows.forEach((r) => byId.set(r.id, r));

      setCheckedByProfile(
        checkedRecord?.action_by ? byId.get(checkedRecord.action_by) || null : null
      );
      setDgProfile(
        dgRecord?.action_by ? byId.get(dgRecord.action_by) || null : null
      );
      setAccountProfile(
        accountRecord?.action_by ? byId.get(accountRecord.action_by) || null : null
      );
    }

    loadApproverProfiles();
  }, [checkedRecord, dgRecord, accountRecord]);

  useEffect(() => {
    async function loadSigs() {
      if (!req) return;

      const requesterSig =
        (await signedUrl(req.requester_signature_url)) ||
        (await signedUrl(requester?.signature_url || null));

      const checkedSig =
        (await signedUrl(req.registry_signature_url)) ||
        (await signedUrl(req.hod_signature_url)) ||
        (await signedUrl(req.director_signature_url)) ||
        (await signedUrl(checkedRecord?.signature_url || null)) ||
        (await signedUrl(checkedByProfile?.signature_url || null));

      const dgSig =
        (await signedUrl(req.dg_signature_url)) ||
        (await signedUrl(dgRecord?.signature_url || null)) ||
        (await signedUrl(dgProfile?.signature_url || null));

      const accountSig =
        (await signedUrl(req.account_signature_url)) ||
        (await signedUrl(accountRecord?.signature_url || null)) ||
        (await signedUrl(accountProfile?.signature_url || null));

      setSigRequester(requesterSig);
      setSigChecked(checkedSig);
      setSigDG(dgSig);
      setSigAccount(accountSig);
    }

    loadSigs();
  }, [req, requester, checkedRecord, dgRecord, accountRecord, checkedByProfile, dgProfile, accountProfile]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-5xl text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!req) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-5xl text-slate-700">Request not found.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <style>{`
        @page {
          size: A4;
          margin: 10mm;
        }

        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[900px]">
        <div className="no-print mb-4 flex items-center justify-between">
          <button
            onClick={() => router.push(`/requests/${req.id}`)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>

          <button
            onClick={() => window.print()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Print
          </button>
        </div>

        {msg && (
          <div className="no-print mb-4 rounded-xl bg-white px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="sheet mx-auto min-h-[1122px] w-full bg-white px-[42px] py-[34px] text-black">
          <div className="text-center">
            <div className="mx-auto flex justify-center">
              <Image
                src="/iet-logo.png"
                alt="IET Logo"
                width={86}
                height={86}
                className="h-[86px] w-auto object-contain"
                priority
              />
            </div>

            <div className="mt-2 text-[28px] font-black uppercase leading-none tracking-tight">
              Islamic Education Trust
            </div>

            <div className="mt-1 text-[15px] font-semibold leading-tight">
              IW2, Ilmi Avenue Intermediate Housing Estate
            </div>
            <div className="text-[15px] font-semibold leading-tight">
              PMB 229, Minna, Niger State - Nigeria
            </div>
          </div>

          <div className="mt-4 h-[4px] w-full bg-blue-500" />

          <div className="mt-4 grid grid-cols-12 gap-x-6 gap-y-2">
            <TopLineField label="Reference:" value={req.request_no} className="col-span-5" />
            <TopLineField label="Date:" value={formatDate(req.created_at)} className="col-span-4" />
            <TopLineField label="Stage:" value={req.current_stage || ""} className="col-span-3" />

            <TopLineField label="Department:" value={dept?.name || ""} className="col-span-5" />
            <TopLineField
              label="Sub-Head:"
              value={subhead ? `${subhead.code || ""} ${subhead.name}`.trim() : ""}
              className="col-span-4"
            />
            <TopLineField label="Status:" value={req.status || ""} className="col-span-3" />
          </div>

          <div className="mt-3 h-[3px] w-full bg-blue-300" />

          <div className="mt-6 text-[19px] font-bold leading-[1.45]">
            <div>The Director General,</div>
            <div>Islamic Education Trust,</div>
            <div>Minna.</div>
          </div>

          <div className="mt-10 text-[19px] font-bold">Assalamu` Alaikum Sir,</div>

          <div className="mt-4 text-center text-[21px] font-black uppercase">
            Request for Fund
          </div>

          <div className="mt-4 text-[18px] font-bold leading-[1.55]">
            I write to request for the release of the total sum of{" "}
            <span className="inline-block min-w-[270px] border-b-[2px] border-black text-center font-bold">
              {naira(req.amount)}
            </span>{" "}
            for the expense below/attached:
          </div>

          <div className="mt-4 min-h-[300px] whitespace-pre-wrap text-[18px] font-semibold leading-[1.55]">
            {req.details}
          </div>

          <div className="mt-10 text-[19px] font-bold">Wassalamu` Alaikum.</div>

          <div className="mt-6 flex justify-end">
            <div className="w-[470px] space-y-2">
              <SmallFieldRow label="ALLOCATION B/D:" value={naira(subhead?.approved_allocation)} />
              <SmallFieldRow label="EXPENDITURE:" value={naira(subhead?.expenditure)} />
              <SmallFieldRow label="BALANCE C/D:" value={naira(subhead?.balance)} />
            </div>
          </div>

          <div className="mt-6 h-[3px] w-full bg-blue-300" />

          <div className="mt-8 space-y-5 text-[17px] font-bold">
            <SignatureLine
              label="Requested by:"
              name={displayPersonName(requester)}
              sigUrl={sigRequester}
              date={formatDate(req.created_at)}
            />

            <SignatureLine
              label="Checked by:"
              name={displayPersonName(checkedByProfile)}
              sigUrl={sigChecked}
              date={checkedRecord?.created_at ? formatDate(checkedRecord.created_at) : ""}
            />

            <SignatureLine
              label="Approved by DG, IET:"
              name={displayPersonName(dgProfile)}
              sigUrl={sigDG}
              date={dgRecord?.created_at ? formatDate(dgRecord.created_at) : ""}
            />

            <SignatureLine
              label="Paid by Account:"
              name={displayPersonName(accountProfile)}
              sigUrl={sigAccount}
              date={accountRecord?.created_at ? formatDate(accountRecord.created_at) : ""}
            />
          </div>

          <div className="mt-12 text-center text-[18px] italic font-medium">
            Building Bridges
          </div>
        </div>
      </div>
    </main>
  );
}

function TopLineField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-2 ${className || ""}`}>
      <div className="shrink-0 text-[16px] font-bold">{label}</div>
      <div className="min-w-0 flex-1 border-b-[2px] border-black px-1 pb-[2px] text-[16px] font-semibold leading-tight break-words">
        {value}
      </div>
    </div>
  );
}

function SmallFieldRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <div className="w-[190px] text-right text-[18px] font-black">{label}</div>
      <div className="h-[33px] w-[270px] rounded-[5px] border-[2px] border-black px-3 text-right text-[16px] font-semibold leading-[29px]">
        {value}
      </div>
    </div>
  );
}

function SignatureLine({
  label,
  name,
  sigUrl,
  date,
}: {
  label: string;
  name: string;
  sigUrl: string | null;
  date: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-[170px_1.9fr_0.8fr_0.8fr] items-end gap-3">
        <div className="whitespace-nowrap">{label}</div>

        <div className="border-b-[2px] border-black pb-[2px] text-[15px] font-semibold pr-2">
          {name}
        </div>

        <div className="relative h-[34px] border-b-[2px] border-black">
          {sigUrl ? (
            <img
              src={sigUrl}
              alt="signature"
              className="absolute bottom-0 left-1/2 h-[28px] max-w-[90%] -translate-x-1/2 object-contain"
            />
          ) : null}
        </div>

        <div className="border-b-[2px] border-black pb-[2px] text-center text-[15px] font-semibold">
          {date}
        </div>
      </div>

      <div className="grid grid-cols-[170px_1.9fr_0.8fr_0.8fr] gap-3 pt-1 text-center text-[11px] font-medium text-slate-600">
        <div />
        <div>Name</div>
        <div>Signature</div>
        <div>Date</div>
      </div>
    </div>
  );
}