import { redirect } from "next/navigation";

// Per ReqGen Global Stabilisation Roadmap, Phase 1:
// "Redirect the old /workflow route to the appropriate Audit Centre
// request/workflow-trace view." This route is intentionally absent from
// navigation and global search (see GovernmentAppShell.tsx) — it exists
// only so that old bookmarks/links do not 404. The workflow engine itself
// (stages, routing, current-owner logic, RPCs, history) is untouched and
// lives in Audit Centre / the database layer, not in this UI route.
export default function LegacyWorkflowRedirect() {
  redirect("/audit-centre?view=workflow-trace");
}
