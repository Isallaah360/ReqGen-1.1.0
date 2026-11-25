// The two pieces of Next.js the website server code uses, as plain web Request and Response.
// deno-lint-ignore no-explicit-any
export type NextRequest = Request & { cookies?: any };
export class NextResponse extends Response {
  cookies = { set: (..._a: unknown[]) => undefined, delete: (..._a: unknown[]) => undefined };
  static override json(body: unknown, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify(body), { ...init, headers });
  }
}
