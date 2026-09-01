import { afterEach, describe, expect, it } from "vitest";

import {
  getCommunicatorModelCandidates,
  getToneProfileModelCandidates,
} from "../src/lib/metis/model-policy";

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
});
