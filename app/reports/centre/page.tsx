import { redirect } from "next/navigation";

/** v4.4: every report is on the Reports page (mock-up 57). */
export default function Page() {
  redirect("/reports");
}
