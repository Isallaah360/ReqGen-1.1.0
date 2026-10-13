import { redirect } from "next/navigation";

/** v4.6: one Audit Log for everything (mock-up 75). */
export default function RetiredPage() {
  redirect("/audit-centre/logs?module=Administration");
}
