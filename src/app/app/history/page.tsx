import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { HistoryRowActions } from "@/components/history-row-actions";
import { StatusPill } from "@/components/status-pill";
import { defaultAccountBadges } from "@/lib/metis/types";
import type { StatusTone } from "@/lib/metis/types";

type HistoryRow = {
  run_id: string;
  started_at: string;
  finished_at: string | null;
  selected_account_id: string | null;
  summary: string | null;
  status: string;
  total_cost_usd: number | string | null;
};

type SortKey = "newest" | "oldest" | "cost" | "status";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "cost", label: "Highest cost" },
  { id: "status", label: "Status — successes first" },
];

function coerceSort(value: string | undefined): SortKey {
  if (value === "oldest" || value === "cost" || value === "status") return value;
  return "newest";
}

function toneForStatus(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("success") || s.includes("complete") || s === "ok") return "success";
  if (s.includes("error") || s.includes("fail")) return "warning";
  if (s.includes("run") || s.includes("pending") || s.includes("progress")) return "info";
  return "neutral";
}

function formatStarted(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCost(value: number | string | null): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  if (num === 0) return "$0.00";
  if (num < 0.01) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(2)}`;
}

function truncate(text: string | null, max: number): string {
  if (!text) return "No summary recorded yet.";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

type Props = {
  searchParams: Promise<{ sort?: string }>;
};

export default async function HistoryPage({ searchParams }: Props) {
  const { sort: sortParam } = await searchParams;
  const sort = coerceSort(sortParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/app/history");
  }

  let query = supabase
    .from("metis_runs")
    .select(
      "run_id, started_at, finished_at, selected_account_id, summary, status, total_cost_usd",
    )
    .limit(50);

  if (sort === "oldest") {
    query = query.order("started_at", { ascending: true });
  } else if (sort === "cost") {
    query = query
      .order("total_cost_usd", { ascending: false, nullsFirst: false })
      .order("started_at", { ascending: false });
  } else if (sort === "status") {
    // successes first, then everything else by recency
    query = query
      .order("status", { ascending: true })
      .order("started_at", { ascending: false });
  } else {
    query = query.order("started_at", { ascending: false });
  }

  const { data } = await query;
  const rows: HistoryRow[] = (data ?? []) as HistoryRow[];

  return (
    <AppShell
      eyebrow="History"
      title="Your saved reports"
      description="Every Metis run you've kicked off. Open one to see the client-style message, the executive read, and the full call log."
      sidebarAccounts={defaultAccountBadges}
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No runs yet"
          copy="Once you generate a report, it'll show up here with the full call log and cost breakdown."
        />
      ) : (
        <>
          <form className="history-toolbar" method="get" action="/app/history">
            <label className="history-toolbar-label" htmlFor="history-sort">
              Sort
            </label>
            <div className="history-toolbar-select">
              <select
                id="history-sort"
                name="sort"
                defaultValue={sort}
                className="product-select"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="product-select-indicator" aria-hidden="true" />
            </div>
            <button type="submit" className="history-toolbar-apply">
              Apply
            </button>
          </form>

          <ul className="product-list">
            {rows.map((row) => (
              <li key={row.run_id} className="product-list-item history-row">
                <div className="history-row-head">
                  <Link
                    href={`/app/history/${encodeURIComponent(row.run_id)}`}
                    className="product-button history-row-open"
                  >
                    Open run
                  </Link>
                  <div className="history-row-status">
                    <StatusPill label={row.status} tone={toneForStatus(row.status)} />
                    <HistoryRowActions runId={row.run_id} />
                  </div>
                </div>
                <p className="history-row-summary">{truncate(row.summary, 140)}</p>
                <div className="product-list-meta history-row-meta">
                  <span>{formatStarted(row.started_at)}</span>
                  <span>•</span>
                  <span>Cost {formatCost(row.total_cost_usd)}</span>
                  {row.selected_account_id ? (
                    <>
                      <span>•</span>
                      <span>Account {row.selected_account_id}</span>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
