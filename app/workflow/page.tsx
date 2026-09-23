import { redirect } from "next/navigation";

export default function LegacyWorkflowRedirect() {
  redirect("/audit-centre?view=workflow-trace");
}
