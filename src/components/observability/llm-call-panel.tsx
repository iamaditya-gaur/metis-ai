"use client";

import { useState } from "react";

import type { LlmCallDetail } from "@/lib/observability/queries";

type Props = {
  call: LlmCallDetail;
};

function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(usd: number | null): string {
  if (usd === null || usd === undefined) return "—";
  if (usd < 0.0001) return `<$0.0001`;
  return `$${usd.toFixed(4)}`;
}

function statusBadge(status: string): string {
  switch (status) {
    case "success":
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30";
    case "http_error":
      return "bg-red-500/10 text-red-300 border border-red-500/30";
    case "invalid_json":
    case "empty_message":
      return "bg-amber-500/10 text-amber-300 border border-amber-500/30";
    default:
      return "bg-zinc-500/10 text-zinc-300 border border-zinc-500/30";
  }
}

export function LlmCallPanel({ call }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { usage, prompts } = call;

  const attempts = usage?.attempts ?? [];
  const fellBack = attempts.length > 1;

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{call.step}</span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusBadge(call.status)}`}
            >
              {call.status}
            </span>
            {fellBack ? (
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                {attempts.length - 1} fallback{attempts.length - 1 === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-zinc-400">
            <span className="text-zinc-300">{call.model ?? "(no model)"}</span>
            <span className="mx-1.5 text-zinc-600">·</span>
            <span>{usage?.totalTokens ?? "—"} tokens</span>
            <span className="mx-1.5 text-zinc-600">·</span>
            <span>{formatCost(usage?.costUsd ?? null)}</span>
            <span className="mx-1.5 text-zinc-600">·</span>
            <span>{formatLatency(usage?.latencyMs ?? null)}</span>
          </div>
        </div>
        <span className="text-zinc-500">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-white/10 px-4 py-4">
          {call.errorMessage ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <strong>Error:</strong> {call.errorMessage}
            </div>
          ) : null}

          {attempts.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Attempt chain
              </div>
              <ol className="mt-2 space-y-1.5">
                {attempts.map((attempt, idx) => (
                  <li
                    key={`${attempt.model}-${idx}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="text-zinc-500">{idx + 1}.</span>
                    <span className="text-zinc-200">{attempt.model}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 ${statusBadge(attempt.status)}`}
                    >
                      {attempt.status}
                    </span>
                    <span className="text-zinc-500">
                      {attempt.httpStatus !== null ? `HTTP ${attempt.httpStatus}` : null}
                      {attempt.httpStatus !== null ? " · " : ""}
                      {formatLatency(attempt.latencyMs)}
                    </span>
                    {attempt.errorMessage ? (
                      <span className="text-red-400">{attempt.errorMessage}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {usage ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Prompt tokens" value={usage.promptTokens?.toString() ?? "—"} />
              <Stat
                label="Completion tokens"
                value={usage.completionTokens?.toString() ?? "—"}
              />
              <Stat label="Cost" value={formatCost(usage.costUsd)} />
              <Stat label="Latency" value={formatLatency(usage.latencyMs)} />
            </div>
          ) : null}

          {prompts ? (
            <div className="space-y-3">
              <PromptBlock label="System prompt" content={prompts.systemPrompt} />
              <PromptBlock label="User message" content={prompts.userMessage} />
              <PromptBlock label="Raw response" content={prompts.responseRaw} />
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No prompts captured (older run).</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-mono text-zinc-200">{value}</div>
    </div>
  );
}

function PromptBlock({ label, content }: { label: string; content: string }) {
  return (
    <details className="rounded-lg border border-white/10 bg-zinc-950/60">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200">
        {label} <span className="text-zinc-600">({content.length} chars)</span>
      </summary>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 text-xs text-zinc-300">
        {content}
      </pre>
    </details>
  );
}
