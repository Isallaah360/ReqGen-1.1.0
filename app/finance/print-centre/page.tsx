import { redirect } from "next/navigation";

/** v3.1.10: retired duplicate page — its work lives at /payment-vouchers/print-centre. */
export default function RetiredPage() {
  redirect("/payment-vouchers/print-centre");
}
