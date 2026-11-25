// The two pieces of Next.js the website server code uses, as plain web Request and Response.
export type NextRequest = Request;
export class NextResponse extends Response {
  static override json(body: unknown, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify(body), { ...init, headers });
  }
}
