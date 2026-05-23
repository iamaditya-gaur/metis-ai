import Link from "next/link";

import { RunFilters } from "@/components/observability/run-filters";
import { listRunFilterOptions, listRuns } from "@/lib/observability/queries";
import type { WorkflowMode } from "@/lib/metis/types";

type SearchParams = Promise<{
  env?: string;
  flowType?: string;
  accountId?: string;
  model?: string;
  status?: string;
}>;

function coerceFlowType(value: string | undefined): WorkflowMode | undefined {
  if (value === "reporting" || value === "builder") return value;
  return undefined;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusBadge(status: string): string {
  switch (status) {
    case "success":
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30";
    case "fail":
    case "failed":
    case "error":
      return "bg-red-500/10 text-red-300 border border-red-500/30";
    default:
      return "bg-zinc-500/10 text-zinc-300 border border-zinc-500/30";
  }
}

export default async function AdminRunsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filters = {
    env: params.env || undefined,
    flowType: coerceFlowType(params.flowType),
    selectedAccountId: params.accountId || undefined,
    model: params.model || undefined,
    status: params.status || undefined,
  };

  const [runs, options] = await Promise.all([
    listRuns({ ...filters, limit: 50 }),
    listRunFilterOptions(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Admin observability
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Runs</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Every reporting and builder invocation across all environments.
          </p>
        </div>
        <form method="post" action="/admin/logout">
          <button
            type="submit"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/[0.04]"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="mb-6">
        <RunFilters
          options={options}
          current={{
            env: filters.env,
            flowType: filters.flowType,
            selectedAccountId: filters.selectedAccountId,
            model: filters.model,
            status: filters.status,
          }}
        />
      </div>

      {runs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-10 text-center text-sm text-zinc-400">
          No runs match these filters yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Run</th>
                <th className="px-4 py-3 text-left">Flow</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.runId}
                  className="border-t border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/runs/${run.runId}`}
                      className="font-mono text-xs text-zinc-200 hover:underline"
                    >
                      {run.runId}
                    </Link>
                    {run.summary ? (
                      <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                        {run.summary}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{run.flowType}</td>
                  <td className="px-4 py-3 text-zinc-300">{run.accountLabel}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusBadge(run.status)}`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{formatTime(run.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
