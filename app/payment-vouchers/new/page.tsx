import { redirect } from "next/navigation";

export default function Page() {
  redirect("/payment-vouchers/centre?create=1");
}
