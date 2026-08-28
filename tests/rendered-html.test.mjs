import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
  assert.match(html, /Trend regimes, without the black box/i);
  assert.match(html, /Loading market research/i);
  assert.match(html, /Next weekly close/i);
  assert.match(html, /Sunday 23:59:59 UTC/i);
  assert.match(html, /LIVE.*BTC.*SPOT/i);
  assert.match(html, /Ethereum/i);
  assert.match(html, /Solana/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /crypto-regime-theme/i);
  assert.match(html, /Switch to dark theme/i);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);

  const stockResponse = await fetch(`http://127.0.0.1:${port}/stocks`, { headers: { accept: "text/html" } });
  assert.equal(stockResponse.status, 200);
  const stockHtml = await stockResponse.text();
  assert.match(stockHtml, /<title>Stock Regime Lab · Crypto Regime Lab<\/title>/i);
  assert.match(stockHtml, /Equity trends, on completed sessions/i);
  assert.match(stockHtml, /Connect your free Tiingo API token/i);
  assert.match(stockHtml, /TSLA/i);
  assert.match(stockHtml, /GOOGL/i);
  assert.match(stockHtml, /NVDA/i);
  assert.match(stockHtml, /session storage/i);
  assert.match(stockHtml, /IndexedDB/i);
  assert.match(stockHtml, /overlap plus new sessions/i);
  assert.doesNotMatch(stockHtml, /Binance|Kraken|Live.*spot|confirmation clock/i);
});
