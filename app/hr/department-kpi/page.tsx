import { redirect } from "next/navigation";

export default function LegacyHRRouteRedirect() {
  redirect("/hr/registrar/department-kpi");
}
