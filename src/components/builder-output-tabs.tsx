"use client";

import { useState } from "react";

import { GlassPanel } from "@/components/glass-panel";
import { StatusPill } from "@/components/status-pill";
import type { BuilderPreviewResponse } from "@/lib/metis/types";

const tabIds = ["strategy", "copy", "draft-spec"] as const;
type TabId = (typeof tabIds)[number];

type BuilderOutputTabsProps = {
  result: BuilderPreviewResponse | null;
  error: string;
  isPending: boolean;
};

export function BuilderOutputTabs({
  result,
  error,
  isPending,
}: BuilderOutputTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("strategy");
  const campaignPlan =
    result?.builderOutput && typeof result.builderOutput === "object"
      ? (result.builderOutput.campaignPlan as
          | {
              summary?: string;
              primaryGoal?: string;
              offerStrategy?: string;
            }
          | undefined)
      : undefined;
  const copyPack =
    result?.builderOutput && typeof result.builderOutput === "object"
      ? (result.builderOutput.copyPack as
          | {
              tof?: unknown[];
              mof?: unknown[];
              bof?: unknown[];
            }
          | undefined)
      : undefined;
  const draftLaunchSpec =
    result?.builderOutput && typeof result.builderOutput === "object"
      ? (result.builderOutput.draftLaunchSpec as
          | {
              writeReadiness?: string;
              blockedReasons?: string[];
              missingAssets?: string[];
            }
          | undefined)
      : undefined;

  return (
    <GlassPanel
      eyebrow="Output"
      title="Inspect before any write"
      description="Builder output should be reviewable in tabs so the operator can move from strategy to copy to payload safety without reading one long dump."
      actions={
        error ? (
          <StatusPill label="Preview failed" tone="warning" />
        ) : isPending ? (
          <StatusPill label="Generating" tone="info" />
        ) : result ? (
          <StatusPill label="Preview ready" tone="success" />
        ) : (
          <StatusPill label="Awaiting preview" tone="neutral" />
        )
      }
    >
      <div className="product-tab-row" role="tablist" aria-label="Builder output tabs">
        {tabIds.map((tabId) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            className="product-tab"
            data-active={activeTab === tabId}
            aria-selected={activeTab === tabId}
            onClick={() => setActiveTab(tabId)}
          >
            {tabId === "strategy"
              ? "Strategy"
              : tabId === "copy"
                ? "Copy"
                : "Draft spec"}
          </button>
        ))}
      </div>

      {error ? <div className="product-warning">{error}</div> : null}

      {activeTab === "strategy" ? (
        <div className="product-list">
          <article className="product-list-item">
            <strong>Campaign plan</strong>
            <p className="product-help">
              {campaignPlan?.summary
                ? String(campaignPlan.summary)
                : "Build a three-stage LEADS structure with TOF awareness hooks, MOF offer proof, and BOF action-oriented conversion framing."}
            </p>
          </article>
          <article className="product-list-item">
            <strong>Primary goal</strong>
            <p className="product-help">
              {campaignPlan && typeof campaignPlan.primaryGoal === "string" && campaignPlan.primaryGoal
                ? campaignPlan.primaryGoal
                : "Keep objective fit explicit before expanding into a broader write path."}
            </p>
          </article>
          <article className="product-list-item">
            <strong>Offer strategy</strong>
            <p className="product-help">
              {campaignPlan && typeof campaignPlan.offerStrategy === "string" && campaignPlan.offerStrategy
                ? campaignPlan.offerStrategy
                : "Use the offer and site evidence to decide whether this should stay awareness-led, lead-focused, or be narrowed safely."}
            </p>
          </article>
          <article className="product-list-item">
            <strong>Evidence quality</strong>
            <p className="product-help">
              {result?.brandResearch
                ? `${result.brandResearch.pagesCrawled} brand pages crawled. ${result.brandResearch.enoughSignal === false ? "Signal is still thin, so the plan should stay narrower and more hypothesis-led." : "Signal is strong enough to support a more specific strategy."}`
                : "Track objective fit, message quality, and signal strength before expanding the write path."}
            </p>
          </article>
        </div>
      ) : null}

      {activeTab === "copy" ? (
        <div className="product-list">
          <article className="product-list-item">
            <strong>TOF</strong>
            <pre className="product-code">{JSON.stringify(copyPack?.tof ?? [], null, 2)}</pre>
          </article>
          <article className="product-list-item">
            <strong>MOF</strong>
            <pre className="product-code">{JSON.stringify(copyPack?.mof ?? [], null, 2)}</pre>
          </article>
          <article className="product-list-item">
            <strong>BOF</strong>
            <pre className="product-code">{JSON.stringify(copyPack?.bof ?? [], null, 2)}</pre>
          </article>
        </div>
      ) : null}

      {activeTab === "draft-spec" ? (
        <div className="product-list">
          <article className="product-list-item">
            <strong>Draft readiness</strong>
            <p className="product-help">
              {draftLaunchSpec?.writeReadiness
                ? String(draftLaunchSpec.writeReadiness)
                : result?.validatedDrafts
                  ? "validated-ready"
                  : "planning-only"}
            </p>
          </article>
          {draftLaunchSpec?.blockedReasons?.length ? (
            <article className="product-list-item">
              <strong>Blocked reasons</strong>
              <pre className="product-code">
                {JSON.stringify(draftLaunchSpec.blockedReasons, null, 2)}
              </pre>
            </article>
          ) : null}
          {draftLaunchSpec?.missingAssets?.length ? (
            <article className="product-list-item">
              <strong>Missing assets</strong>
              <pre className="product-code">
                {JSON.stringify(draftLaunchSpec.missingAssets, null, 2)}
              </pre>
            </article>
          ) : null}
          <article className="product-list-item">
            <strong>Draft spec payload</strong>
            <pre className="product-code">
              {JSON.stringify(
                result?.validatedDrafts ?? draftLaunchSpec ?? {},
                null,
                2,
              )}
            </pre>
          </article>
        </div>
      ) : null}
    </GlassPanel>
  );
}
