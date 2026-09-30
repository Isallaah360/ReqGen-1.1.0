"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveRole } from "@/lib/activeRole";
import { evaluateRequestAccess, type RequestAccessFacts, type RequestAccessReason } from "@/lib/requestAccess";

type GateState =
  | { phase: "checking" }
  | { phase: "allowed" }
  | { phase: "denied"; reason: RequestAccessReason | "not-found" };

const DENIAL_TEXT: Record<string, string> = {
  "registry-movement-only":
    "The Registry role tracks request movement only. Use Registry → Request Tracking to see where this request is, who acted on it and when. To open your own requests, switch your working role to Staff.",
  "not-involved":
    "You can open a request's full details only if you created it, it has been routed to you for approval or processing, or you have already acted on it.",
  "not-found": "This request does not exist, or you do not have permission to see it.",
};

/**
 * Wrap any page or panel that shows a request's full content. The children are
 * not rendered (and so fetch nothing) until the access rule in
 * lib/requestAccess.ts has passed for the signed-in user in their active role.
 */
export default function RequestAccessGate({ requestId, children }: { requestId: string | null | undefined; children: ReactNode }) {
  const [state, setState] = useState<GateState>({ phase: "checking" });

  useEffect(() => {
    let alive = true;
    async function check() {
      if (!requestId) { setState({ phase: "denied", reason: "not-found" }); return; }
      setState({ phase: "checking" });
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) { if (alive) setState({ phase: "denied", reason: "not-involved" }); return; }

      const [requestRes, historyRes, active, profile] = await Promise.all([
        supabase
          .from("requests")
          .select("created_by,current_owner,current_stage,status,assigned_account_officer_id")
          .eq("id", requestId)
          .maybeSingle(),
        supabase.from("request_history").select("action_by").eq("request_id", requestId).limit(1000),
        getActiveRole(user.id),
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      ]);
      if (!alive) return;
      if (requestRes.error || !requestRes.data) { setState({ phase: "denied", reason: "not-found" }); return; }

      const decision = evaluateRequestAccess({
        request: requestRes.data as RequestAccessFacts,
        userId: user.id,
        activeRole: active?.active_role_key || String(profile.data?.role || "staff"),
        actorIds: ((historyRes.data || []) as Array<{ action_by?: string | null }>).map((row) => row.action_by),
      });
      setState(decision.allowed ? { phase: "allowed" } : { phase: "denied", reason: decision.reason });
    }
    queueMicrotask(() => { void check(); });
    const recheck = () => { void check(); };
    window.addEventListener("reqgen-active-role-changed", recheck);
    return () => { alive = false; window.removeEventListener("reqgen-active-role-changed", recheck); };
  }, [requestId]);

  if (state.phase === "checking") {
    return <div className="rg-gate rg-gate-checking" role="status">Checking your access to this request…</div>;
  }
  if (state.phase === "denied") {
    return (
      <section className="rg-gate" role="alert">
        <ShieldAlert size={28} aria-hidden="true" />
        <div>
          <h2>Request details are restricted</h2>
          <p>{DENIAL_TEXT[state.reason] || DENIAL_TEXT["not-involved"]}</p>
          <div className="rg-page-actions">
            <Link href="/requests" className="rg-btn rg-btn-primary">My Requests</Link>
            <Link href="/approvals" className="rg-btn rg-btn-secondary">My Approvals</Link>
          </div>
        </div>
      </section>
    );
  }
  return <>{children}</>;
}
