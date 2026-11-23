import { supabase } from "@/lib/supabaseClient";
import { promptDialog } from "@/lib/dialog";
import { confirmWithCode } from "@/lib/codeConfirm";

/**
 * ReqGen v4 (Build Reference §10) and v4.7.0: signing with the IET stamp, authorising a
 * voucher, approving a transfer and paying always need a FRESH fingerprint or
 * the 6-number 2FA code — never the passcode session alone.
 *
 * Returns null when confirmed, or the reason it was not.
 */
export async function confirmFresh(purpose = "sign and stamp", opts: { codeOnly?: boolean } = {}): Promise<string | null> {
  // v4.7.0: every decision on a request or voucher uses the 6-digit code sent by SMS and e-mail
  // (website and app alike). codeOnly: Super Admin jobs whose server checks the authenticator (aal2).
  if (!opts.codeOnly) return (await confirmWithCode(purpose)) ? null : "cancelled";
  const factors = await supabase.auth.mfa.listFactors();
  const factor = factors.data?.totp.find((f) => f.status === "verified");
  if (!factor) return "Set up 2FA in My Account › Security first.";
  const code = await promptDialog({
    title: "Confirm it is you",
    message: `Type the 6-number code from your authenticator app to ${purpose}.`,
    label: "6-number code",
    placeholder: "123456",
    confirmLabel: "Confirm",
  });
  if (!code) return "cancelled";
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\D/g, "").slice(0, 6) });
  return error ? "The code is not correct: " + error.message : null;
}
