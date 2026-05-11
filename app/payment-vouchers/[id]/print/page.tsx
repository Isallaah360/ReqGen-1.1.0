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

  prepared_by: string | null;
  prepared_by_name: string | null;
  prepared_signature_url: string | null;
  prepared_at: string | null;

  checked_by: string | null;
  checked_by_name: string | null;
  checked_signature_url: string | null;
  checked_at: string | null;

  authorized_by: string | null;
  authorized_by_name: string | null;
  authorized_signature_url: string | null;
  authorized_at: string | null;

  cheque_no: string | null;
  cheque_date: string | null;
  bank_name: string | null;

  cheque_signed_by: string | null;
  cheque_signed_by_name: string | null;
  cheque_signed_signature_url: string | null;
  cheque_signed_at: string | null;

  cheque_counter_signed_by: string | null;
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

  current_signing_owner: string | null;
  signing_stage: string | null;

  is_multi_request: boolean | null;
  item_count: number | null;
  total_amount: number | null;
  voucher_scope: string | null;

  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type VoucherItem = {
  id: string;
  voucher_id: string;
  request_id: string;
  request_no: string | null;
  request_type: string | null;
  personal_category: string | null;
  title: string | null;
  details: string | null;
  amount: number | null;
  dept_id: string | null;
  dept_name: string | null;
  subhead_id: string | null;
  subhead_code: string | null;
  subhead_name: string | null;
  requester_name: string | null;
  created_at: string | null;
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
  if (rt === "personal" && pc === "nonfund") return "Personal Non-Fund Request";

  return v?.request_type || "—";
}

function itemParticulars(item: VoucherItem) {
  const req = item.request_no || "Request";
  const title = item.title || "Payment request";
  const subhead = item.subhead_id
    ? `${item.subhead_code || ""} ${item.subhead_name || ""}`.trim()
    : "";

  if (subhead) return `${req} — ${title}\nSubhead: ${subhead}`;

  return `${req} — ${title}`;
}

