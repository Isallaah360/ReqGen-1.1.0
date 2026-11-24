import { confirmWithCode } from "@/lib/codeConfirm";

/**
 * ReqGen v4 (Build Reference §10) and v4.7.0: signing with the IET stamp, authorising a
 * voucher, approving a transfer and paying always need a FRESH fingerprint or
 * the 6-number 2FA code — never the passcode session alone.
 *
 * Returns null when confirmed, or the reason it was not.
 */
export async function confirmFresh(purpose = "sign and stamp", opts: { codeOnly?: boolean } = {}): Promise<string | null> {
  // v4.7.1 (one standard, website and app): signing in uses the authenticator (2FA); every action,
  // including the Super Admin jobs, uses the 6-digit code sent by SMS and e-mail.
  void opts;
  return (await confirmWithCode(purpose)) ? null : "cancelled";
}
