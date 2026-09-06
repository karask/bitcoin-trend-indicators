import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Use the bundler supplied by our declared Wrangler development toolchain.
// Bundle React too, so compiled test artifacts can live outside the repository.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve("wrangler/package.json"));
const { build } = wranglerRequire("esbuild");
const directory = await mkdtemp(path.join(tmpdir(), "regime-component-tests-"));
try {
  const outfile = path.join(directory, "components.cjs");
  await build({ entryPoints: ["tests/components.test.tsx"], outfile, bundle: true, platform: "node", format: "cjs", jsx: "automatic", logLevel: "warning" });
  const result = spawnSync(process.execPath, [outfile], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