export default function PaymentVoucherPrintPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<VoucherDetail | null>(null);
  const [items, setItems] = useState<VoucherItem[]>([]);

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

    const [detailRes, itemRes] = await Promise.all([
      supabase.rpc("get_payment_voucher_detail", {
        p_voucher_id: id,
      }),
      supabase.rpc("get_payment_voucher_items", {
        p_voucher_id: id,
      }),
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

    if (itemRes.error) {
      setMsg("Failed to load voucher items: " + itemRes.error.message);
      setItems([]);
    } else {
      setItems((itemRes.data || []) as VoucherItem[]);
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

  const totalAmount = useMemo(() => {
    if (items.length > 0) {
      return items.reduce((a, item) => a + Number(item.amount || 0), 0);
    }

    return Number(voucher?.total_amount || voucher?.amount || 0);
  }, [items, voucher?.total_amount, voucher?.amount]);

  const printableItems = useMemo(() => {
    if (items.length > 0) return items;

    if (!voucher) return [];

    return [
      {
        id: voucher.id,
        voucher_id: voucher.id,
        request_id: voucher.request_id,
        request_no: voucher.request_no,
        request_type: voucher.request_type,
        personal_category: voucher.personal_category,
        title: voucher.narration || "Payment voucher",
        details: voucher.narration || "",
        amount: voucher.amount || voucher.total_amount || 0,
        dept_id: voucher.dept_id,
        dept_name: voucher.dept_name,
        subhead_id: voucher.subhead_id,
        subhead_code: voucher.subhead_code,
        subhead_name: voucher.subhead_name,
        requester_name: voucher.payee_name,
        created_at: voucher.created_at,
      } as VoucherItem,
    ];
  }, [items, voucher]);

  const ready = useMemo(() => {
    if (!voucher) return false;
    return !!voucher.voucher_no && !!voucher.payee_name && totalAmount > 0;
  }, [voucher, totalAmount]);

  const finalPrintReady = useMemo(() => {
    if (!voucher) return false;

    if (!isCheque) return true;

    return (
      voucher.status === "Counter Signed" ||
      voucher.status === "Paid" ||
      (!!voucher.cheque_signed_signature_url && !!voucher.cheque_counter_signed_signature_url)
    );
  }, [voucher, isCheque]);

  function handlePrint() {
    if (!ready) {
      setMsg("Voucher is not ready for printing. Please confirm voucher data.");
      return;
    }

    if (isCheque && !finalPrintReady) {
      setMsg("Final printing is blocked until Cheque Signed and Counter Signed are completed.");
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
          html,
          body {
            width: 210mm;
            min-height: 297mm;
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
              disabled={!ready || (isCheque && !finalPrintReady)}
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

        {isCheque && !finalPrintReady && (
          <div className="no-print mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Final printing is blocked until Cheque Signed and Counter Signed are completed.
          </div>
        )}

        <div className="voucher-sheet mx-auto w-full border-2 border-black bg-white px-[15px] py-[11px] text-black shadow-sm">
          <div className="grid grid-cols-[70px_1fr_188px] items-start gap-3">
            <div>
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
              <div className="text-[19px] font-black uppercase leading-none tracking-tight">
                Islamic Education Trust
              </div>
              <div className="mt-1 text-[10.5px] font-bold leading-tight">
                IW2, Ilmi Avenue Intermediate Housing Estate, PMB 229
              </div>
              <div className="text-[10.5px] font-bold leading-tight">
                Minna, Niger State - Nigeria
              </div>
              <div className="mt-1.5 text-[17px] font-black uppercase underline">
                Payment Voucher
              </div>
            </div>

            <div className="text-[9.5px] font-bold">
              <TopBox label="PV No." value={voucher.voucher_no} />
              <TopBox label="Date" value={formatDate(voucher.created_at)} />
              <TopBox label="Status" value={voucher.status || ""} />
            </div>
          </div>

          <div className="mt-2 h-[2px] bg-black" />

          <div className="mt-2 grid grid-cols-12 gap-x-3 gap-y-1.5">
            <LineField label="Payee:" value={voucher.payee_name || ""} className="col-span-7" />
            <LineField
              label="Request:"
              value={
                voucher.voucher_scope === "Multiple"
                  ? `${voucher.item_count || printableItems.length} Requests`
                  : voucher.request_no || ""
              }
              className="col-span-5"
            />

            <LineField label="Department:" value={voucher.dept_name || ""} className="col-span-7" />
            <LineField label="Type:" value={categoryLabel(voucher)} className="col-span-5" />

            <LineField
              label="Subhead:"
              value={
                voucher.voucher_scope === "Multiple"
                  ? "Multiple / As listed below"
                  : voucher.subhead_id
                  ? `${voucher.subhead_code || ""} ${voucher.subhead_name || ""}`.trim()
                  : ""
              }
              className="col-span-12"
            />
          </div>

          <div className="mt-2 border-2 border-black">
            <div className="grid grid-cols-12 border-b-2 border-black bg-slate-100 text-[9.2px] font-black uppercase">
              <div className="col-span-1 border-r-2 border-black px-1 py-1 text-center">
                No
              </div>
              <div className="col-span-8 border-r-2 border-black px-2 py-1">
                Details / Particulars
              </div>
              <div className="col-span-3 px-2 py-1 text-right">Amount</div>
            </div>

            <div className="min-h-[82px]">
              {printableItems.slice(0, 10).map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 border-b border-black text-[9.1px] font-bold last:border-b-0"
                >
                  <div className="col-span-1 border-r-2 border-black px-1 py-[4px] text-center">
                    {index + 1}
                  </div>

                  <div className="col-span-8 border-r-2 border-black px-2 py-[4px]">
                    <div className="whitespace-pre-wrap leading-[1.18]">
                      {itemParticulars(item)}
                    </div>
                  </div>

                  <div className="col-span-3 px-2 py-[4px] text-right text-[9.6px] font-black">
                    {naira(item.amount)}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-12 border-t-2 border-black text-[10.5px] font-black">
              <div className="col-span-9 border-r-2 border-black px-2 py-1 text-right uppercase">
                Total
              </div>
              <div className="col-span-3 px-2 py-1 text-right">
                {naira(totalAmount)}
              </div>
            </div>
          </div>

          <div className="mt-2 border-2 border-black px-2 py-1">
            <div className="text-[9px] font-black uppercase">Amount in Words</div>
            <div className="text-[10.2px] font-bold leading-tight">
              {amountToWords(totalAmount)}
            </div>
          </div>

          <div className="mt-2 border-2 border-black">
            <div className="border-b-2 border-black bg-slate-100 px-2 py-1 text-[9.2px] font-black uppercase">
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
                    value={voucher.cheque_counter_signed_by_name || ""}
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
            <div className="border-b-2 border-black bg-slate-100 px-2 py-1 text-[9.2px] font-black uppercase">
              Certification / Approval / Receipt
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-3 px-3 py-2.5">
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
                name={voucher.cheque_counter_signed_by_name || ""}
                sigUrl={sigCounterSigned}
                date={formatDate(voucher.cheque_counter_signed_at)}
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[8.6px] font-semibold">
            <div>
              Official IET Payment Voucher • Generated by ReqGen
              {voucher.voucher_scope === "Multiple" ? " • Combined PV" : ""}
            </div>
            <div className="italic">Building Bridges</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function TopBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[54px_1fr] border border-black">
      <div className="border-r border-black bg-slate-100 px-1 py-[4px]">{label}</div>
      <div className="px-1 py-[4px]">{value}</div>
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
      <div className="shrink-0 text-[9.6px] font-black">{label}</div>
      <div className="min-w-0 flex-1 border-b border-black px-1 pb-[1px] text-[9.6px] font-bold leading-tight break-words">
        {value}
      </div>
    </div>
  );
}

function BlankBox({ label, className }: { label: string; className?: string }) {
  return (
    <div className={`border border-black ${className || ""}`}>
      <div className="border-b border-black bg-slate-100 px-2 py-[4px] text-[8.5px] font-black uppercase">
        {label}
      </div>
      <div className="h-[23px]" />
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
      <div className="border-b border-black bg-slate-100 px-2 py-[4px] text-[8.5px] font-black uppercase">
        {label}
      </div>
      <div className="min-h-[23px] px-2 py-[4px] text-[9.2px] font-bold leading-tight">
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
      <div className="text-[8.8px] font-black uppercase">{title}</div>

      <div className="mt-1 grid grid-cols-[1fr_92px_70px] items-end gap-2">
        <div className="border-b border-black pb-[2px] text-[9.2px] font-bold leading-tight">
          {name || " "}
        </div>

        <div className="relative h-[25px] border-b border-black">
          {sigUrl ? (
            <img
              src={sigUrl}
              alt="signature"
              className="absolute bottom-[2px] left-1/2 h-[21px] max-w-[96%] -translate-x-1/2 object-contain"
            />
          ) : null}
        </div>

        <div className="border-b border-black pb-[2px] text-center text-[8.8px] font-bold">
          {date || " "}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_92px_70px] gap-2 text-center text-[7.2px] font-semibold text-slate-600">
        <div>Name</div>
        <div>Signature</div>
        <div>Date</div>
      </div>
    </div>
  );
}