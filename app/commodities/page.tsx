import type { Metadata } from "next";
import CommodityDashboard from "./CommodityDashboard";

export const metadata: Metadata = {
  title: "Commodity Regime Lab",
  description: "Gold and silver futures trend research. Yahoo Finance prices in USD per troy ounce, not spot metal.",
};
export default function CommoditiesPage() { return <CommodityDashboard />; }
