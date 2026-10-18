import { redirect } from "next/navigation";

/** v4.6.3: retired duplicate page — its work lives in the Transaction Centre. */
export default function RetiredPage() {
  redirect("/finance/transactions-centre");
}
