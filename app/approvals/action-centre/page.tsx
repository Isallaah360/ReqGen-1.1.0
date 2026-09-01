import { redirect } from "next/navigation";

export default function LegacyActionCentreRedirect() {
  redirect("/approvals");
}
