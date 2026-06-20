"use client";

import { useEffect, useState, useTransition } from "react";

import { ProcessingOverlay } from "@/components/processing-overlay";
import { GlassPanel } from "@/components/glass-panel";
import { ReportingStudio } from "@/components/reporting-studio";
import { StatusPill } from "@/components/status-pill";
import type { AccountOption } from "@/lib/metis/types";

import type { ReportConnection } from "@/app/app/reports/page";

type Props = {
  connections: ReportConnection[];
};

export function AuthedReportingStudio({ connections }: Props) {
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsError, setAccountsError] = useState("");
  const [isLoadingAccounts, startLoadingAccounts] = useTransition();

  useEffect(() => {
    if (!connectionId) return;

    startLoadingAccounts(async () => {
      setAccountsError("");
      try {
        const response = await fetch("/api/metis/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId }),
        });
        const body = (await response.json()) as {
          accounts?: AccountOption[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(body.message ?? "Could not load ad accounts.");
        }
        setAccounts(body.accounts ?? []);
      } catch (error) {
        setAccounts([]);
        setAccountsError(
          error instanceof Error ? error.message : "Could not load ad accounts.",
        );
      }
    });
  }, [connectionId]);

  const activeConnection = connections.find((c) => c.id === connectionId);

  return (
    <div className="authed-reports">
      <GlassPanel
        className="authed-reports-picker"
        eyebrow="Connection"
        title="Which Meta account?"
        description="Switch between your saved connections. The list of ad accounts loads automatically."
        actions={
          isLoadingAccounts ? (
            <StatusPill label="Loading accounts" tone="info" isActive />
          ) : activeConnection?.account_count != null ? (
            <StatusPill
              label={`${activeConnection.account_count} account${activeConnection.account_count === 1 ? "" : "s"}`}
              tone="info"
            />
          ) : null
        }
        busy={isLoadingAccounts}
        overlay={
          isLoadingAccounts ? (
            <ProcessingOverlay
              eyebrow="Connecting Meta"
              title="Loading ad accounts for this connection"
              description="Metis is decrypting the saved token and checking which ad accounts it can reach."
              steps={["Verify token access", "Load accessible ad accounts"]}
            />
          ) : null
        }
      >
        <div className="product-field">
          <label className="product-label" htmlFor="connection-picker">
            Saved connection
          </label>
          <div className="product-select-wrap">
            <select
              id="connection-picker"
              className="product-select"
              value={connectionId}
              onChange={(event) => setConnectionId(event.target.value)}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="product-select-indicator" aria-hidden />
          </div>
        </div>

        {accountsError ? (
          <div className="product-warning">{accountsError}</div>
        ) : null}
      </GlassPanel>

      {accounts.length > 0 ? (
        <ReportingStudio
          key={connectionId}
          accounts={accounts}
          connectionId={connectionId}
          mode="authed"
        />
      ) : null}
    </div>
  );
}
