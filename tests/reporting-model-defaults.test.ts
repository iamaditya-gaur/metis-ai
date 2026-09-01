import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestOpenRouterJson = vi.hoisted(() => vi.fn());

vi.mock("../scripts/pocs/lib/llm.mjs", () => ({
  requestOpenRouterJson,
}));

import {
  getCommunicatorModelCandidates,
  getToneProfileModelCandidates,
} from "../src/lib/metis/model-policy";
import {
  buildToneProfile,
  composeClientMessage,
  deriveToneProfile,
} from "../src/lib/metis/tone";
import type { ReportingRunResponse } from "../src/lib/metis/types";

const originalEnv = {
  reporting: process.env.OPENROUTER_MODEL,
  tone: process.env.OPENROUTER_TONE_PROFILE_MODELS,
  client: process.env.OPENROUTER_CLIENT_MESSAGE_MODELS,
};

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restoreEnv("OPENROUTER_MODEL", originalEnv.reporting);
  restoreEnv("OPENROUTER_TONE_PROFILE_MODELS", originalEnv.tone);
  restoreEnv("OPENROUTER_CLIENT_MESSAGE_MODELS", originalEnv.client);
});

beforeEach(() => {
  requestOpenRouterJson.mockReset();
});

describe("reporting model defaults", () => {
  it("uses the evaluated workflow-specific model priorities", () => {
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_TONE_PROFILE_MODELS;
    delete process.env.OPENROUTER_CLIENT_MESSAGE_MODELS;

    expect(getToneProfileModelCandidates()).toEqual([
      "openai/gpt-5.6-luna",
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5.4-mini",
    ]);
    expect(getCommunicatorModelCandidates()).toEqual([
      "openai/gpt-5.6-terra",
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5.4-mini",
    ]);
  });

  it("keeps separate operator overrides for tone and client-message writing", () => {
    process.env.OPENROUTER_TONE_PROFILE_MODELS =
      "openai/tone-primary, openai/tone-fallback";
    process.env.OPENROUTER_CLIENT_MESSAGE_MODELS =
      "openai/client-primary, openai/client-fallback";

    expect(getToneProfileModelCandidates()).toEqual([
      "openai/tone-primary",
      "openai/tone-fallback",
    ]);
    expect(getCommunicatorModelCandidates()).toEqual([
      "openai/client-primary",
      "openai/client-fallback",
    ]);
  });

  it("keeps the reporting model as the final fallback and removes empty duplicates", () => {
    process.env.OPENROUTER_MODEL = "openai/reporting-default";
    process.env.OPENROUTER_TONE_PROFILE_MODELS =
      " openai/tone-primary, ,openai/tone-primary, openai/tone-fallback ";
    process.env.OPENROUTER_CLIENT_MESSAGE_MODELS = "   ";

    expect(getToneProfileModelCandidates()).toEqual([
      "openai/tone-primary",
      "openai/tone-fallback",
    ]);

    process.env.OPENROUTER_TONE_PROFILE_MODELS = "   ";
    expect(getToneProfileModelCandidates()).toEqual([
      "openai/gpt-5.6-luna",
      "anthropic/claude-sonnet-4.6",
      "openai/reporting-default",
    ]);

    expect(getCommunicatorModelCandidates()).toEqual([
      "openai/gpt-5.6-terra",
      "anthropic/claude-sonnet-4.6",
      "openai/reporting-default",
    ]);
  });

  it("passes the tone model chain into the live tone-profile step", async () => {
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_TONE_PROFILE_MODELS;

    requestOpenRouterJson.mockResolvedValue({
      model: "openai/gpt-5.6-luna",
      data: {},
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        costUsd: 0,
        latencyMs: 1,
        attempts: [],
        attemptedModels: ["openai/gpt-5.6-luna"],
      },
      prompts: { systemPrompt: "system", userMessage: "user", responseRaw: "{}" },
    });

    await buildToneProfile(`"Quick update from my side."

"Spend was steady this week."`);

    expect(requestOpenRouterJson).toHaveBeenCalledWith(
      expect.objectContaining({
        models: [
          "openai/gpt-5.6-luna",
          "anthropic/claude-sonnet-4.6",
          "openai/gpt-5.4-mini",
        ],
      }),
    );
  });

  it("passes the client-message model chain into the live compose step", async () => {
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_CLIENT_MESSAGE_MODELS;

    requestOpenRouterJson.mockResolvedValue({
      model: "openai/gpt-5.6-terra",
      data: { clientMessage: "Quick update: performance remained steady." },
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        costUsd: 0,
        latencyMs: 1,
        attempts: [],
        attemptedModels: ["openai/gpt-5.6-terra"],
      },
      prompts: { systemPrompt: "system", userMessage: "user", responseRaw: "{}" },
    });

    const toneExamples = `"Quick update from my side."

"Spend was steady this week."`;
    const snapshot: ReportingRunResponse["snapshot"] = {
      dateRange: {
        from: "2026-08-01",
        to: "2026-08-31",
        preset: null,
        label: "August 2026",
      },
      rowCount: 1,
      totals: {
        spend: 100,
        impressions: 1000,
        reach: 800,
        clicks: 20,
        ctr: 2,
        cpm: 100,
        cpc: 5,
        frequency: 1.25,
        primaryResult: null,
      },
      dominantObjective: "UNKNOWN",
      topActions: [],
      topCampaigns: [],
      dataQuality: [],
    };
    const report: ReportingRunResponse["report"] = {
      executiveSummary: "Performance remained steady.",
      whatChanged: [],
      risks: [],
      nextActions: [],
      slackMessage: "Performance remained steady.",
    };

    await composeClientMessage({
      report,
      snapshot,
      toneExamples,
      toneProfile: deriveToneProfile(toneExamples),
    });

    expect(requestOpenRouterJson).toHaveBeenCalledWith(
      expect.objectContaining({
        models: [
          "openai/gpt-5.6-terra",
          "anthropic/claude-sonnet-4.6",
          "openai/gpt-5.4-mini",
        ],
      }),
    );
  });
});
