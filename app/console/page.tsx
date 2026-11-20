"use client";

import { LoginPageFor } from "@/app/login/LoginView";

/**
 * ReqGen v4.6.11 (brief §3) — the hidden administration sign-in. Not linked
 * from any public page. The Developer signs in here with the password, the
 * two-step code (or fingerprint). The developer console opens this address.
 */
export default function ConsoleSignIn() {
  return <LoginPageFor console />;
}
