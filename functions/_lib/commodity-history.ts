import { CommodityStore } from "../../lib/commodity-store.ts";
import type { D1Database } from "./cloudflare.ts";

export function d1CommodityStore(database: D1Database) {
  return new CommodityStore({
    first: (sql, values) => database.prepare(sql).bind(...values).first(),
    all: async <T>(sql: string, values: unknown[]) => (await database.prepare(sql).bind(...values).all<T>()).results,
    batch: async statements => { await database.batch(statements.map(item => database.prepare(item.sql).bind(...item.values))); },
  });
}
