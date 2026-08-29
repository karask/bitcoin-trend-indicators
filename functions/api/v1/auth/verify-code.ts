import { createAuthRuntime, handleVerifyCode } from "../../../../lib/auth.ts";
import { d1AuthStore } from "../../../../lib/auth-store-d1.ts";
import type { CloudflareEnv, PagesFunction } from "../../../_lib/cloudflare.ts";

export const onRequestPost: PagesFunction<CloudflareEnv> = ({ request, env }) => handleVerifyCode(request, createAuthRuntime(d1AuthStore(env.REGIME_DB), env));
