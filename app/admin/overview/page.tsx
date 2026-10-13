import { redirect } from "next/navigation";

/** v4.6: retired — Administration home shows the same numbers (mock-up 79). */
export default function RetiredPage() {
  redirect("/admin");
}
