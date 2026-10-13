import { redirect } from "next/navigation";

/** v4.6: institution officers live in Routing Engine › Officers per step (mock-up 86). */
export default function RetiredPage() {
  redirect("/admin/routing?tab=officers");
}
