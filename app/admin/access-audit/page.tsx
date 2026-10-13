import { redirect } from "next/navigation";

/** v4.6: who can do what is the Permissions Matrix (mock-up 84). */
export default function RetiredPage() {
  redirect("/admin/roles");
}
