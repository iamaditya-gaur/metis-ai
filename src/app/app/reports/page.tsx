import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { GlassPanel } from "@/components/glass-panel";
import { AuthedReportingStudio } from "@/components/authed-reporting-studio";
import { createClient } from "@/lib/supabase/server";

export type ReportConnection = {
  id: string;
  label: string;
  account_count: number | null;
  last_synced_at: string | null;
};

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meta_connections")
    .select("id, label, account_count, last_synced_at")
    .order("created_at", { ascending: false });

  const connections: ReportConnection[] = data ?? [];

  return (
    <AppShell
      eyebrow="Reports"
      title="Generate a Meta ads summary"
      description="Pick a connection, set the window, drop in past client messages — Metis returns the factual read plus a send-ready client update."
    >
      {connections.length === 0 ? (
        <GlassPanel
          eyebrow="Get started in two steps"
          title="Connect a Meta account to generate your first report"
          description="Save an access token once, and every future report skips the paste step."
        >
          <div className="reports-empty-steps">
            <div className="reports-empty-step">
              <span className="reports-empty-step-num" aria-hidden="true">
                1
              </span>
              <div>
                <p className="reports-empty-step-title">
                  Add a Meta access token
                </p>
                <p className="reports-empty-step-copy">
                  Takes about 30 seconds. Tokens are encrypted at rest and
                  never appear in reports.
                </p>
                <Link
                  href="/app/connections?firstrun=1"
                  className="product-button"
                >
                  Add a connection
                </Link>
              </div>
            </div>
            <div className="reports-empty-step" data-locked="true">
              <span className="reports-empty-step-num" aria-hidden="true">
                2
              </span>
              <div>
                <p className="reports-empty-step-title">
                  Pick a window and generate
                </p>
                <p className="reports-empty-step-copy">
                  Once a connection is saved, this page unlocks the full
                  reporting studio.
                </p>
              </div>
            </div>
          </div>
        </GlassPanel>
      ) : (
        <Suspense fallback={null}>
          <AuthedReportingStudio connections={connections} />
        </Suspense>
      )}
    </AppShell>
  );
}
