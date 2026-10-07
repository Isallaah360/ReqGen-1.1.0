"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen v3.1.8 — Account Setup Guide.
 * Four things make an account "live". The guide checks each one, explains it
 * in plain words and walks the person to the exact place to do it.
 *   1. Own password        (auth user_metadata.password_changed_at)
 *   2. Authenticator (2FA) (a verified TOTP factor)
 *   3. Profile photo       (profiles.avatar_url)
 *   4. Signature           (profiles.signature_url) — required to submit,
 *                          approve and sign vouchers
 */

export type SetupStepKey = "password" | "twofa" | "avatar" | "signature";

export type SetupStep = {
  key: SetupStepKey;
  title: string;
  why: string;
  required: boolean;
  href: string;
  howTo: string[];
  done: boolean;
};

export const SETUP_EVENT = "reqgen:setup-changed";

const CONTENT: Record<SetupStepKey, Omit<SetupStep, "done">> = {
  password: {
    key: "password",
    title: "Set your own password",
    why: "The password you received from the Administrator is temporary. Only you should know your password.",
    required: true,
    href: "/change-password?guide=password",
    howTo: [
      "Tap \"Take me there\". The Change Password page opens.",
      "Type your current (temporary) password and confirm with your authenticator code if asked.",
      "Type a new password of at least 8 characters. Mix letters and numbers. Tap the eye icon to see what you typed.",
      "Type the new password again to confirm, then tap \"Update Password\".",
      "ReqGen signs you out. Sign in again with your NEW password, then come back to this guide.",
    ],
  },
  twofa: {
    key: "twofa",
    title: "Connect your authenticator app (2FA)",
    why: "Every sign-in asks for a 6-digit code from your phone, so nobody can use your account with your password alone.",
    required: true,
    href: "/profile/security?guide=twofa",
    howTo: [
      "On your phone, install \"Google Authenticator\" or \"Microsoft Authenticator\" from the Play Store or App Store.",
      "Tap \"Take me there\". The Security page opens and shows a QR code (or follow the screen ReqGen showed you at sign-in).",
      "In the authenticator app tap \"+\" then \"Scan a QR code\" and point the phone camera at the QR code on the screen.",
      "The app now shows a 6-digit code for \"ReqGen\". Type that code into ReqGen and confirm.",
      "Keep the app on your phone. You will use a new code each time you sign in.",
    ],
  },
  avatar: {
    key: "avatar",
    title: "Add your profile photo",
    why: "Your photo helps colleagues recognise who prepared, approved or signed a document.",
    required: false,
    href: "/profile?guide=avatar#photo",
    howTo: [
      "Take a clear, front-facing photo (phone camera is fine) or choose one from your gallery.",
      "Tap \"Take me there\". Your Profile page opens at your photo.",
      "Tap the photo circle (or \"Change photo\") and pick the picture.",
      "Wait for \"Profile photo updated\". Your photo now shows in the top bar.",
    ],
  },
  signature: {
    key: "signature",
    title: "Upload your signature",
    why: "Required. A request cannot be submitted, approved or signed, and no payment voucher can be prepared, without your saved signature.",
    required: true,
    href: "/profile?guide=signature#signature",
    howTo: [
      "Sign your name with a dark pen (black or blue) on plain white paper.",
      "Take a clear photo of the signature in good light, close enough that the signature fills most of the picture.",
      "Tap \"Take me there\". Your Profile page opens at the Signature card.",
      "Leave \"Remove the paper background automatically\" ticked, tap \"Choose file\" and pick the photo.",
      "Tap \"Upload Signature\". ReqGen removes the paper background and shows your clean signature in the box.",
    ],
  },
};

export const SETUP_ORDER: SetupStepKey[] = ["password", "twofa", "avatar", "signature"];

export async function loadSetupSteps(): Promise<SetupStep[] | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profileRes, factorsRes] = await Promise.all([
    supabase.from("profiles").select("avatar_url,signature_url").eq("id", user.id).maybeSingle(),
    supabase.auth.mfa.listFactors(),
  ]);
  const profile = (profileRes.data || {}) as { avatar_url?: string | null; signature_url?: string | null };
  const factors = (factorsRes.data?.all || []) as Array<{ factor_type?: string; status?: string }>;
  const meta = (user.user_metadata || {}) as Record<string, unknown>;

  const done: Record<SetupStepKey, boolean> = {
    password: Boolean(meta.password_changed_at || meta.password_confirmed_own),
    twofa: factors.some((f) => f.factor_type === "totp" && f.status === "verified"),
    avatar: Boolean(String(profile.avatar_url || "").trim()),
    signature: Boolean(String(profile.signature_url || "").trim()),
  };

  return SETUP_ORDER.map((key) => ({ ...CONTENT[key], done: done[key] }));
}

/** The person confirms the password they use is already their own. */
export async function confirmOwnPassword() {
  const { error } = await supabase.auth.updateUser({ data: { password_confirmed_own: new Date().toISOString() } });
  if (error) throw new Error(error.message);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SETUP_EVENT));
}

export function useSetupSteps() {
  const [steps, setSteps] = useState<SetupStep[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSteps(await loadSetupSteps());
    } catch {
      setSteps(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void refresh(); });
    const again = () => { void refresh(); };
    window.addEventListener(SETUP_EVENT, again);
    window.addEventListener("focus", again);
    return () => {
      window.removeEventListener(SETUP_EVENT, again);
      window.removeEventListener("focus", again);
    };
  }, [refresh]);

  return { steps, loading, refresh };
}

export function setupStepContent(key: SetupStepKey) {
  return CONTENT[key];
}
