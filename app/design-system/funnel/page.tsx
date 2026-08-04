import type { Metadata } from "next";
import { FunnelDemoClient } from "./funnel-demo-client";

export const metadata: Metadata = {
  title: "Funnel airline — Design system",
  description: "Démo des composants funnel (SearchBar, cartes, stepper, prix).",
};

export default function FunnelDesignSystemPage() {
  return <FunnelDemoClient />;
}
