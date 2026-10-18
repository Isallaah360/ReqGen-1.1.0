import { redirect } from "next/navigation";

/** v4.6.3: payment vouchers live in Payment Vouchers. */
export default function RetiredPage() {
  redirect("/payment-vouchers");
}
