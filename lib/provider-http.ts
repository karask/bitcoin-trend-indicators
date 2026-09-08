/** Public market-data transport. Serializes each provider within this runtime. */
export class ProviderCooldownError extends Error {
  readonly retryAt: number;
  constructor(retryAt: number) { super("Provider rate limit reached; retry after the cooldown"); this.retryAt = retryAt; }
}

export function retryAfterMs(value: string | null, now: number): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export function createProviderClient(options: { fetcher?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>; intervalMs?: number } = {}) {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const interval = options.intervalMs ?? 1_250;
  const lanes = new Map<string, { tail: Promise<void>; next: number; cooldown: number }>();
  return (url: string, headers?: Record<string, string>): Promise<{ body: unknown; raw: string }> => {
    const host = new URL(url).hostname;
    // A rate limit is not permission to retry the same exchange on another host.
    const key = host.includes("binance") ? "binance" : host;
    let lane = lanes.get(key);
    if (!lane) { lane = { tail: Promise.resolve(), next: 0, cooldown: 0 }; lanes.set(key, lane); }
    const state = lane;
    const run = state.tail.then(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (state.cooldown > now()) throw new ProviderCooldownError(state.cooldown);
        if (state.next > now()) await sleep(state.next - now());
        state.next = now() + interval;
        const response = await (options.fetcher ?? fetch)(url, { headers, signal: AbortSignal.timeout(12_000), cache: "no-store" });
        if (response.ok) {
          const raw = await response.text(), body = JSON.parse(raw);
          if (Array.isArray(body?.error) && body.error.some((message: unknown) => typeof message === "string" && /rate limit|throttled/i.test(message))) {
            state.cooldown = now() + 60_000;
            throw new ProviderCooldownError(state.cooldown);
          }
          return { body, raw };
        }
        const retry = retryAfterMs(response.headers.get("Retry-After"), now());
        await response.body?.cancel();
        if (response.status === 429 || response.status === 418 || (response.status >= 500 && retry != null && retry > 5_000)) {
          state.cooldown = now() + Math.max(1_000, retry ?? 60_000);
          throw new ProviderCooldownError(state.cooldown);
        }
        if (response.status < 500 || attempt === 1) throw new Error(`Provider returned HTTP ${response.status}`);
        await sleep(Math.max(1_000, retry ?? 1_000));
      }
      throw new Error("Provider retry limit exhausted");
    });
    state.tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

export const providerJson = createProviderClient();
