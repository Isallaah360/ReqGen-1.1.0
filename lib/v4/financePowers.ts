"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";

/**
 * ReqGen v4.6.5 — what the signed-in person may do on the finance pages, decided by the database
 * (reqgen_finance_powers), so a page never offers a button the database will refuse. When the
 * v4.6.5 database step has not been run yet, the acting position is used as a best guess.
 */
export type FinancePowers = {
  ready: boolean;
  canCorrect: boolean;      // correct totals, recalculate accounts, record opening balances, remove unsupported spending
  canReset: boolean;        // Financial Reset and restore (Super Admin and Developer)
  isSuperAdmin: boolean;
  isDeveloper: boolean;
  isAuditor: boolean;
  reason: string | null;    // why not, in plain words
};

const WAITING: FinancePowers = { ready: false, canCorrect: false, canReset: false, isSuperAdmin: false, isDeveloper: false, isAuditor: false, reason: null };

export function useFinancePowers(userId: string | null | undefined, role: string | null | undefined): FinancePowers {
  const [powers, setPowers] = useState<FinancePowers>(WAITING);
  const acting = normalizeRole(role || "").replace(/\d+$/, "");
  useEffect(() => {
    if (!userId) return;
    let live = true;
    queueMicrotask(async () => {
      const { data, error } = await supabase.rpc("reqgen_finance_powers");
      if (!live) return;
      if (error || !data) {
        const sa = acting === "admin" || acting === "superadmin";
        const au = acting === "auditor";
        setPowers({ ready: true, canCorrect: sa || au, canReset: sa, isSuperAdmin: sa, isDeveloper: false, isAuditor: au, reason: sa || au ? null : "Only the Auditor or the Super Admin can correct finance totals." });
        return;
      }
      const d = data as { can_correct?: boolean; can_reset?: boolean; is_super_admin?: boolean; is_developer?: boolean; is_auditor?: boolean; reason?: string | null };
      setPowers({ ready: true, canCorrect: !!d.can_correct, canReset: !!d.can_reset, isSuperAdmin: !!d.is_super_admin, isDeveloper: !!d.is_developer, isAuditor: !!d.is_auditor, reason: d.reason || null });
    });
    return () => { live = false; };
  }, [userId, acting]);
  return powers;
}
