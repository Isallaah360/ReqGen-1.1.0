"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Canonical deep-link compatibility route.
 * Voucher creation is intentionally opened inside the Payment Vouchers workspace
 * so users can create, save/submit, close and continue from the parent register.
 */
export default function CreateVoucherCompatibilityRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/payment-vouchers?create=1");
  }, [router]);
  return <main className="p-6 text-sm font-semibold text-slate-600">Opening the controlled voucher form…</main>;
}
