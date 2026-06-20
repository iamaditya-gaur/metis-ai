import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { GlassPanel } from "@/components/glass-panel";
import { ConnectionsList } from "@/components/connections-list";
import { AddConnectionForm } from "@/components/add-connection-form";
import { deleteConnectionAction } from "./actions";

export type ConnectionRow = {
  id: string;
  label: string;
  account_count: number | null;
  last_synced_at: string | null;
  created_at: string;
};

export default async function ConnectionsPage() {
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

  return (
    <div className="connections-page">
      <header className="product-topbar">
        <div className="product-topbar-copy">
          <span className="product-eyebrow">Connections</span>
          <h1 className="product-title">Your Meta accounts</h1>
          <p className="product-description">
            Saved tokens stay encrypted and never appear in any output. Add one
            per ad account or agency client.
          </p>
        </div>
      </header>

      <div className="connections-grid">
        <GlassPanel
          className="connections-list-panel"
          eyebrow="Saved connections"
          title={rows.length === 0 ? "No connections yet" : `${rows.length} saved`}
          description={
            rows.length === 0
              ? "Add your first Meta access token on the right to start generating reports without re-pasting."
              : "Pick from these when you create a new report. Each one shows the accounts it can reach."
          }
        >
          <ConnectionsList rows={rows} deleteAction={deleteConnectionAction} />
        </GlassPanel>

        <GlassPanel
          className="connections-add-panel"
          eyebrow="Add a connection"
          title="Paste a Meta access token"
          description="Give it a label so you remember which client or account it's for. Metis verifies the token before saving."
        >
          <AddConnectionForm />
        </GlassPanel>
      </div>
    </div>
  );
}
