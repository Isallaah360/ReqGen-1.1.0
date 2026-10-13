import { supabase } from "@/lib/supabaseClient";
import { promptDialog } from "@/lib/dialog";
import { fingerprintAvailable, fingerprintStepUp } from "@/lib/v4/deviceSignIn";

/**
 * ReqGen v4 (Build Reference §10): signing with the IET stamp, authorising a
 * voucher, approving a transfer and paying always need a FRESH fingerprint or
 * the 6-number 2FA code — never the passcode session alone.
 *
 * Returns null when confirmed, or the reason it was not.
 */
export async function confirmFresh(purpose = "sign and stamp", opts: { codeOnly?: boolean } = {}): Promise<string | null> {
  // codeOnly: the server checks the session itself (aal2), so only the 2FA code will do
  if (!opts.codeOnly && await fingerprintAvailable()) {
    try {
      await fingerprintStepUp();
      return null;
    } catch (e) {
      const m = e instanceof Error ? e.message : "Fingerprint failed.";
      if (!/no fingerprint/i.test(m)) return m + " You can use your 2FA code instead.";
    }
  }
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
