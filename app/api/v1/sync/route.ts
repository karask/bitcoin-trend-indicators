import { requireLocalAuth } from "../../../../lib/auth-local.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireLocalAuth(request);
  if (unauthorized) return unauthorized;
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Request origin was rejected" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  // Local development APIs already refresh stale provider-backed datasets on read.
  return Response.json({ status: "development-read-through" }, { headers: { "Cache-Control": "no-store" } });
}
