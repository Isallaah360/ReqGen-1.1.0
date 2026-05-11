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

  disbursement_mode: string | null;
  transfer_account_name: string | null;
  transfer_account_number: string | null;
  transfer_bank_name: string | null;
  cash_payee_name: string | null;
  counter_signatory_name: string | null;

  status: string | null;
  created_at: string | null;
  updated_at: string | null;
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

    const { data, error } = await supabase.rpc("get_payment_voucher_detail", {
      p_voucher_id: id,
    });

    if (error) {
      setMsg("Failed to load voucher: " + error.message);
      setLoading(false);
      return;
    }

    const row = Array.isArray(data)
      ? (data[0] as VoucherDetail | undefined)
      : (data as VoucherDetail | undefined);

    if (!row) {
      setMsg("Payment voucher not found.");
      setLoading(false);
      return;
    }

    setVoucher(row);
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

  const sigReceived = useMemo(
    () => getPublicSignatureUrl(voucher?.payee_signature_url),
    [voucher?.payee_signature_url]
  );

  const sigChequeSigned = useMemo(
    () => getPublicSignatureUrl(voucher?.cheque_signed_signature_url),
    [voucher?.cheque_signed_signature_url]
  );

  const sigCounterSigned = useMemo(
    () => getPublicSignatureUrl(voucher?.cheque_counter_signed_signature_url),
    [voucher?.cheque_counter_signed_signature_url]
  );

  const isCheque = normalize(voucher?.disbursement_mode) === "cheque";
  const isTransfer = normalize(voucher?.disbursement_mode) === "transfer";
  const isCash = normalize(voucher?.disbursement_mode) === "cash";

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
          margin: 6mm;
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

        <div className="voucher-sheet mx-auto w-full border-2 border-black bg-white px-[16px] py-[12px] text-black shadow-sm">
          <div className="grid grid-cols-[72px_1fr_178px] items-start gap-3">
            <div>
              <Image
                src="/iet-logo.png"
                alt="IET Logo"
                width={60}
                height={60}
                className="h-[60px] w-auto object-contain"
                priority
              />
            </div>

            <div className="text-center">
              <div className="text-[18px] font-black uppercase leading-none tracking-tight">
                Islamic Education Trust
              </div>
              <div className="mt-1 text-[9.5px] font-bold leading-tight">
                IW2, Ilmi Avenue Intermediate Housing Estate, PMB 229
              </div>
              <div className="text-[9.5px] font-bold leading-tight">
                Minna, Niger State - Nigeria
              </div>
              <div className="mt-1.5 text-[16px] font-black uppercase underline">
                Payment Voucher
              </div>
            </div>

            <div className="text-[8.5px] font-bold">
              <TopBox label="PV No." value={voucher.voucher_no} />
              <TopBox label="Date" value={formatDate(voucher.created_at)} />
              <TopBox label="Status" value={voucher.status || ""} />
            </div>
          </div>

          <div className="mt-2 h-[2px] bg-black" />

          <div className="mt-2 grid grid-cols-12 gap-x-3 gap-y-1.5">
            <LineField label="Payee:" value={voucher.payee_name || ""} className="col-span-7" />
            <LineField label="Request No:" value={voucher.request_no || ""} className="col-span-5" />

            <LineField label="Department:" value={voucher.dept_name || ""} className="col-span-7" />
            <LineField label="Type:" value={categoryLabel(voucher)} className="col-span-5" />

            <LineField
              label="Subhead:"
              value={
                voucher.subhead_id
                  ? `${voucher.subhead_code || ""} ${voucher.subhead_name || ""}`.trim()
                  : ""
              }
              className="col-span-12"
            />
          </div>

          <div className="mt-2 border-2 border-black">
            <div className="grid grid-cols-12 border-b-2 border-black bg-slate-100 text-[9px] font-black uppercase">
              <div className="col-span-8 border-r-2 border-black px-2 py-1">
                Details / Particulars
              </div>
              <div className="col-span-4 px-2 py-1 text-right">Amount</div>
            </div>

            <div className="grid min-h-[70px] grid-cols-12 text-[9.5px] font-bold">
              <div className="col-span-8 border-r-2 border-black px-2 py-2">
                <div className="whitespace-pre-wrap leading-tight">
                  {voucher.narration || "Payment voucher"}
                </div>
              </div>

              <div className="col-span-4 px-2 py-2 text-right text-[12px] font-black">
                {naira(voucher.amount)}
              </div>
            </div>

            <div className="grid grid-cols-12 border-t-2 border-black text-[10px] font-black">
              <div className="col-span-8 border-r-2 border-black px-2 py-1 text-right uppercase">
                Total
              </div>
              <div className="col-span-4 px-2 py-1 text-right">
                {naira(voucher.amount)}
              </div>
            </div>
          </div>

          <div className="mt-2 border-2 border-black px-2 py-1">
            <div className="text-[8px] font-black uppercase">Amount in Words</div>
            <div className="text-[9.5px] font-bold leading-tight">
              {amountToWords(voucher.amount)}
            </div>
          </div>

          <div className="mt-2 border-2 border-black">
            <div className="border-b-2 border-black bg-slate-100 px-2 py-1 text-[8.5px] font-black uppercase">
              Disbursement Details
            </div>

            <div className="grid grid-cols-12 gap-2 px-2 py-2">
              <FilledBox
                label="Mode"
                value={voucher.disbursement_mode || ""}
                className="col-span-4"
              />

              {isTransfer && (
                <>
                  <FilledBox
                    label="Account Number"
                    value={voucher.transfer_account_number || ""}
                    className="col-span-4"
                  />
                  <FilledBox
                    label="Bank"
                    value={voucher.transfer_bank_name || ""}
                    className="col-span-4"
                  />
                  <FilledBox
                    label="Account Name"
                    value={voucher.transfer_account_name || ""}
                    className="col-span-12"
                  />
                </>
              )}

              {isCash && (
                <>
                  <FilledBox
                    label="Payee Name"
                    value={voucher.cash_payee_name || voucher.payee_name || ""}
                    className="col-span-8"
                  />
                  <BlankBox label="Payee Signature / Date" className="col-span-4" />
                </>
              )}

              {isCheque && (
                <>
                  <FilledBox
                    label="Cheque No."
                    value={voucher.cheque_no || ""}
                    className="col-span-4"
                  />
                  <FilledBox
                    label="Cheque Date"
                    value={formatDate(voucher.cheque_date)}
                    className="col-span-4"
                  />
                  <FilledBox
                    label="Bank"
                    value={voucher.bank_name || ""}
                    className="col-span-4"
                  />
                  <FilledBox
                    label="Cheque Signed By"
                    value={voucher.cheque_signed_by_name || ""}
                    className="col-span-6"
                  />
                  <FilledBox
                    label="Counter Signed By"
                    value={voucher.cheque_counter_signed_by_name || voucher.counter_signatory_name || ""}
                    className="col-span-6"
                  />
                </>
              )}

              {!isTransfer && !isCash && !isCheque && (
                <>
                  <BlankBox label="Account Number / Cheque No." className="col-span-4" />
                  <BlankBox label="Bank" className="col-span-4" />
                  <BlankBox label="Account Name / Payee Name" className="col-span-12" />
                </>
              )}
            </div>
          </div>

          <div className="mt-2 border-2 border-black">
            <div className="border-b-2 border-black bg-slate-100 px-2 py-1 text-[8.5px] font-black uppercase">
              Certification / Approval / Receipt
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2">
              <SignatureBox
                title="Prepared By"
                name={voucher.prepared_by_name || ""}
                sigUrl={sigPrepared}
                date={formatDate(voucher.prepared_at)}
              />

              <SignatureBox
                title="Checked By"
                name={voucher.checked_by_name || ""}
                sigUrl={sigChecked}
                date={formatDate(voucher.checked_at)}
              />

              <SignatureBox
                title="Authorized By"
                name={voucher.authorized_by_name || ""}
                sigUrl={sigAuthorized}
                date={formatDate(voucher.authorized_at)}
              />

              <SignatureBox
                title="Received By"
                name={voucher.payee_signed_name || voucher.payee_name || ""}
                sigUrl={sigReceived}
                date={formatDate(voucher.payee_signed_at)}
              />

              <SignatureBox
                title="Cheque Signed By"
                name={voucher.cheque_signed_by_name || ""}
                sigUrl={sigChequeSigned}
                date={formatDate(voucher.cheque_signed_at)}
              />

              <SignatureBox
                title="Counter Signed By"
                name={voucher.cheque_counter_signed_by_name || voucher.counter_signatory_name || ""}
                sigUrl={sigCounterSigned}
                date={formatDate(voucher.cheque_counter_signed_at)}
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[8px] font-semibold">
            <div>Official IET Payment Voucher • Generated by ReqGen</div>
            <div className="italic">Building Bridges</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function TopBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[48px_1fr] border border-black">
      <div className="border-r border-black bg-slate-100 px-1 py-[3px]">{label}</div>
      <div className="px-1 py-[3px]">{value}</div>
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
      <div className="shrink-0 text-[8.5px] font-black">{label}</div>
      <div className="min-w-0 flex-1 border-b border-black px-1 pb-[1px] text-[8.5px] font-bold leading-tight break-words">
        {value}
      </div>
    </div>
  );
}

