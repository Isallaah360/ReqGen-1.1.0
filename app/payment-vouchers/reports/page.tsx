import { redirect } from "next/navigation";

/** v4.4: voucher reports live in Reports › Voucher Reports. */
export default function Page() {
  redirect("/reports/vouchers");
}
