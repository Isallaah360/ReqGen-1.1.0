import { redirect } from "next/navigation";

/** v4.6.3: the old Finance Audit workspace is replaced by Finance Integrity and the Transaction Centre. */
export default function RetiredPage() {
  redirect("/finance/integrity");
}
