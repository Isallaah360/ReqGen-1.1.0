import { redirect } from "next/navigation";

/** v4.4: one place per function — finance reports live in Reports › Finance Statements. */
export default function Page() {
  redirect("/reports/finance-statements");
}
