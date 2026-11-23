import { Laptop, Wallet } from "lucide-react";
import { db, WEBSITE } from "../lib/core";
import { useOnline, useSaved } from "../lib/data";
import { naira, day } from "../lib/text";
import { Body, Cell, Chip, Empty, Head, Note, Skeleton, Updated } from "../ui";
import { useApp } from "../App";

type PV = { id: string; voucher_no: string | null; request_no: string | null; payee_name: string | null; amount: number | null; disbursement_mode: string | null; status: string | null; signing_stage: string | null; created_at: string | null };

/** Vouchers waiting for my signature. Signing stays on the website (laptop job). */
export default function Vouchers() {
  const { me } = useApp();
  const online = useOnline();
  const { data, at, loading, reload } = useSaved<PV[]>(`pv:${me.id}`, async () => {
    const { data: rows, error } = await (await db()).rpc("get_payment_vouchers_assigned_to_me");
    if (error) throw new Error(error.message);
    return (rows || []) as PV[];
  });
  return (
    <>
      <Head title="Vouchers" />
      <Body onRefresh={reload}>
        {loading && !data ? <Skeleton /> : data && data.length ? (
          <div className="grp">
            {data.map((v) => <Cell key={v.id} icon={<Wallet size={18} />} iconTone="wa" title={v.voucher_no || "Voucher"} sub={`${v.payee_name || ""}, ${naira(v.amount)}, ${day(v.created_at)}`} right={<Chip tone="wa">{v.signing_stage || v.status || "To sign"}</Chip>} />)}
          </div>
        ) : <Empty icon={<Wallet size={28} />} title="No vouchers for you" text="Payment vouchers waiting for your signature show here." />}
        <Note tone="mu" icon={<Laptop size={16} />}>Vouchers are checked and signed in Finance on the website, on a laptop.</Note>
        <a className="btn bs block" href={`${WEBSITE}/finance`} target="_blank" rel="noreferrer"><Laptop size={18} />Open Finance on the website</a>
        <Updated at={at} offline={!online} />
      </Body>
    </>
  );
}
