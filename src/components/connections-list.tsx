"use client";

import { useTransition } from "react";

import { StatusPill } from "@/components/status-pill";

import type { ConnectionRow } from "@/app/app/connections/page";

type Props = {
  rows: ConnectionRow[];
  deleteAction: (formData: FormData) => Promise<void>;
};

function formatSyncedAt(value: string | null): string {
  if (!value) return "Never synced";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "Never synced";
  const diffMs = Date.now() - ts.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return ts.toLocaleDateString();
}

export function ConnectionsList({ rows, deleteAction }: Props) {
  if (rows.length === 0) {
    return (
      <div className="connections-empty">
        <p className="product-help">
          You haven&apos;t saved any Meta tokens yet. Add one to skip pasting it
          every time you generate a report.
        </p>
      </div>
    );
  }

  return (
    <ul className="connections-list" role="list">
      {rows.map((row) => (
        <li key={row.id} className="connections-row">
          <div className="connections-row-main">
            <div className="connections-row-head">
              <p className="connections-row-label">{row.label}</p>
              <StatusPill
                label={`${row.account_count ?? 0} account${row.account_count === 1 ? "" : "s"}`}
                tone="info"
              />
            </div>
            <p className="connections-row-meta">
              Last verified {formatSyncedAt(row.last_synced_at)}
            </p>
          </div>
          <DeleteButton id={row.id} action={deleteAction} />
        </li>
      ))}
    </ul>
  );
}

function DeleteButton({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <form
      action={(formData) => {
        if (
          typeof window !== "undefined" &&
          !window.confirm("Remove this connection? You can always add it again.")
        ) {
          return;
        }
        startTransition(() => action(formData));
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="product-button"
        data-variant="secondary"
        disabled={isPending}
      >
        {isPending ? "Removing…" : "Remove"}
      </button>
    </form>
  );
}
