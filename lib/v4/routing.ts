"use client";

import { supabase } from "@/lib/supabaseClient";
import { canonicalStage, type RouteKind } from "@/lib/routingEngine";

/**
 * ReqGen v4.6 — Administration › Routing Engine (mock-up 86) and Departments
 * (mock-up 85). The live Routing Engine is NOT changed: routes are read with
 * reqgen_department_route_overview and saved only through the engine's own
 * reqgen_save_department_route, with exactly the payload the v3.1.11 editor sent.
 */

export const REVIEW = ["PD", "DOD", "HOD", "DIN Admin", "HR", "Registrar"] as const;
export type ReviewStage = (typeof REVIEW)[number];
export const OFFICER_STAGES = ["PD", "DOD", "HOD", "DIN Admin", "HR", "Registrar", "DG"] as const;
export type OfficerStage = (typeof OFFICER_STAGES)[number];
export const DEPT_ONLY: OfficerStage[] = ["PD", "DOD", "HOD"];
export type IfVacant = "skip" | "block";
export type Lane = Record<ReviewStage, { on: boolean; ifVacant: IfVacant }>;

export type OverviewRow = { dept_id: string; dept_name: string; is_active?: boolean; template_code: string | null; route_kind: RouteKind; step_order: number; stage: string; if_vacant: IfVacant; owner_id: string | null; owner_name: string | null };
export type StageOfficer = { dept_id: string; stage: string; user_id: string };

export const STAGE_TEXT: Record<string, string> = {
  PD: "PD", DOD: "DOD", HOD: "HOD", "DIN Admin": "DIN Admin", HR: "HR Coordinator", Registrar: "Registrar",
  DG: "DG + stamp", Account: "Account Officer", "HR Filing": "HR Filing",
};

export async function loadRouting() {
  const [overview, officers] = await Promise.all([
    supabase.rpc("reqgen_department_route_overview"),
    supabase.from("reqgen_department_stage_officers").select("dept_id,stage,user_id"),
  ]);
  return {
    error: overview.error?.message || null,
    overview: ((overview.data || []) as OverviewRow[]).map((r) => ({ ...r, stage: canonicalStage(r.stage) })),
    officers: ((officers.data || []) as StageOfficer[]).map((o) => ({ ...o, stage: canonicalStage(o.stage) })),
  };
}

const emptyLane = (): Lane => Object.fromEntries(REVIEW.map((s) => [s, { on: false, ifVacant: "skip" as IfVacant }])) as Lane;

/** The department's current route, as the editor shows it (mirrors the v3.1.11 editor). */
export function routeOf(deptId: string, overview: OverviewRow[], officers: StageOfficer[]) {
  const rows = overview.filter((r) => r.dept_id === deptId);
  const lanes: Record<RouteKind, Lane> = { official: emptyLane(), personal_fund: emptyLane(), personal_other: emptyLane() };
  let dgVacant: IfVacant = "block";
  for (const r of rows) {
    if ((REVIEW as readonly string[]).includes(r.stage)) lanes[r.route_kind][r.stage as ReviewStage] = { on: true, ifVacant: r.if_vacant };
    if (r.stage === "DG") dgVacant = r.if_vacant;
  }
  const own = Object.fromEntries(OFFICER_STAGES.map((s) => [s, officers.find((o) => o.dept_id === deptId && o.stage === s)?.user_id || ""])) as Record<OfficerStage, string>;
  // PD / DOD / HOD set before v3.1.11 live on the department record: use the resolved owner.
  for (const s of DEPT_ONLY) if (!own[s]) own[s] = rows.find((r) => r.stage === s && r.owner_id)?.owner_id || "";
  return { lanes, officers: own, dgVacant };
}

/** Save through the engine's own function (a new route version; requests already moving keep theirs). */
export async function saveRoute(deptId: string, lanes: Record<RouteKind, Lane>, officers: Record<OfficerStage, string>, dgVacant: IfVacant) {
  const kinds: RouteKind[] = ["official", "personal_fund", "personal_other"];
  const routes = Object.fromEntries(kinds.map((k) => [k, REVIEW.filter((s) => lanes[k][s].on).map((s) => ({ stage: s, if_vacant: lanes[k][s].ifVacant }))]));
  const offs = Object.fromEntries(OFFICER_STAGES.map((s) => [s, officers[s] || null]));
  const { error } = await supabase.rpc("reqgen_save_department_route", { p_dept_id: deptId, p_routes: routes, p_officers: offs, p_dg_if_vacant: dgVacant });
  if (error) throw new Error(error.message);
}
