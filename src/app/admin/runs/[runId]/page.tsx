import Link from "next/link";
import { notFound } from "next/navigation";

import { TraceTree } from "@/components/observability/trace-tree";
import { getRunById } from "@/lib/observability/queries";

export default async function AdminRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getRunById(runId);

  if (!run) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/admin/runs"
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          ← Back to runs
        </Link>
        <form method="post" action="/admin/logout">
          <button
            type="submit"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/[0.04]"
          >
            Sign out
          </button>
        </form>
      </div>

      <TraceTree run={run} />
    </main>
  );
}
