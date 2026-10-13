import { redirect } from "next/navigation";

/** v4.6: backups and away cover live in Routing Engine › Backups & away cover (mock-up 86). */
export default function RetiredPage() {
  redirect("/admin/routing?tab=backups");
}
