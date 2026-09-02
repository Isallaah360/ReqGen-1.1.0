import { redirect } from "next/navigation";

export default function Page() {
  redirect("/payment-vouchers?create=1");
}
