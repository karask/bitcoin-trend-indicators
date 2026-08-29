import { handleSession } from "../../../../../lib/auth.ts";
import { localAuthRuntime } from "../../../../../lib/auth-local.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return handleSession(request, localAuthRuntime()); }
