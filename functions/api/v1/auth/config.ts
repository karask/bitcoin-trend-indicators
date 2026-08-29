import { createAuthRuntime, handleAuthConfig } from "../../../../lib/auth.ts";
import { d1AuthStore } from "../../../../lib/auth-store-d1.ts";
import type { CloudflareEnv, PagesFunction } from "../../../_lib/cloudflare.ts";

export const onRequestGet: PagesFunction<CloudflareEnv> = ({ env }) => handleAuthConfig(createAuthRuntime(d1AuthStore(env.REGIME_DB), env));