function BlankBox({ label, className }: { label: string; className?: string }) {
  return (
    <div className={`border border-black ${className || ""}`}>
      <div className="border-b border-black bg-slate-100 px-2 py-[3px] text-[7.5px] font-black uppercase">
        {label}
      </div>
      <div className="h-[20px]" />
    </div>
  );
}

function FilledBox({
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
      <div className="border-b border-black bg-slate-100 px-2 py-[3px] text-[7.5px] font-black uppercase">
        {label}
      </div>
      <div className="min-h-[20px] px-2 py-[3px] text-[8.2px] font-bold leading-tight">
        {value || " "}
      </div>
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
      <div className="text-[7.8px] font-black uppercase">{title}</div>

      <div className="mt-1 grid grid-cols-[1fr_82px_62px] items-end gap-2">
        <div className="border-b border-black pb-[1px] text-[8.2px] font-bold">
          {name || " "}
        </div>

        <div className="relative h-[18px] border-b border-black">
          {sigUrl ? (
            <img
              src={sigUrl}
              alt="signature"
              className="absolute bottom-0 left-1/2 h-[14px] max-w-[90%] -translate-x-1/2 object-contain"
            />
          ) : null}
        </div>

        <div className="border-b border-black pb-[1px] text-center text-[7.8px] font-bold">
          {date || " "}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_82px_62px] gap-2 text-center text-[6.5px] font-semibold text-slate-600">
        <div>Name</div>
        <div>Signature</div>
        <div>Date</div>
      </div>
    </div>
  );
}