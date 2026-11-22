import { NextResponse } from "next/server";
import { REQGEN_SEMVER } from "@/lib/version";

/** ReqGen v4.6.12 (Kit K3): the live website version, so an open page knows a newer one is out. */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ version: REQGEN_SEMVER }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
