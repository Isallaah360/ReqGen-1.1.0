import PaymentVoucherDetailPage from "@/app/payment-vouchers/[id]/page";

/**
 * v3.1.6: signers who are not Finance staff (Director General, Cheque Signer,
 * Counter Signer) open and sign a voucher from Approvals. The database
 * (get_payment_voucher_detail, reqgen_pv_sign) decides what they may see and sign.
 */
export default function ApprovalVoucherPage() {
  return <PaymentVoucherDetailPage />;
}
