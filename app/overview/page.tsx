import type { Metadata } from "next";
import AssetOverview from "./AssetOverview";

export const metadata: Metadata = { title: "Asset Overview", description: "Compare daily and weekly indicators across every crypto and stock asset in Regime Lab." };
export default function OverviewPage() { return <AssetOverview />; }
