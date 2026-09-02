import { redirect } from "next/navigation";

export default function Page() {
  redirect("/payment-vouchers?view=history");
}
