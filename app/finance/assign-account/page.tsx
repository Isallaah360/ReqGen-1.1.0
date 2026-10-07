import { redirect } from "next/navigation";

/** v3.1.10: retired duplicate page — its work lives at /finance/manage-accounts/assign. */
export default function RetiredPage() {
  redirect("/finance/manage-accounts/assign");
}
