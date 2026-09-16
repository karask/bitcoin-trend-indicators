"use client";

import { timeframeGuidance, type GuidanceMarket } from "../lib/timeframe-guidance";

export default function TimeframeHint({ indicator, market, overview = false }: { indicator: string; market: GuidanceMarket; overview?: boolean }) {
  const guidance = timeframeGuidance(indicator, market);
  if (!guidance) return null;
  const timing = market === "crypto"
    ? "Confirm completed candles: daily at 00:00 UTC; weekly at Monday 00:00 UTC."
    : "Daily candles are completed trading sessions; weekly candles confirm after the final session of the trading week.";
  const caveat = "Workflow guidance, not a proven performance optimum.";
  return <details className="timeframe-hint" key={`${indicator}-${market}`}>
    <summary title={`${guidance.explanation} ${timing} ${caveat}`}>Suggested candles · <b>{guidance.label}</b> <span aria-hidden="true">ⓘ</span></summary>
    <div className="timeframe-hint-body">
      <p>{guidance.explanation}</p>
      <p>{timing}</p>
      {overview && <p>The overview’s level and flip columns keep their labeled timeframe; this suggestion does not switch them.</p>}
      <small>{caveat}</small>
    </div>
  </details>;
}
