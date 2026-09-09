import type { SQLInputValue, DatabaseSync } from "node:sqlite";
import { getDatabase, runTransaction } from "../db/index.ts";
import { CommodityStore } from "./commodity-store.ts";

export function localCommodityStore(database: DatabaseSync = getDatabase()) {
  const columns = database.prepare("PRAGMA table_info(market_candles)").all() as { name: string }[];
  for (const column of ["retrieved_at", "raw_checksum"]) if (!columns.some(item => item.name === column)) database.exec(`ALTER TABLE market_candles ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  return new CommodityStore({
    first: async <T>(sql: string, values: unknown[]) => (database.prepare(sql).get(...values as SQLInputValue[]) as T | undefined) ?? null,
    all: async <T>(sql: string, values: unknown[]) => database.prepare(sql).all(...values as SQLInputValue[]) as T[],
    batch: async statements => { runTransaction(database, () => { for (const item of statements) database.prepare(item.sql).run(...item.values as SQLInputValue[]); }); },
  });
}
