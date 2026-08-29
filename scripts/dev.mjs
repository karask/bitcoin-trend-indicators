import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".dev.vars")) {
  loadEnvFile(".dev.vars");
} else {
  console.info(".dev.vars not found. Continuing without local auth credentials.");
}

await import("next/dist/bin/next");
