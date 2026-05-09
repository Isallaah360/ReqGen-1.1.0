"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VoucherDetail = {
  id: string;
  voucher_no: string;
  request_id: string;
  request_no: string | null;
  request_type: string | null;
  personal_category: string | null;

  payee_name: string | null;
  narration: string | null;
  amount: number | null;

  dept_id: string | null;
  dept_name: string | null;

  subhead_id: string | null;
  subhead_code: string | null;
  subhead_name: string | null;

  prepared_by_name: string | null;
  prepared_signature_url: string | null;
  prepared_at: string | null;

  checked_by_name: string | null;
  checked_signature_url: string | null;
  checked_at: string | null;

  authorized_by_name: string | null;
  authorized_signature_url: string | null;
  authorized_at: string | null;

  cheque_no: string | null;
  cheque_date: string | null;
  bank_name: string | null;

  cheque_signed_by_name: string | null;
  cheque_signed_signature_url: string | null;
  cheque_signed_at: string | null;

  cheque_counter_signed_by_name: string | null;
  cheque_counter_signed_signature_url: string | null;
  cheque_counter_signed_at: string | null;

  payee_signed_name: string | null;
  payee_signature_url: string | null;
  payee_signed_at: string | null;

  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Hist = {
  id: string;
  action_type: string | null;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  actor_name: string | null;
  actor_role: string | null;
  actor_signature_url: string | null;
  created_at: string;
};

function normalize(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z]/g, "");
}

function naira(n: number | null | undefined) {
  return "₦" + Number(n || 0).toLocaleString();
}

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

function amountToWords(n: number | null | undefined) {
  const num = Math.round(Number(n || 0));

  if (num === 0) return "Zero Naira Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function belowThousand(x: number) {
    let words = "";

    if (x >= 100) {
      words += ones[Math.floor(x / 100)] + " Hundred";
      x %= 100;
      if (x) words += " and ";
    }

    if (x >= 20) {
      words += tens[Math.floor(x / 10)];
      x %= 10;
      if (x) words += "-" + ones[x];
    } else if (x > 0) {
      words += ones[x];
    }

    return words;
  }

  const parts: string[] = [];
  let remaining = num;

  const billions = Math.floor(remaining / 1_000_000_000);
  if (billions) {
    parts.push(belowThousand(billions) + " Billion");
    remaining %= 1_000_000_000;
  }

  const millions = Math.floor(remaining / 1_000_000);
  if (millions) {
    parts.push(belowThousand(millions) + " Million");
    remaining %= 1_000_000;
  }

  const thousands = Math.floor(remaining / 1000);
  if (thousands) {
    parts.push(belowThousand(thousands) + " Thousand");
    remaining %= 1000;
  }

  if (remaining) parts.push(belowThousand(remaining));

  return parts.join(", ") + " Naira Only";
}

function getPublicSignatureUrl(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return null;

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:image/") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const cleaned = raw.replace(/^signatures\//, "").replace(/^\/+/, "");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!base) return null;

  return `${base}/storage/v1/object/public/signatures/${cleaned}`;
}

function categoryLabel(v: VoucherDetail | null) {
  const rt = normalize(v?.request_type);
  const pc = normalize(v?.personal_category);

  if (rt === "official") return "Official Request";
  if (rt === "personal" && pc === "fund") return "Personal Fund Request";
  return v?.request_type || "—";
}

