import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { getDatabase } from "../db/index.ts";
import { AuthStore, type AuthSqlAdapter } from "./auth-store.ts";

export function localAuthStore(database: DatabaseSync = getDatabase()): AuthStore {
  const adapter: AuthSqlAdapter = {
    async first<T>(sql: string, values: unknown[] = []) {
      return (database.prepare(sql).get(...values as SQLInputValue[]) as T | undefined) ?? null;
    },
    async run(sql: string, values: unknown[] = []) {
      const result = database.prepare(sql).run(...values as SQLInputValue[]);
      return { changes: Number(result.changes) };
    },
  };
  return new AuthStore(adapter);
}
