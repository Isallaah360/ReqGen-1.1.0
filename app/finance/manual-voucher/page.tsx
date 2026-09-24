import { redirect } from "next/navigation";

/**
 * Compatibility route retained for bookmarked legacy links.
 * Manual voucher creation is canonically part of Payment Vouchers.
 */
export default function LegacyManualVoucherRedirect() {
  redirect("/payment-vouchers/manual");
}
