import Link from "next/link";

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
      title="Generate a Meta ads summary that sounds like you"
      description="Pick a saved connection, set the reporting window, drop in past client messages, and Metis returns the factual read plus a send-ready client update."
    >
      {connections.length === 0 ? (
        <GlassPanel
          eyebrow="No connections yet"
          title="Connect a Meta account to start"
          description="Saved connections let you skip pasting a token every time you run a report."
        >
          <div className="reports-empty">
            <p className="product-help">
              Add one Meta access token in Connections, then come back here
              and generate your first report in seconds.
            </p>
            <Link href="/app/connections" className="product-button">
              Add your first connection
            </Link>
          </div>
        </GlassPanel>
      ) : (
        <AuthedReportingStudio connections={connections} />
      )}
    </AppShell>
  );
}
