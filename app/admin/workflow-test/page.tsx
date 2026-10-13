import { redirect } from "next/navigation";

/** v4.6: the route test lives in Diagnostics › Route test (mock-up 88). */
export default function RetiredPage() {
  redirect("/admin/system-health?tab=route");
}
