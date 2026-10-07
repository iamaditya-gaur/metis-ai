import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AccessCodeGate } from "@/components/access-code-gate";
import { StandaloneReportingFlow } from "@/components/standalone-reporting-flow";
import {
  ACCESS_COOKIE_NAME,
  hasValidAccessCookie,
  isAccessGateConfigured,
} from "@/lib/auth/access-gate";
import { isMetisPaused } from "@/lib/site-mode";

export const metadata: Metadata = {
  title: "Metis AI Reporting | Generate Meta Ads Summaries That Sound Like You",
  description:
    "Connect a Meta access token, pull ad performance, and generate fact-grounded Meta ads summaries that sound much closer to your past client or team reporting updates.",
};

type ReportingPageProps = {
  searchParams: Promise<{ access?: string }>;
};

export default async function ReportingPage({ searchParams }: ReportingPageProps) {
  const cookieStore = await cookies();
  const unlocked = hasValidAccessCookie(cookieStore.get(ACCESS_COOKIE_NAME)?.value);

  if (!unlocked) {
    const { access } = await searchParams;
    return <AccessCodeGate status={access} configured={isAccessGateConfigured()} />;
  }

  return <StandaloneReportingFlow accountsPaused={isMetisPaused()} />;
}
