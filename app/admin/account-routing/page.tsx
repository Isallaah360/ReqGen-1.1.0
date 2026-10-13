import { redirect } from "next/navigation";

/** v4.6: the paying account of each department lives in Routing Engine › Accounts (mock-up 86). */
export default function RetiredPage() {
  redirect("/admin/routing?tab=accounts");
}
