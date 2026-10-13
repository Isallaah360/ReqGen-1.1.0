"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen v4.6 — the sign-in rules set in Administration › Security Centre, for the
 * text people read (hours signed in, wrong passcode tries). Falls back to 12 h / 5 tries.
 */
export type SecurityRules = { stayHours: number; idleMinutes: number; passcodeTries: number };
const DEFAULT_RULES: SecurityRules = { stayHours: 12, idleMinutes: 15, passcodeTries: 5 };

export function useSecurityRules(): SecurityRules {
  const [rules, setRules] = useState<SecurityRules>(DEFAULT_RULES);
  useEffect(() => {
    let alive = true;
    void supabase.from("reqgen_security_rules").select("stay_hours,idle_minutes,passcode_tries").eq("id", 1).maybeSingle().then(({ data }) => {
      if (!alive || !data) return;
      setRules({ stayHours: Number(data.stay_hours) || 12, idleMinutes: Number(data.idle_minutes) || 15, passcodeTries: Number(data.passcode_tries) || 5 });
    }, () => null);
    return () => { alive = false; };
  }, []);
  return rules;
}
