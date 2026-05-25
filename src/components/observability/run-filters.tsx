import Link from "next/link";

import type { RunFilterOptions } from "@/lib/observability/queries";

type Props = {
  options: RunFilterOptions;
  current: {
    env?: string;
    flowType?: string;
    selectedAccountId?: string;
    model?: string;
    status?: string;
  };
};

/**
 * Filter bar rendered as a plain HTML form using GET so the URL captures the
 * filter state. No client JS needed; Next.js re-renders the server component
 * with the new searchParams on submit.
 */
export function RunFilters({ options, current }: Props) {
  const hasAnyFilter = Object.values(current).some(Boolean);

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-4"
    >
      <FilterSelect
        label="Env"
        name="env"
        value={current.env ?? ""}
        options={options.envs}
      />
      <FilterSelect
        label="Flow"
        name="flowType"
        value={current.flowType ?? ""}
        options={["reporting", "builder"]}
      />
      <FilterSelect
        label="Account"
        name="accountId"
        value={current.selectedAccountId ?? ""}
        options={options.accountIds}
      />
      <FilterSelect
        label="Model"
        name="model"
        value={current.model ?? ""}
        options={options.models}
      />
      <FilterSelect
        label="Status"
        name="status"
        value={current.status ?? ""}
        options={options.statuses}
      />

      <button
        type="submit"
        className="ml-auto rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-zinc-200"
      >
        Apply
      </button>
      {hasAnyFilter ? (
        <Link
          href="/admin/runs"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/[0.04]"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="flex min-w-[10rem] flex-col text-xs text-zinc-400">
      <span className="mb-1 font-semibold uppercase tracking-wider">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
      >
        <option value="">— any —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
