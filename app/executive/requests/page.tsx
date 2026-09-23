import { redirect } from "next/navigation";

export default function LegacyExecutiveRedirect() {
  redirect("/requests");
}
