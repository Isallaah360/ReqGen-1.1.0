import { redirect } from "next/navigation";

/** v3.1.10: retired duplicate page — its work lives at /finance/audit. */
export default function RetiredPage() {
  redirect("/finance/audit");
}
