import { redirect } from "next/navigation";

/** v4.6: health checks live in Diagnostics (mock-up 88). */
export default function RetiredPage() {
  redirect("/admin/system-health");
}
