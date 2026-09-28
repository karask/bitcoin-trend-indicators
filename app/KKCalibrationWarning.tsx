import { kkCalibrationWarning } from "../lib/kk-reliability";
import type { Timeframe } from "../lib/regimes";

export default function KKCalibrationWarning({ asset, timeframe, indicator = "kk_supertrend", compact = false }: { asset: string; timeframe: Timeframe; indicator?: string; compact?: boolean }) {
  if (indicator !== "kk_supertrend") return null;
  const warning = kkCalibrationWarning(asset, timeframe);
  if (!warning) return null;
  if (compact) return <span className="kk-reliability-badge" title={warning.detail}>{warning.label}</span>;
  return <aside className="readiness-notice kk-reliability-warning" aria-label="KK calibration reliability"><strong>{warning.label} · {asset.toUpperCase()} · {timeframe === "1d" ? "Daily" : "Weekly"}</strong><p>{warning.detail}</p><p>Treat this KK signal as unverified. See the calibration notebook for the reference comparison.</p></aside>;
}
