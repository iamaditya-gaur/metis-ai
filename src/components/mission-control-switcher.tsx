"use client";

import { useState } from "react";

import type { WorkflowMode } from "@/lib/metis/types";

const options = [
  {
    value: "reporting" as const,
    label: "Reporting",
    description: "Pull insights, generate a factual summary, then apply tone-safe client messaging.",
  },
  {
    value: "builder" as const,
    label: "Builder",
    description: "Turn a brand URL into strategy, copy, and a gated paused-draft write path.",
  },
];

export function MissionControlSwitcher() {
  const [active, setActive] = useState<WorkflowMode>("reporting");

  return (
    <div className="segmented-switch" role="tablist" aria-label="Workflow mode">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          className="segmented-option"
          data-active={active === option.value}
          aria-selected={active === option.value}
          onClick={() => setActive(option.value)}
        >
          <span className="segmented-option-label">{option.label}</span>
          <span className="segmented-option-copy">{option.description}</span>
        </button>
      ))}
    </div>
  );
}
