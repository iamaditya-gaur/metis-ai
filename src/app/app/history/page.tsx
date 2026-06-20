import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
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

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/app/history");
  }

  const { data } = await supabase
    .from("metis_runs")
    .select(
      "run_id, started_at, finished_at, selected_account_id, summary, status, total_cost_usd",
    )
    .order("started_at", { ascending: false })
    .limit(50);

  const rows: HistoryRow[] = (data ?? []) as HistoryRow[];

  return (
    <AppShell
      eyebrow="History"
      title="Your saved reports"
      description="Every Metis run you've kicked off, with the latest first. Open one to see the full LLM call log, tool calls, and cost breakdown."
      sidebarAccounts={defaultAccountBadges}
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No runs yet"
          copy="Once you generate a report, it'll show up here with the full call log and cost breakdown."
        />
      ) : (
        <ul className="product-list">
          {rows.map((row) => (
            <li key={row.run_id} className="product-list-item">
              <div className="product-list-title">
                <Link
                  href={`/app/history/${encodeURIComponent(row.run_id)}`}
                  className="product-button"
                  data-variant="secondary"
                >
                  Open run
                </Link>
                <StatusPill label={row.status} tone={toneForStatus(row.status)} />
              </div>
              <p className="product-empty-copy" style={{ margin: 0, textAlign: "left" }}>
                {truncate(row.summary, 140)}
              </p>
              <div className="product-list-meta">
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
      )}
    </AppShell>
  );
}
