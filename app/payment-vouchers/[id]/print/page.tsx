"use client";

import { useParams } from "next/navigation";
import { VoucherPrintView } from "./VoucherPrintView";

/** Payment voucher print (mock-up 54): the approved v3 template on one A4 page. */
export default function PaymentVoucherPrintPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  return <VoucherPrintView voucherId={id} />;
}
