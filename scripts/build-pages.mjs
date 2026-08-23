import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist", "cloudflare-pages");
const serverApp = path.join(root, ".next", "server", "app");

if (!fs.existsSync(path.join(serverApp, "index.html"))) {
  throw new Error("Next.js static shell is missing. Run `npm run build` before building Pages output.");
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, "public"), output, { recursive: true });
fs.cpSync(path.join(root, ".next", "static"), path.join(output, "_next", "static"), { recursive: true });
fs.copyFileSync(path.join(serverApp, "index.html"), path.join(output, "index.html"));
fs.copyFileSync(path.join(serverApp, "_not-found.html"), path.join(output, "404.html"));
fs.copyFileSync(path.join(serverApp, "manifest.webmanifest.body"), path.join(output, "manifest.webmanifest"));
fs.writeFileSync(path.join(output, "_routes.json"), JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2) + "\n");
fs.writeFileSync(path.join(output, "_headers"), `/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/sw.js\n  Cache-Control: no-cache\n\n/manifest.webmanifest\n  Cache-Control: public, max-age=3600\n`);

console.log(`Cloudflare Pages output: ${path.relative(root, output)}`);
