import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { APP_VERSION, db, isNative, store } from "./core";

/**
 * ReqGen app 4.0.0: this phone's own key. It is made once after signing in with password and
 * authenticator (2FA), kept in Android's secure keystore, and shown to the database only after the
 * fingerprint or the app PIN. The database keeps only its fingerprint (SHA-256) and turns a correct
 * key into the same one-action pass an SMS code gives. Five wrong keys switch the phone off.
 */
const SERVER = "ng.com.barderians.reqgen.device";

function newSecret() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function saveSecret(deviceId: string, secret: string) {
  if (isNative()) await NativeBiometric.setCredentials({ username: deviceId, password: secret, server: SERVER });
  else await store.set("rg:dev-secret", secret); // browser tests only
}
async function readSecret(): Promise<string | null> {
  try {
    if (isNative()) return (await NativeBiometric.getCredentials({ server: SERVER })).password || null;
    return await store.get<string | null>("rg:dev-secret", null);
  } catch { return null; }
}

export async function deviceId() { return store.get<string | null>("rg:device", null); }

/** Sets this phone up (needs a session confirmed with the authenticator). Quietly does nothing if it cannot. */
export async function ensureDevice(): Promise<boolean> {
  if (await deviceId()) return true;
  try {
    const c = await db();
    const secret = newSecret();
    const model = isNative() ? "Android phone" : "Browser";
    const { data, error } = await c.rpc("reqgen_app_device_register", { p_secret: secret, p_label: model, p_platform: isNative() ? "android" : "web", p_version: APP_VERSION });
    if (error || !data) return false;
    await saveSecret(String(data), secret);
    await store.set("rg:device", String(data));
    return true;
  } catch { return false; }
}

/** After the fingerprint or PIN: proves the key and gets the pass. "off" means the phone must be set up again. */
export async function proveDevice(): Promise<"ok" | "off" | "failed"> {
  const id = await deviceId();
  const secret = await readSecret();
  if (!id || !secret) return "off";
  const c = await db();
  const { data, error } = await c.rpc("reqgen_app_action_pass", { p_device: id, p_secret: secret });
  if (error) {
    if (/REQGEN_DEVICE_OFF/.test(error.message)) { await forgetDevice(); return "off"; }
    return "failed";
  }
  return data === true ? "ok" : "failed";
}

export async function forgetDevice() {
  await store.del("rg:device");
  await store.del("rg:dev-secret");
  if (isNative()) await NativeBiometric.deleteCredentials({ server: SERVER }).catch(() => null);
}