export default function PaymentVoucherPrintPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [voucher, setVoucher] = useState<VoucherDetail | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);

  async function load() {
    setLoading(true);
    setMsg(null);

    if (!id) {
      setMsg("Invalid voucher ID.");
      setLoading(false);
      return;
    }

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return;
    }

    const [detailRes, histRes] = await Promise.all([
      supabase.rpc("get_payment_voucher_detail", { p_voucher_id: id }),
      supabase.rpc("get_payment_voucher_history", { p_voucher_id: id }),
    ]);

    if (detailRes.error) {
      setMsg("Failed to load voucher: " + detailRes.error.message);
      setLoading(false);
      return;
    }

    const row = Array.isArray(detailRes.data)
      ? (detailRes.data[0] as VoucherDetail | undefined)
      : (detailRes.data as VoucherDetail | undefined);

    if (!row) {
      setMsg("Payment voucher not found.");
      setLoading(false);
      return;
    }

    setVoucher(row);

    if (!histRes.error) {
      setHistory((histRes.data || []) as Hist[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    document.title = voucher?.voucher_no || "payment-voucher";
  }, [voucher?.voucher_no]);

  const sigPrepared = useMemo(
    () => getPublicSignatureUrl(voucher?.prepared_signature_url),
    [voucher?.prepared_signature_url]
  );

  const sigChecked = useMemo(
    () => getPublicSignatureUrl(voucher?.checked_signature_url),
    [voucher?.checked_signature_url]
  );

  const sigAuthorized = useMemo(
    () => getPublicSignatureUrl(voucher?.authorized_signature_url),
    [voucher?.authorized_signature_url]
  );

  const sigCheque = useMemo(
    () => getPublicSignatureUrl(voucher?.cheque_signed_signature_url),
    [voucher?.cheque_signed_signature_url]
  );

  const sigCounter = useMemo(
    () => getPublicSignatureUrl(voucher?.cheque_counter_signed_signature_url),
    [voucher?.cheque_counter_signed_signature_url]
  );

  const sigPayee = useMemo(
    () => getPublicSignatureUrl(voucher?.payee_signature_url),
    [voucher?.payee_signature_url]
  );

  const ready = useMemo(() => {
    if (!voucher) return false;
    return !!voucher.voucher_no && !!voucher.payee_name && Number(voucher.amount || 0) > 0;
  }, [voucher]);

  function handlePrint() {
    if (!ready) {
      setMsg("Voucher is not ready for printing. Please confirm voucher data.");
      return;
    }

    window.print();
  }

  const latestHistory = useMemo(() => history.slice(-4), [history]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 text-slate-700 shadow-sm">
          Preparing payment voucher...
        </div>
      </main>
    );
  }

  if (!voucher) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">Payment Voucher</div>

          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {msg || "Payment voucher not found."}
          </div>

          <button
            onClick={() => router.push("/payment-vouchers")}
            className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to Vouchers
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4">
      <style>{`
        @page {
          size: A4;
          margin: 7mm;
        }

        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .voucher-sheet {
            box-shadow: none !important;
            border: 1px solid #000 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[820px]">
        <div className="no-print mb-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/payment-vouchers")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back to Vouchers
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/payment-vouchers/${voucher.id}`)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Manage
            </button>

            <button
              onClick={handlePrint}
              disabled={!ready}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>

        {msg && (
          <div className="no-print mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {msg}
          </div>
        )}

        <div className="voucher-sheet mx-auto w-full border border-black bg-white px-[18px] py-[14px] text-black shadow-sm">
          <div className="grid grid-cols-[80px_1fr_160px] items-start gap-3">
            <div className="flex justify-start">
              <Image
                src="/iet-logo.png"
                alt="IET Logo"
                width={62}
                height={62}
                className="h-[62px] w-auto object-contain"
                priority
              />
            </div>

            <div className="text-center">
              <div className="text-[18px] font-black uppercase leading-none tracking-tight">
                Islamic Education Trust
              </div>
              <div className="mt-1 text-[10px] font-semibold leading-tight">
                IW2, Ilmi Avenue Intermediate Housing Estate, PMB 229
              </div>
              <div className="text-[10px] font-semibold leading-tight">
                Minna, Niger State - Nigeria
              </div>
              <div className="mt-2 inline-block border-2 border-black px-8 py-1 text-[15px] font-black uppercase tracking-wide">
                Payment Voucher
              </div>
            </div>

            <div className="space-y-1 text-[9px] font-bold">
              <BoxLine label="Voucher No:" value={voucher.voucher_no} />
              <BoxLine label="Date:" value={formatDate(voucher.created_at)} />
              <BoxLine label="Status:" value={voucher.status || ""} />
            </div>
          </div>

          <div className="mt-3 h-[2px] w-full bg-black" />

          <div className="mt-3 grid grid-cols-12 gap-x-3 gap-y-2">
            <LineField label="Payee:" value={voucher.payee_name || ""} className="col-span-7" />
            <LineField label="Request No:" value={voucher.request_no || ""} className="col-span-5" />

            <LineField label="Department:" value={voucher.dept_name || ""} className="col-span-7" />
            <LineField label="Category:" value={categoryLabel(voucher)} className="col-span-5" />

            <LineField
              label="Subhead:"
              value={
                voucher.subhead_id
                  ? `${voucher.subhead_code || ""} ${voucher.subhead_name || ""}`.trim()
                  : "N/A"
              }
              className="col-span-12"
            />
          </div>

          <div className="mt-3 rounded-sm border border-black">
            <div className="grid grid-cols-12 border-b border-black bg-slate-100 text-[9px] font-black uppercase">
              <div className="col-span-8 border-r border-black px-2 py-1">Particulars / Description</div>
              <div className="col-span-4 px-2 py-1 text-right">Amount</div>
            </div>

            <div className="grid grid-cols-12 min-h-[82px] text-[10px] font-semibold">
              <div className="col-span-8 border-r border-black px-2 py-2">
                <div className="whitespace-pre-wrap leading-tight">
                  {voucher.narration || "Payment voucher"}
                </div>
              </div>

              <div className="col-span-4 px-2 py-2 text-right text-[12px] font-black">
                {naira(voucher.amount)}
              </div>
            </div>

            <div className="grid grid-cols-12 border-t border-black text-[10px] font-black">
              <div className="col-span-8 border-r border-black px-2 py-1 text-right uppercase">
                Total
              </div>
              <div className="col-span-4 px-2 py-1 text-right">{naira(voucher.amount)}</div>
            </div>
          </div>

          <div className="mt-2 rounded-sm border border-black px-2 py-1">
            <div className="text-[8px] font-black uppercase">Amount in Words</div>
            <div className="mt-0.5 text-[10px] font-bold leading-tight">
              {amountToWords(voucher.amount)}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-12 gap-2">
            <SmallBox label="Cheque No" value={voucher.cheque_no || ""} className="col-span-4" />
            <SmallBox label="Cheque Date" value={formatDate(voucher.cheque_date)} className="col-span-4" />
            <SmallBox label="Bank" value={voucher.bank_name || ""} className="col-span-4" />
          </div>

          <div className="mt-3 rounded-sm border border-black">
            <div className="border-b border-black bg-slate-100 px-2 py-1 text-[9px] font-black uppercase">
              Certification and Approval
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2">
              <SignatureBox
                title="Prepared by"
                name={voucher.prepared_by_name || ""}
                sigUrl={sigPrepared}
                date={formatDate(voucher.prepared_at)}
              />

              <SignatureBox
                title="Checked by"
                name={voucher.checked_by_name || ""}
                sigUrl={sigChecked}
                date={formatDate(voucher.checked_at)}
              />

              <SignatureBox
                title="Authorized by"
                name={voucher.authorized_by_name || ""}
                sigUrl={sigAuthorized}
                date={formatDate(voucher.authorized_at)}
              />

              <SignatureBox
                title="Cheque Signed by"
                name={voucher.cheque_signed_by_name || ""}
                sigUrl={sigCheque}
                date={formatDate(voucher.cheque_signed_at)}
              />

              <SignatureBox
                title="Counter Signed by"
                name={voucher.cheque_counter_signed_by_name || ""}
                sigUrl={sigCounter}
                date={formatDate(voucher.cheque_counter_signed_at)}
              />

              <SignatureBox
                title="Received by Payee"
                name={voucher.payee_signed_name || voucher.payee_name || ""}
                sigUrl={sigPayee}
                date={formatDate(voucher.payee_signed_at)}
              />
            </div>
          </div>

          {latestHistory.length > 0 && (
            <div className="mt-3 rounded-sm border border-black">
              <div className="border-b border-black bg-slate-100 px-2 py-1 text-[9px] font-black uppercase">
                Voucher Trail
              </div>

              <div className="grid grid-cols-4 text-[8px] font-bold">
                {latestHistory.map((h) => (
                  <div key={h.id} className="border-r border-black px-2 py-1 last:border-r-0">
                    <div>{h.action_type || "Action"}</div>
                    <div className="font-semibold">{h.actor_name || "—"}</div>
                    <div className="font-medium">{formatDate(h.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[8px] font-semibold">
            <div>Generated by ReqGen • Official IET Payment Voucher</div>
            <div className="italic">Building Bridges</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function BoxLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[70px_1fr] items-center border border-black">
      <div className="border-r border-black bg-slate-100 px-1 py-1">{label}</div>
      <div className="px-1 py-1">{value}</div>
    </div>
  );
}

function LineField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-1 ${className || ""}`}>
      <div className="shrink-0 text-[9px] font-black">{label}</div>
      <div className="min-w-0 flex-1 border-b border-black px-1 pb-[1px] text-[9px] font-bold leading-tight break-words">
        {value}
      </div>
    </div>
  );
}

function SmallBox({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`border border-black ${className || ""}`}>
      <div className="border-b border-black bg-slate-100 px-2 py-1 text-[8px] font-black uppercase">
        {label}
      </div>
      <div className="min-h-[22px] px-2 py-1 text-[9px] font-bold">{value || " "}</div>
    </div>
  );
}

function SignatureBox({
  title,
  name,
  sigUrl,
  date,
}: {
  title: string;
  name: string;
  sigUrl: string | null;
  date: string;
}) {
  return (
    <div>
      <div className="text-[8px] font-black uppercase">{title}</div>

      <div className="mt-1 grid grid-cols-[1fr_90px_70px] items-end gap-2">
        <div className="border-b border-black pb-[1px] text-[8.5px] font-bold">
          {name || " "}
        </div>

        <div className="relative h-[20px] border-b border-black">
          {sigUrl ? (
            <img
              src={sigUrl}
              alt="signature"
              className="absolute bottom-0 left-1/2 h-[15px] max-w-[90%] -translate-x-1/2 object-contain"
            />
          ) : null}
        </div>

        <div className="border-b border-black pb-[1px] text-center text-[8px] font-bold">
          {date || " "}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_90px_70px] gap-2 text-center text-[6.8px] font-semibold text-slate-600">
        <div>Name</div>
        <div>Signature</div>
        <div>Date</div>
      </div>
    </div>
  );
}