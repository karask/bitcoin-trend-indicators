import { KK_SEPTEMBER28_EVIDENCE } from "./kk-september28-evidence.ts";
import type { Timeframe } from "./regimes.ts";

/** Reliability belongs to the KK calibration and timeframe, not the asset or provider. */
export function kkCalibrationWarning(asset: string, timeframe: Timeframe): { label: string; detail: string } | null {
  const reference = KK_SEPTEMBER28_EVIDENCE.find(row => row.asset === asset && row.timeframe === timeframe);
  if (reference?.status === "unresolved") return { label: "Unreliable KK calibration", detail: reference.note };
  if (reference?.status === "timing-difference") return { label: "KK timing mismatch", detail: reference.note };
  if (reference && timeframe === "1d") return { label: "Low-confidence KK calibration", detail: reference.note };
  if ((asset === "strc" && timeframe === "1w") || (timeframe === "1d" && ["vvv", "intc", "mrvl", "amd", "amzn", "meta", "pltr"].includes(asset))) {
    return { label: "Uncalibrated KK", detail: "No reference chart was supplied for this timeframe. The default ATR 10 / multiplier 3 is unverified." };
  }
  return null;
}
