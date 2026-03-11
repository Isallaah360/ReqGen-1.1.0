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
  checked_by_user_id: string | null;
  dg_approved_by_user_id: string | null;
  account_paid_by_user_id: string | null;
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
  comment: string | null;
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

function cleanName(p: Profile | null | undefined) {
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

  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});

  const [sigRequester, setSigRequester] = useState<string | null>(null);
  const [sigChecked, setSigChecked] = useState<string | null>(null);
  const [sigDG, setSigDG] = useState<string | null>(null);
  const [sigAccount, setSigAccount] = useState<string | null>(null);

  const checkedHist = useMemo(
    () => hist.find((h) => h.action_by === req?.checked_by_user_id) || null,
    [hist, req?.checked_by_user_id]
  );

  const dgHist = useMemo(
    () => hist.find((h) => h.action_by === req?.dg_approved_by_user_id) || null,
    [hist, req?.dg_approved_by_user_id]
  );

  const accountHist = useMemo(
    () => hist.find((h) => h.action_by === req?.account_paid_by_user_id) || null,
    [hist, req?.account_paid_by_user_id]
  );

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
          account_signature_url,
          checked_by_user_id,
          dg_approved_by_user_id,
          account_paid_by_user_id
        `)
        .eq("id", id)
        .single();

      if (rErr) {
        setMsg("Failed to load request: " + rErr.message);
        setLoading(false);
        return;
      }

      const reqRow = r as Req;
      setReq(reqRow);

      const [deptRes, subRes, requesterRes, histRes] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name")
          .eq("id", reqRow.dept_id)
          .single(),
        reqRow.subhead_id
          ? supabase
              .from("subheads")
              .select("id,code,name,approved_allocation,expenditure,balance")
              .eq("id", reqRow.subhead_id)
              .single()
          : Promise.resolve({ data: null } as any),
        supabase
          .from("profiles")
          .select("id,full_name,signature_url")
          .eq("id", reqRow.created_by)
          .single(),
        supabase
          .from("request_history")
          .select("id,action_type,comment,to_stage,created_at,signature_url,action_by")
          .eq("request_id", reqRow.id)
          .order("created_at", { ascending: true }),
      ]);

      if (deptRes.data) setDept(deptRes.data as Dept);
      if (subRes.data) setSubhead(subRes.data as Subhead);
      if (requesterRes.data) setRequester(requesterRes.data as Profile);
      setHist((histRes.data || []) as Hist[]);

      const profileIds = Array.from(
        new Set(
          [
            reqRow.created_by,
            reqRow.checked_by_user_id,
            reqRow.dg_approved_by_user_id,
            reqRow.account_paid_by_user_id,
            ...((histRes.data || []) as Hist[]).map((h) => h.action_by),
          ].filter(Boolean) as string[]
        )
      );

      if (profileIds.length > 0) {
        const { data: pRows } = await supabase
          .from("profiles")
          .select("id,full_name,signature_url")
          .in("id", profileIds);

        const rows = (pRows || []) as Profile[];

        const byId = new Map<string, Profile>();
        const plainMap: Record<string, Profile> = {};

        rows.forEach((p) => {
          byId.set(p.id, p);
          plainMap[p.id] = p;
        });

        setProfilesMap(plainMap);

        setCheckedByProfile(
          reqRow.checked_by_user_id ? byId.get(reqRow.checked_by_user_id) || null : null
        );
        setDgProfile(
          reqRow.dg_approved_by_user_id ? byId.get(reqRow.dg_approved_by_user_id) || null : null
        );
        setAccountProfile(
          reqRow.account_paid_by_user_id ? byId.get(reqRow.account_paid_by_user_id) || null : null
        );
      }

      setLoading(false);
    }

    load();
  }, [id, router]);

  useEffect(() => {
    document.title = req?.request_no || "request-print";
  }, [req?.request_no]);

  useEffect(() => {
    async function loadSigs() {
      if (!req) return;

      setSigRequester(
        (await signedUrl(req.requester_signature_url)) ||
          (await signedUrl(requester?.signature_url || null))
      );

      setSigChecked(
        (await signedUrl(req.hod_signature_url)) ||
          (await signedUrl(req.director_signature_url)) ||
          (await signedUrl(checkedHist?.signature_url || null)) ||
          (await signedUrl(checkedByProfile?.signature_url || null))
      );

      setSigDG(
        (await signedUrl(req.dg_signature_url)) ||
          (await signedUrl(dgHist?.signature_url || null)) ||
          (await signedUrl(dgProfile?.signature_url || null))
      );

      setSigAccount(
        (await signedUrl(req.account_signature_url)) ||
          (await signedUrl(accountHist?.signature_url || null)) ||
          (await signedUrl(accountProfile?.signature_url || null))
      );
    }

    loadSigs();
  }, [req, requester, checkedHist, dgHist, accountHist, checkedByProfile, dgProfile, accountProfile]);

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
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <style>{`
        @page {
          size: A4;
          margin: 8mm;
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
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[860px]">
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

        <div className="sheet mx-auto w-full bg-white px-[34px] py-[24px] text-black">
          <div className="text-center">
            <div className="mx-auto flex justify-center">
              <Image
                src="/iet-logo.png"
                alt="IET Logo"
                width={74}
                height={74}
                className="h-[74px] w-auto object-contain"
                priority
              />
            </div>

            <div className="mt-1 text-[23px] font-black uppercase leading-none tracking-tight">
              Islamic Education Trust
            </div>

            <div className="mt-1 text-[13px] font-semibold leading-tight">
              IW2, Ilmi Avenue Intermediate Housing Estate
            </div>
            <div className="text-[13px] font-semibold leading-tight">
              PMB 229, Minna, Niger State - Nigeria
            </div>
          </div>

          <div className="mt-3 h-[3px] w-full bg-blue-500" />

          <div className="mt-3 grid grid-cols-12 gap-x-5 gap-y-1">
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

          <div className="mt-2 h-[2px] w-full bg-blue-300" />

          <div className="mt-4 text-[15px] font-bold leading-[1.45]">
            <div>The Director General,</div>
            <div>Islamic Education Trust,</div>
            <div>Minna.</div>
          </div>

          <div className="mt-6 text-[15px] font-bold">Assalamu` Alaikum Sir,</div>

          <div className="mt-2 text-center text-[17px] font-black uppercase">
            Request for Fund
          </div>

          <div className="mt-2 text-[14px] font-bold leading-[1.5]">
            I write to request for the release of the total sum of{" "}
            <span className="inline-block min-w-[220px] border-b-[2px] border-black text-center font-bold">
              {naira(req.amount)}
            </span>{" "}
            for the expense below/attached:
          </div>

          <div className="mt-3 min-h-[140px] whitespace-pre-wrap text-[13px] font-semibold leading-[1.45]">
            {req.details}
          </div>

          <div className="mt-5 text-[15px] font-bold">Wassalamu` Alaikum.</div>

          <div className="mt-3 flex justify-end">
            <div className="w-[420px] space-y-1.5">
              <SmallFieldRow label="ALLOCATION B/D:" value={naira(subhead?.approved_allocation)} />
              <SmallFieldRow label="EXPENDITURE:" value={naira(subhead?.expenditure)} />
              <SmallFieldRow label="BALANCE C/D:" value={naira(subhead?.balance)} />
            </div>
          </div>

          <div className="mt-4 h-[2px] w-full bg-blue-300" />

          <div className="mt-4 space-y-3 text-[14px] font-bold">
            <SignatureLine
              label="Requested by:"
              name={cleanName(requester)}
              sigUrl={sigRequester}
              date={formatDate(req.created_at)}
            />

            <SignatureLine
              label="Checked by:"
              name={cleanName(checkedByProfile)}
              sigUrl={sigChecked}
              date={checkedHist?.created_at ? formatDate(checkedHist.created_at) : ""}
            />

            <SignatureLine
              label="Approved by DG, IET:"
              name={cleanName(dgProfile)}
              sigUrl={sigDG}
              date={dgHist?.created_at ? formatDate(dgHist.created_at) : ""}
            />

            <SignatureLine
              label="Paid by Account:"
              name={cleanName(accountProfile)}
              sigUrl={sigAccount}
              date={accountHist?.created_at ? formatDate(accountHist.created_at) : ""}
            />
          </div>

          {hist.length > 0 && (
            <>
              <div className="mt-4 h-[2px] w-full bg-blue-300" />
              <div className="mt-3">
                <div className="text-[14px] font-black uppercase">Comments Trail</div>

                <div className="mt-2 space-y-2">
                  {hist.map((h) => {
                    const actor = profilesMap[h.action_by];
                    return (
                      <div key={h.id} className="rounded-lg border border-slate-300 p-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[12px] font-bold">
                            {cleanName(actor) || "—"} • {h.action_type || "—"} • {h.to_stage || "—"}
                          </div>
                          <div className="text-[11px] font-semibold">
                            {formatDate(h.created_at)}
                          </div>
                        </div>

                        <div className="mt-1 min-h-[32px] whitespace-pre-wrap text-[12px] text-slate-800">
                          {h.comment || "No comment"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="mt-5 text-center text-[15px] italic font-medium">
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
      <div className="shrink-0 text-[13px] font-bold">{label}</div>
      <div className="min-w-0 flex-1 border-b-[2px] border-black px-1 pb-[1px] text-[13px] font-semibold leading-tight break-words">
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
      <div className="w-[170px] text-right text-[14px] font-black">{label}</div>
      <div className="h-[28px] w-[240px] rounded-[5px] border-[2px] border-black px-3 text-right text-[13px] font-semibold leading-[24px]">
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
      <div className="grid grid-cols-[150px_2fr_0.75fr_0.75fr] items-end gap-3">
        <div className="whitespace-nowrap">{label}</div>

        <div className="border-b-[2px] border-black pb-[1px] text-[13px] font-semibold pr-2">
          {name}
        </div>

        <div className="relative h-[28px] border-b-[2px] border-black">
          {sigUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sigUrl}
              alt="signature"
              className="absolute bottom-0 left-1/2 h-[22px] max-w-[88%] -translate-x-1/2 object-contain"
            />
          ) : null}
        </div>

        <div className="border-b-[2px] border-black pb-[1px] text-center text-[13px] font-semibold">
          {date}
        </div>
      </div>

      <div className="grid grid-cols-[150px_2fr_0.75fr_0.75fr] gap-3 pt-1 text-center text-[10px] font-medium text-slate-600">
        <div />
        <div>Name</div>
        <div>Signature</div>
        <div>Date</div>
      </div>
    </div>
  );
}