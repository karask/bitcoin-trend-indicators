"use client";

import { formatDate } from "../lib/display";
import type { IndicatorRole, RegimeState, SignalSnapshot } from "../lib/regimes";

export type MobileModel = { id: string; shortName: string; family: string; role?: IndicatorRole; dailyState?: RegimeState | null; weeklyState?: RegimeState | null; lastFlip: number | null; nextCondition: string; explanation: string; readiness?: SignalSnapshot["readiness"] };

export default function MobileMatrix({ rows, selectedId, onSelect }: { rows: MobileModel[]; selectedId: string; onSelect: (id: string) => void }) {
  const state = (value: RegimeState | null | undefined, row: MobileModel) => {
    if (!value) return "Not ready / N/A";
    if (row.role === "valuation") return row.id === "mayer" ? "Price-ratio context" : value === "bull" ? "Above baseline" : "Below baseline";
    if (row.role === "confirmation") return value === "bull" ? "Positive" : value === "bear" ? "Negative" : "No confirmation";
    if (row.role === "exit") return value === "bull" ? "Stop intact" : "Exit condition";
    return value === "bull" ? "Bullish" : value === "bear" ? "Bearish" : "Neutral";
  };
  return <div className="mobile-matrix">{rows.map(row => <details className={row.id === selectedId ? "selected" : ""} key={row.id}><summary><strong>{row.shortName}</strong><span>1D · {state(row.dailyState, row)}<br />1W · {state(row.weeklyState, row)}</span></summary><div><p>{row.family} · {row.nextCondition}</p><p>{row.explanation}</p><p>{row.readiness?.ready === false ? `Insufficient history: ${row.readiness.availableCandles} / ${row.readiness.requiredCandles} candles.` : `Last reversal signal candle: ${formatDate(row.lastFlip)}`}</p><button type="button" onClick={() => { onSelect(row.id); document.querySelector(".hero-grid")?.scrollIntoView({ behavior: "auto", block: "start" }); }}>View {row.shortName} chart</button></div></details>)}</div>;
}
