import { handleDeleteAccount } from "../../../../../lib/auth.ts";
import { localAuthRuntime } from "../../../../../lib/auth-local.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function DELETE(request: Request) { return handleDeleteAccount(request, localAuthRuntime()); }
