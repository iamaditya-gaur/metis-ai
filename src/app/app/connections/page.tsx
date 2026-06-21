import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ConnectionsManager } from "@/components/connections-manager";
import { createClient } from "@/lib/supabase/server";

import { deleteConnectionAction } from "./actions";

export type ConnectionRow = {
  id: string;
  label: string;
  account_count: number | null;
  last_synced_at: string | null;
  created_at: string;
};

type PageProps = {
  searchParams: Promise<{ firstrun?: string }>;
};

export default async function ConnectionsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/app/connections");
  }

  const { data: connections } = await supabase
    .from("meta_connections")
    .select("id, label, account_count, last_synced_at, created_at")
    .order("created_at", { ascending: false });

  const rows: ConnectionRow[] = connections ?? [];
  const params = await searchParams;
  const isFirstRunRequest = params.firstrun === "1";
  const isEmpty = rows.length === 0;
  // Open the form by default for first-time users OR anyone who explicitly
  // arrived via the `firstrun=1` deep link from the reports empty state.
  const startFormOpen = isEmpty || isFirstRunRequest;
  // Use first-run copy only when the user genuinely has no connections yet —
  // existing users adding a second connection get the regular copy.
  const firstRun = isEmpty;

  const title = firstRun
    ? "Connect your first Meta account"
    : "Your Meta connections";
  const description = firstRun
    ? "Save an access token once and every report you generate skips the paste step."
    : "Tokens stay encrypted and never appear in any output. Add one per ad account or agency client.";

  return (
    <AppShell eyebrow="Connections" title={title} description={description}>
      <ConnectionsManager
        rows={rows}
        deleteAction={deleteConnectionAction}
        startFormOpen={startFormOpen}
        firstRun={firstRun}
      />
    </AppShell>
  );
}
