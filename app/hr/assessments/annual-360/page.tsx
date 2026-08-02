import { redirect } from "next/navigation";

export default function LegacyHRRouteRedirect() {
  redirect("/hr/registrar/assessments/annual-360");
}
