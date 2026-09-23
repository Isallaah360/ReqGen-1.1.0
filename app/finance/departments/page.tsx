import { redirect } from "next/navigation";

export default function LegacyFinanceDepartmentsRedirect() {
  redirect("/admin/departments");
}
