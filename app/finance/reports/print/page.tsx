import { redirect } from "next/navigation";

/** v3.1.10: retired duplicate page — its work lives at /finance/reports. */
export default function RetiredPage() {
  redirect("/finance/reports");
}
