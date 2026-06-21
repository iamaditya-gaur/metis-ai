"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { GlassPanel } from "@/components/glass-panel";
import { ReportingStudio } from "@/components/reporting-studio";
import { StatusPill } from "@/components/status-pill";
import type { AccountOption } from "@/lib/metis/types";

import type { ReportConnection } from "@/app/app/reports/page";

type Props = {
  connections: ReportConnection[];
};

export function AuthedReportingStudio({ connections }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Pre-select connection from ?connection=<id> when arriving from a fresh
  // save; otherwise default to the most recently saved one.
  const initialConnectionId =
    searchParams.get("connection") ?? connections[0]?.id ?? "";
  const showSavedToast = searchParams.get("saved") === "1";

  const [connectionId, setConnectionId] = useState(initialConnectionId);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsError, setAccountsError] = useState("");
  const [isLoadingAccounts, startLoadingAccounts] = useTransition();
  const [toastDismissed, setToastDismissed] = useState(false);
  const stripParamsRan = useRef(false);

  const loadAccounts = useCallback(
    (id: string) => {
      if (!id) return;
      startLoadingAccounts(async () => {
        setAccountsError("");
        try {
          const response = await fetch("/api/metis/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId: id }),
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
            error instanceof Error
              ? error.message
              : "Could not load ad accounts.",
          );
        }
      });
    },
    [],
  );

  useEffect(() => {
    loadAccounts(connectionId);
  }, [connectionId, loadAccounts]);

  // Strip ?connection= and ?saved= from the URL after first paint so a
  // refresh doesn't re-fire the toast or fight a manual connection switch.
  useEffect(() => {
    if (stripParamsRan.current) return;
    if (!searchParams.get("connection") && !searchParams.get("saved")) return;
    stripParamsRan.current = true;
    router.replace("/app/reports", { scroll: false });
  }, [router, searchParams]);

  const activeConnection = connections.find((c) => c.id === connectionId);

  return (
    <div className="authed-reports">
      {showSavedToast && !toastDismissed ? (
        <div className="reports-toast" role="status">
          <span aria-hidden="true">✓</span>
          <span>
            Connection saved. Pick a window below to generate your first report.
          </span>
          <button
            type="button"
            className="reports-toast-dismiss"
            onClick={() => setToastDismissed(true)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ) : null}

      <GlassPanel
        className="authed-reports-picker"
        eyebrow="Connection"
        title="Which Meta account?"
        description="Switch between your saved connections. Ad accounts load inline below."
        actions={
          activeConnection?.account_count != null && !isLoadingAccounts ? (
            <StatusPill
              label={`${activeConnection.account_count} account${activeConnection.account_count === 1 ? "" : "s"}`}
              tone="info"
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
              disabled={isLoadingAccounts}
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

        {isLoadingAccounts ? (
          <div className="accounts-loading-inline" role="status">
            <span className="accounts-loading-spinner" aria-hidden />
            <span>Loading ad accounts from Meta…</span>
          </div>
        ) : null}

        {accountsError && !isLoadingAccounts ? (
          <div className="accounts-error-inline" role="alert">
            <span>{accountsError}</span>
            <button
              type="button"
              className="accounts-error-retry"
              onClick={() => loadAccounts(connectionId)}
            >
              Retry
            </button>
          </div>
        ) : null}
      </GlassPanel>

      {accounts.length > 0 && !isLoadingAccounts ? (
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
