import type { Metadata } from "next";
import StockDashboard from "./StockDashboard";

export const metadata: Metadata = {
  title: "Stock Regime Lab",
  description: "Transparent daily and weekly NASDAQ stock trend-regime research using adjusted Tiingo history.",
};

export default function StocksPage() {
  return <StockDashboard />;
}
