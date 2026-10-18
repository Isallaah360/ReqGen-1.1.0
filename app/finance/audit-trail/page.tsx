import { redirect } from "next/navigation";

/** v4.6.3: retired duplicate page — its work lives in Finance Integrity. */
export default function RetiredPage() {
  redirect("/finance/integrity");
}
