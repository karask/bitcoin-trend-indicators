import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import test from "node:test";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test("server-renders the research PWA shell", async t => {
  const port = await freePort();
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
  let diagnostics = "";
  server.stdout.on("data", chunk => { diagnostics += chunk; });
  server.stderr.on("data", chunk => { diagnostics += chunk; });
  t.after(() => { if (!server.killed) server.kill("SIGTERM"); });
  let response;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/`, { headers: { accept: "text/html" } });
      if (response.ok) break;
    } catch {
      // The server may still be starting; retry briefly.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(response, `Next.js did not start. ${diagnostics}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Crypto Regime Lab<\/title>/i);
  assert.match(html, /Checking your secure session/i);
  assert.doesNotMatch(html, /LIVE.*BTC.*SPOT/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /crypto-regime-theme/i);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);

  const stockResponse = await fetch(`http://127.0.0.1:${port}/stocks`, { headers: { accept: "text/html" } });
  assert.equal(stockResponse.status, 200);
  const stockHtml = await stockResponse.text();
  assert.match(stockHtml, /<title>Stock Regime Lab · Crypto Regime Lab<\/title>/i);
  assert.match(stockHtml, /Checking your secure session/i);
  assert.doesNotMatch(stockHtml, /Binance|Kraken|Live.*spot|confirmation clock/i);

  const loginResponse = await fetch(`http://127.0.0.1:${port}/login`, { headers: { accept: "text/html" } });
  assert.equal(loginResponse.status, 200);
  const loginHtml = await loginResponse.text();
  assert.match(loginHtml, /<title>Register or sign in · Crypto Regime Lab<\/title>/i);
  assert.match(loginHtml, /Continue with email/i);
  assert.match(loginHtml, /Email me a code/i);
  assert.match(loginHtml, /No password is needed/i);
  assert.match(loginHtml, /privacy notice/i);
  assert.doesNotMatch(loginHtml, /Binance|Kraken|Tiingo API token/i);

  const privacyResponse = await fetch(`http://127.0.0.1:${port}/privacy`, { headers: { accept: "text/html" } });
  assert.equal(privacyResponse.status, 200);
  const privacyHtml = await privacyResponse.text();
  assert.match(privacyHtml, /Authentication privacy/i);
  assert.match(privacyHtml, /plaintext verification codes/i);
  assert.match(privacyHtml, /Delete Account removes your email/i);

  const pagesRoot = "dist/cloudflare-pages";
  const routes = JSON.parse(await readFile(`${pagesRoot}/_routes.json`, "utf8"));
  assert.deepEqual(routes.include, ["/*"]);
  assert.ok(routes.exclude.includes("/_next/static/*"));
  assert.ok(!routes.exclude.some(path => path === "/" || path.startsWith("/stocks") || path.startsWith("/api/")));
  const serviceWorker = await readFile(`${pagesRoot}/sw.js`, "utf8");
  assert.doesNotMatch(serviceWorker, /addEventListener\(["']fetch/);
  assert.doesNotMatch(serviceWorker, /["']\/(?:stocks\/?)?["']/);
  const headers = await readFile(`${pagesRoot}/_headers`, "utf8");
  assert.match(headers, /Cache-Control: no-cache/);
  assert.match(headers, /https:\/\/challenges\.cloudflare\.com/);
});
