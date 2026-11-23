import { supabase } from "@/lib/supabaseClient";

/** ReqGen v4.7.0: SMS and e-mail to whoever a request now waits for (or to the sender for an answer). */
export async function alertPeople(requestId: string, kind: "waiting" | "answered", to?: string[]): Promise<{ told: number; error?: string }> {
  if (process.env.NEXT_PUBLIC_REQGEN_NOTIFICATIONS_ENABLED === "false") return { told: 0 };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { told: 0 };
  try {
    const r = await fetch("/api/notifications/alert", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ requestId, kind, to }) });
    const j = (await r.json().catch(() => ({}))) as { told?: number; error?: string };
    return { told: j.told || 0, error: r.ok ? undefined : j.error };
  } catch {
    return { told: 0, error: "The SMS and e-mail could not be sent. The app notice was still sent." };
  }
}
