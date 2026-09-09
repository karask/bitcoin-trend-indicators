import { handleAllowlist } from "../../../../../lib/auth.ts";
import { localAuthRuntime } from "../../../../../lib/auth-local.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return handleAllowlist(request, localAuthRuntime()); }
export async function POST(request: Request) { return handleAllowlist(request, localAuthRuntime()); }
export async function DELETE(request: Request) { return handleAllowlist(request, localAuthRuntime()); }
