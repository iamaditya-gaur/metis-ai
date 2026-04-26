"use client";

import { useState } from "react";

import { GlassPanel } from "@/components/glass-panel";
import type { AccountOption, ReportingRunRequest } from "@/lib/metis/types";

type ReportingFormProps = {
  accounts: AccountOption[];
  isPending: boolean;
  onRun: (payload: ReportingRunRequest) => void;
};

export function ReportingForm({ accounts, isPending, onRun }: ReportingFormProps) {
  const reportingDefault =
    accounts.find((account) => account.role === "reporting-default") ?? accounts[0];
  const [accountId, setAccountId] = useState(reportingDefault?.id ?? "");
  const [dateStart, setDateStart] = useState("2026-04-18");
  const [dateEnd, setDateEnd] = useState("2026-04-24");
  const [toneExamples, setToneExamples] = useState(
    "Quick update from my side: spend held steady, CTR improved, but I want to keep an eye on frequency.\n\nMain takeaway is that creative B is still the cleanest winner.",
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRun({
      accountId,
      dateStart,
      dateEnd,
      toneExamples,
    });
  };

  return (
    <GlassPanel
      eyebrow="Inputs"
      title="Run reporting"
      description="Keep the factual reporting window explicit, then optionally add tone context for the final client-facing message."
    >
      <form className="product-field-grid" onSubmit={handleSubmit}>
        <div className="product-field">
          <label className="product-label" htmlFor="reporting-account">
            Reporting account
          </label>
          <div className="product-select-wrap">
            <select
              id="reporting-account"
              className="product-select"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
            <span className="product-select-indicator" aria-hidden="true" />
          </div>
          <p className="product-help">Reporting should default to CB and keep that account label visible across the run.</p>
        </div>

        <div className="product-grid product-grid--two">
          <div className="product-field">
            <label className="product-label" htmlFor="date-start">
              Date start
            </label>
            <input
              id="date-start"
              className="product-input"
              type="date"
              value={dateStart}
              onChange={(event) => setDateStart(event.target.value)}
            />
          </div>

          <div className="product-field">
            <label className="product-label" htmlFor="date-end">
              Date end
            </label>
            <input
              id="date-end"
              className="product-input"
              type="date"
              value={dateEnd}
              onChange={(event) => setDateEnd(event.target.value)}
            />
          </div>
        </div>

        <div className="product-field">
          <label className="product-label" htmlFor="tone-examples">
            Prior client messages
          </label>
          <textarea
            id="tone-examples"
            className="product-textarea"
            value={toneExamples}
            onChange={(event) => setToneExamples(event.target.value)}
          />
          <p className="product-help">
            Facts should be generated first. Tone examples should only influence style, brevity, and phrasing of the final message.
          </p>
        </div>

        <div className="product-button-row">
          <button type="submit" className="product-button" disabled={isPending}>
            {isPending ? "Running reporting..." : "Run reporting"}
          </button>
        </div>
      </form>
    </GlassPanel>
  );
}
