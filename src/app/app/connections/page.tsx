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
  auth_method: "manual" | "oauth";
  token_expires_at: string | null;
};

type PageProps = {
  searchParams: Promise<{ firstrun?: string; oauth_error?: string }>;
};

// Slugs come from /api/meta/oauth/* redirects. Mapping to fixed copy here
// (instead of echoing URL text) keeps query-param content out of the DOM.
const OAUTH_ERROR_COPY: Record<string, string> = {
  denied: "You cancelled the Meta connect flow. Nothing was saved.",
  state_mismatch: "The connect flow expired or was tampered with. Try again.",
  exchange_failed: "Meta rejected the sign-in exchange. Try again in a minute.",
  no_accounts:
    "Your Meta login worked, but it can't see any ad accounts. Make sure the Facebook user has ad-account access.",
  save_failed: "Connected to Meta but saving failed on our side. Try again.",
  not_configured: "Meta connect isn't configured on this deployment yet.",
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
    .select(
      "id, label, account_count, last_synced_at, created_at, auth_method, token_expires_at",
    )
    .order("created_at", { ascending: false });

  const rows: ConnectionRow[] = connections ?? [];
  const params = await searchParams;
  const isFirstRunRequest = params.firstrun === "1";
  const oauthError = params.oauth_error
    ? (OAUTH_ERROR_COPY[params.oauth_error] ?? "Meta connect failed. Try again.")
    : null;
  const isEmpty = rows.length === 0;
  // Open the form by default for first-time users OR anyone who explicitly
  // arrived via the `firstrun=1` deep link from the reports empty state.
  // An OAuth error also reopens it so the user can retry immediately.
  const startFormOpen = isEmpty || isFirstRunRequest || oauthError !== null;
  // Use first-run copy only when the user genuinely has no connections yet —
  // existing users adding a second connection get the regular copy.
  const firstRun = isEmpty;

  const title = firstRun
    ? "Connect your first Meta account"
    : "Your Meta connections";
  const description = firstRun
    ? "One click with your Facebook login — or paste an access token if you prefer."
    : "Tokens stay encrypted and never appear in any output. Add one per ad account or agency client.";

  return (
    <AppShell eyebrow="Connections" title={title} description={description}>
      <ConnectionsManager
        rows={rows}
        deleteAction={deleteConnectionAction}
        startFormOpen={startFormOpen}
        firstRun={firstRun}
        oauthError={oauthError}
      />
    </AppShell>
  );
}
