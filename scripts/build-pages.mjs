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
const stockShell = [path.join(serverApp, "stocks.html"), path.join(serverApp, "stocks", "index.html")].find(candidate => fs.existsSync(candidate));
if (!stockShell) throw new Error("Next.js stock shell is missing from the static build.");
fs.mkdirSync(path.join(output, "stocks"), { recursive: true });
fs.copyFileSync(stockShell, path.join(output, "stocks", "index.html"));
for (const route of ["login", "privacy"]) {
  const shell = [path.join(serverApp, `${route}.html`), path.join(serverApp, route, "index.html")].find(candidate => fs.existsSync(candidate));
  if (!shell) throw new Error(`Next.js ${route} shell is missing from the static build.`);
  fs.mkdirSync(path.join(output, route), { recursive: true });
  fs.copyFileSync(shell, path.join(output, route, "index.html"));
}
fs.copyFileSync(path.join(serverApp, "_not-found.html"), path.join(output, "404.html"));
fs.copyFileSync(path.join(serverApp, "manifest.webmanifest.body"), path.join(output, "manifest.webmanifest"));
fs.writeFileSync(path.join(output, "_routes.json"), JSON.stringify({
  version: 1,
  include: ["/*"],
  exclude: ["/_next/static/*", "/favicon.png", "/icon-192.png", "/icon-512.png", "/og-card.png", "/manifest.webmanifest", "/sw.js"],
}, null, 2) + "\n");
fs.writeFileSync(path.join(output, "_headers"), `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: same-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\n\n/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/sw.js\n  Cache-Control: no-cache\n\n/manifest.webmanifest\n  Cache-Control: public, max-age=3600\n`);

console.log(`Cloudflare Pages output: ${path.relative(root, output)}`);
