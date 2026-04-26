"use client";

import { useState, useTransition } from "react";

import { ReportingForm } from "@/components/reporting-form";
import { ReportingOutputPane } from "@/components/reporting-output-pane";
import type { AccountOption, ReportingRunRequest, ReportingRunResponse } from "@/lib/metis/types";

type ReportingWorkspaceProps = {
  accounts: AccountOption[];
};

export function ReportingWorkspace({ accounts }: ReportingWorkspaceProps) {
  const [result, setResult] = useState<ReportingRunResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleRun = (payload: ReportingRunRequest) => {
    startTransition(async () => {
      setError("");

      try {
        const response = await fetch("/api/metis/reporting", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as ReportingRunResponse & { message?: string };

        if (!response.ok) {
          throw new Error(body.message ?? "Reporting run failed.");
        }

        setResult(body);
      } catch (runError) {
        setResult(null);
        setError(runError instanceof Error ? runError.message : "Reporting run failed.");
      }
    });
  };

  return (
    <div className="product-grid product-grid--two">
      <ReportingForm accounts={accounts} isPending={isPending} onRun={handleRun} />
      <ReportingOutputPane error={error} isPending={isPending} result={result} />
    </div>
  );
}
