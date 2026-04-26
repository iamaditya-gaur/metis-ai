import type { Metadata } from "next";

import { StandaloneReportingFlow } from "@/components/standalone-reporting-flow";

export const metadata: Metadata = {
  title: "Metis AI Reporting | Generate Meta Ads Summaries That Sound Like You",
  description:
    "Connect a Meta access token, pull ad performance, and generate fact-grounded Meta ads summaries that sound much closer to your past client or team reporting updates.",
};

export default function ReportingPage() {
  return <StandaloneReportingFlow />;
}
