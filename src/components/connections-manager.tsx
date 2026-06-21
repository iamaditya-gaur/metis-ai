"use client";

import { useState } from "react";

import { AddConnectionForm } from "@/components/add-connection-form";
import { ConnectionsList } from "@/components/connections-list";
import { GlassPanel } from "@/components/glass-panel";

import type { ConnectionRow } from "@/app/app/connections/page";

type Props = {
  rows: ConnectionRow[];
  deleteAction: (formData: FormData) => Promise<void>;
  startFormOpen: boolean;
  firstRun: boolean;
};

export function ConnectionsManager({
  rows,
  deleteAction,
  startFormOpen,
  firstRun,
}: Props) {
  const [isFormOpen, setIsFormOpen] = useState(startFormOpen);

  return (
    <div className="connections-surface">
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
              : "Paste a Meta access token"
          }
          description={
            firstRun
              ? "Takes about 30 seconds. Metis verifies the token, saves it encrypted, and takes you straight to your first report."
              : "Useful for agency setups with multiple clients. Metis verifies the token before saving."
          }
          actions={
            rows.length > 0 ? (
              <button
                type="button"
                className="product-button"
                data-variant="secondary"
                onClick={() => setIsFormOpen(false)}
              >
                Cancel
              </button>
            ) : null
          }
        >
          <AddConnectionForm />
        </GlassPanel>
      ) : null}
    </div>
  );
}
