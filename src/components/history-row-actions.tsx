"use client";

import { useTransition } from "react";

import { deleteRunAction } from "@/app/app/history/actions";

type Props = {
  runId: string;
};

export function HistoryRowActions({ runId }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Delete this report? This can't be undone.",
      );
      if (!confirmed) {
        event.preventDefault();
        return;
      }
    }
    const formData = new FormData(event.currentTarget);
    event.preventDefault();
    startTransition(async () => {
      await deleteRunAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="history-row-actions">
      <input type="hidden" name="runId" value={runId} />
      <button
        type="submit"
        className="history-row-delete"
        aria-label="Delete this report"
        title="Delete this report"
        disabled={isPending}
      >
        <TrashIcon />
      </button>
    </form>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
