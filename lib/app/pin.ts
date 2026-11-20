"use client";

import { appGet, appSet } from "./native";

/**
 * ReqGen v4.6.11 — the app PIN (brief §7). Six numbers that open the app on
 * this phone, even with no network. Only a salted SHA-256 of the PIN is kept,
 * in the app's private storage. The PIN never signs anything: signing,
 * stamping and paying still need the fingerprint or the 2FA code.
 */

const KEY = "reqgen:app-pin";
const LOCK_AFTER_MS = 5 * 60_000;
const LAST = "reqgen:app-last-active";

async function hash(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function pinIsSet() {
  return !!(await appGet(KEY));
}

export async function setPin(pin: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error("Use exactly six numbers.");
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, "0")).join("");
  await appSet(KEY, JSON.stringify({ salt, hash: await hash(pin, salt) }));
}

export async function clearPin() {
  await appSet(KEY, null);
}

export async function pinMatches(pin: string) {
  const raw = await appGet(KEY);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw) as { salt: string; hash: string };
    return (await hash(pin, saved.salt)) === saved.hash;
  } catch {
    return false;
  }
}

/** Remember when the app was last used; it locks after 5 minutes away. */
export function touchActive() {
  try { window.localStorage.setItem(LAST, String(Date.now())); } catch { /* ignore */ }
}

export function lockDue() {
  try {
    const last = Number(window.localStorage.getItem(LAST) || 0);
    return !last || Date.now() - last > LOCK_AFTER_MS;
  } catch {
    return true;
  }
}
