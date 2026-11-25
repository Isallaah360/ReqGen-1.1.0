// CORS for the app (Capacitor serves it from https://localhost) and the website.
const ALLOWED = new Set(["https://localhost", "capacitor://localhost", "http://localhost", "https://ietreqgen.barderians.com.ng"]);
export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://localhost",
    "Access-Control-Allow-Methods": "POST, GET, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
export function withCors(req: Request, res: Response) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors(req))) h.set(k, v);
  h.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, headers: h });
}
export function preflight(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}
