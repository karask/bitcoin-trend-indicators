import type { D1Database } from "../functions/_lib/cloudflare.ts";
import { AuthStore, type AuthSqlAdapter } from "./auth-store.ts";

export function d1AuthStore(database: D1Database): AuthStore {
  const adapter: AuthSqlAdapter = {
    async first<T>(sql: string, values: unknown[] = []) {
      return database.prepare(sql).bind(...values).first<T>();
    },
    async run(sql, values = []) {
      const result = await database.prepare(sql).bind(...values).run();
      return { changes: Number(result.meta?.changes ?? 0) };
    },
  };
  return new AuthStore(adapter);
}
