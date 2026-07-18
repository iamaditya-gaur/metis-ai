"use client";

import { useState } from "react";

import { AddConnectionForm } from "@/components/add-connection-form";
import { ConnectionsList } from "@/components/connections-list";
import { GlassPanel } from "@/components/glass-panel";
import { MetaConnectButton } from "@/components/meta-connect-button";

import type { ConnectionRow } from "@/app/app/connections/page";

type Props = {
  rows: ConnectionRow[];
  deleteAction: (formData: FormData) => Promise<void>;
  startFormOpen: boolean;
  firstRun: boolean;
  oauthError: string | null;
};

export function ConnectionsManager({
  rows,
  deleteAction,
  startFormOpen,
  firstRun,
  oauthError,
}: Props) {
  const [isFormOpen, setIsFormOpen] = useState(startFormOpen);
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <div className="connections-surface">
      {oauthError ? (
        <p className="auth-feedback auth-feedback-error" role="alert">
          {oauthError}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <GlassPanel
          eyebrow="Saved connections"
          title={
            rows.length === 1
              ? "1 connection saved"
              : `${rows.length} connections saved`
          }
          description="Pick from these when you create a new report. Each one shows the accounts it can reach."
          actions={
            !isFormOpen ? (
              <button
                type="button"
                className="product-button"
                onClick={() => setIsFormOpen(true)}
              >
                + Add Meta connection
              </button>
            ) : null
          }
        >
          <ConnectionsList rows={rows} deleteAction={deleteAction} />
        </GlassPanel>
      ) : null}

      {isFormOpen ? (
        <GlassPanel
          eyebrow={firstRun ? "Get started" : "Add a connection"}
          title={
            firstRun
              ? "Connect your first Meta account"
              : "Connect a Meta account"
          }
          description={
            firstRun
              ? "One click with your Facebook login. Metis only asks for read-only ads access, verifies it, and takes you straight to your first report."
              : "Useful for agency setups with multiple clients. Metis verifies access before saving."
          }
          actions={
            rows.length > 0 ? (
              <button
                type="button"
                className="product-button"
                data-variant="secondary"
                onClick={() => {
                  setIsFormOpen(false);
                  setManualOpen(false);
                }}
              >
                Cancel
              </button>
            ) : null
          }
        >
          <div className="stack-md">
            <div>
              <MetaConnectButton />
              <p className="product-help">
                Recommended: you approve read-only access on Meta&apos;s own
                screen. No tokens to copy, nothing to expire by hand.
              </p>
            </div>

            {manualOpen ? (
              <AddConnectionForm />
            ) : (
              <button
                type="button"
                className="product-button"
                data-variant="secondary"
                onClick={() => setManualOpen(true)}
              >
                Prefer to paste a token manually?
              </button>
            )}
          </div>
        </GlassPanel>
      ) : null}
    </div>
  );
}
