import { NextResponse } from "next/server";

/**
 * ReqGen v4.7.0: the real app's screens run inside the APK (origin https://localhost)
 * and call these few website routes. Only the app's own origins are allowed.
 */
const APP_ORIGINS = new Set(["https://localhost", "capacitor://localhost", "http://localhost"]);

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !APP_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function preflight(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export function json(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders(req.headers.get("origin")), "Cache-Control": "no-store" } });
}
