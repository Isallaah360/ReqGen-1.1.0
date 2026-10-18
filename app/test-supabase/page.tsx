import { redirect } from "next/navigation";

/** v4.6.3: a development check page; the live checks are in Administration › Diagnostics. */
export default function RetiredPage() {
  redirect("/admin/system-health");
}
