import { redirect } from "next/navigation";

/** v4.6.3: the Finance home page is the Finance overview. */
export default function RetiredPage() {
  redirect("/finance");
}
