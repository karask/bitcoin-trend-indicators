export type GuidanceMarket = "crypto" | "stock" | "commodity";
type CandleGuidance = { label: string; explanation: string };

// Workflow defaults for intermediate trends and longer cycle context, not fitted returns.
const GUIDANCE: Record<string, CandleGuidance> = {
  support_band: { label: "1W", explanation: "Weekly candles preserve the 20-week SMA / 21-week EMA support band for the broader trend. Daily candles turn it into a shorter 20/21-day filter." },
  supertrend: { label: "1W", explanation: "Use weekly closes for the major trend and the confirmed reversal level. Daily signals react sooner but can reverse more frequently. Supertrend works on either timeframe; weekly is a cycle-tracking preference." },
  kk_supertrend: { label: "1W", explanation: "Weekly is the primary view for the app’s crypto reference calibrations. Daily is a separate calibrated signal with its own presets and five-close confirmation. Matching a screenshot does not establish trading performance." },
  smma_ribbon: { label: "1D", explanation: "Daily candles make the 15/19/25/29 ribbon useful for intermediate trend changes. Watch full bullish or bearish stacking; tangled averages are neutral. Weekly is a slower 15–29-week context view. This is a community proxy, not the official Larsson Line." },
  kk_50_200_ema: { label: "1W", explanation: "Weekly is the reference view: a completed weekly close must be strictly above both the 50-week and 200-week EMAs to be bullish. The 1D alternative uses 50-day and 200-day EMAs and a completed daily close. It follows a shorter trend horizon; it does not display the weekly averages on daily candles." },
  kk_200_ma: { label: "1D / 1W", explanation: "On 1D, the range compares the completed daily close with the 200-day SMA. On 1W, the standalone signal compares the weekly close with the 200-week SMA. The combined weekly chart shows both lines and colors the range against the 200-day SMA; the weekly status card remains the 200-week signal." },
  kk_ema_ribbon: { label: "1D", explanation: "Calibrated to the September 14, 2026 daily BTC, ETH and SOL screenshots. EMA 32/58 on Close forms the visible ribbon; hidden EMA 34/48 alignment approximates the grey transitions. Weekly is also available using the same lengths in weeks, giving a slower, uncalibrated view. Colour logic is provisional; other assets are uncalibrated." },
  super_guppy: { label: "1D", explanation: "Use daily candles to read agreement, separation and compression between the Trader and Investor EMA groups. Weekly stretches the slow group to 25–70 weeks for cycle context. Gray can mean a pullback or an unestablished trend, not an automatic exit. The author does not prescribe one optimal timeframe." },
  long_sma: { label: "1D", explanation: "Use the 200-day SMA as the primary long-trend baseline. The weekly view uses a 30-week SMA: a useful companion, but a different calculation." },
  donchian_20_10: { label: "1D", explanation: "Daily candles track intermediate breakouts above the prior 20-bar high and breakdowns below the prior 10-bar low. Weekly makes these 20-week and 10-week channels for a much slower strategy." },
  ichimoku: { label: "1D", explanation: "Daily 9/26/52 gives a more responsive cloud view for intermediate structure. Weekly is useful for longer cycle context. Read price relative to the correctly displaced cloud." },
  macd: { label: "1W", explanation: "Use weekly 12/26/9 for cycle momentum; daily for earlier changes within that cycle. Choose the timeframe of the trend you want to confirm." },
  psar: { label: "1D", explanation: "Daily candles provide a responsive trailing view within an established trend. Weekly is slower. Repeated reversals in sideways markets make SAR less useful as a standalone trend decision." },
  vortex: { label: "1D", explanation: "Daily 14-period Vortex tracks intermediate directional changes. Weekly provides slower confirmation. Read VI+ against VI− on the timeframe of interest." },
  heikin_ashi: { label: "1W", explanation: "Weekly Heikin Ashi smooths the broader trend visually; daily shows shorter changes. These candles use synthetic prices, so evaluate executions against ordinary market OHLC prices." },
  golden_cross: { label: "1D", explanation: "This model compares the 50-day and 200-day SMAs. Daily candles are part of its definition; a weekly 50/200 cross would be a different model." },
  adx: { label: "Match trend", explanation: "Use weekly ADX/DMI to confirm a weekly trend, or daily to assess a daily setup. ADX measures strength; +DI and −DI supply direction. A daily reading does not confirm the strength of a weekly signal." },
  chandelier: { label: "Match position", explanation: "Use daily 22/3 for daily swing management, or weekly for a deliberately slower trailing exit. Keep the exit timeframe consistent with the position’s planned horizon." },
  mayer: { label: "1D", explanation: "Price divided by the 200-day SMA: daily is part of the definition. Use this as valuation context, not a standalone trend or entry signal." },
};

export function timeframeGuidance(id: string, market: GuidanceMarket): CandleGuidance | undefined {
  const guidance = GUIDANCE[id];
  if (!guidance) return undefined;
  if (market === "stock" && id === "kk_supertrend") return { label: "1W", explanation: "Weekly remains the primary stock view for KK Supertrend. Daily stocks use their own approximate preset family and five-close confirmation. Screenshot matching does not establish trading performance." };
  if (market === "commodity" && id === "kk_supertrend") return { label: "1W", explanation: "Weekly remains the primary Gold and Silver KK Supertrend view. Daily futures use a separate approximate preset family and five-close confirmation. Contract rolls can affect both levels." };
  if (market === "stock" && id === "support_band") return { label: "1W", explanation: "Weekly 20 SMA / 21 EMA provides a broad stock-trend filter. This is an application of the band to equities, not a stock-validated optimum. Daily uses 20/21 trading sessions for a shorter view." };
  return guidance;
}
