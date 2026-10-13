import { redirect } from "next/navigation";

/** v4.4: annual statements live in Reports › Finance Statements. */
export default function Page() {
  redirect("/reports/finance-statements?tab=annual");
}
