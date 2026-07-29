import { redirect } from "next/navigation";

export default function MonthlyFinanceReportsRedirect() {
  redirect("/reports#finance-and-workflow");
}
