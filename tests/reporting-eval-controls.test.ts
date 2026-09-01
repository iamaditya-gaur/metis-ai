import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestOpenRouterJson } from "../scripts/pocs/lib/llm.mjs";
import { generateOpenRouterReportSummary } from "../scripts/pocs/lib/reporting.mjs";
import { estimateCallCostUsd } from "../evals/reporting-model-comparison/config";
import { checkGeneratedMessage } from "../evals/reporting-model-comparison/checks";

function mockJsonResponse(content: unknown, model = "test/model") {
  const requestBodies: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(
      JSON.stringify({
        id: "request-test",
        provider: "Test Provider",
        model,
        choices: [{ message: { content: JSON.stringify(content) } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          cost: 0.001,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  return { fetchMock, requestBodies };
}

describe("reporting evaluation controls", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.POC_OPENROUTER_MIN_INTERVAL_MS = "0";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.POC_OPENROUTER_MIN_INTERVAL_MS;
  });

  it("passes an explicit model and output cap without changing defaults", async () => {
    const { fetchMock, requestBodies } = mockJsonResponse({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestOpenRouterJson({
      systemPrompt: "system",
      userMessage: "user",
      models: ["openai/gpt-5.6-luna"],
      maxTokens: 321,
    });

    const request = requestBodies[0];
    expect(request.model).toBe("openai/gpt-5.6-luna");
    expect(request.max_tokens).toBe(321);
    expect(result.usage.provider).toBe("Test Provider");
    expect(result.usage.requestId).toBe("request-test");
  });

  it("supports a capped summary-model override", async () => {
    const { fetchMock, requestBodies } = mockJsonResponse({
      executiveSummary: "Grounded summary",
      whatChanged: [],
      risks: [],
      nextActions: [],
      slackMessage: "Grounded summary",
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateOpenRouterReportSummary(
      { snapshot: { spend: 10 } },
      { model: "openai/gpt-5.6-luna", maxTokens: 456 },
    );

    const request = requestBodies[0];
    expect(request.model).toBe("openai/gpt-5.6-luna");
    expect(request.max_tokens).toBe(456);
    expect(result.usage.costUsd).toBe(0.001);
    expect(result.usage.provider).toBe("Test Provider");
  });

  it("uses a padded conservative cost estimate", () => {
    expect(
      estimateCallCostUsd({
        models: ["anthropic/claude-sonnet-5"],
        inputCharacters: 3_500,
        maxOutputTokens: 500,
      }),
    ).toBeGreaterThan(0.01);
  });

  it("rejects a wrong recipient and unsupported numeric claim", () => {
    const checks = checkGeneratedMessage({
      message:
        "Hey @wrong account, last week we spent $999,999 after we cut Spring Sale.",
      sourceData: { spend: 4_000 },
      canonicalActivities: [
        {
          date: "2026-08-25",
          objectName: "Spring Sale",
          objectType: "campaign",
          field: "DAILY_BUDGET",
          direction: "INCREASED",
          magnitudePercent: 20,
          actorClass: "MANUAL",
          actorName: null,
          valueOld: "100",
          valueNew: "120",
        },
      ],
      expectedRecipient: "@example account",
    });

    expect(checks.find((check) => check.name === "recipient")?.pass).toBe(false);
    expect(checks.find((check) => check.name === "numeric-grounding")?.pass).toBe(false);
    expect(checks.find((check) => check.name === "activity-direction")?.pass).toBe(false);
  });

  it("does not read the first letter of a following word as millions", () => {
    const checks = checkGeneratedMessage({
      message: "Frequency is 4.71, so it may indicate repeat exposure.",
      sourceData: { frequency: 4.71 },
      canonicalActivities: [],
    });

    expect(checks.find((check) => check.name === "numeric-grounding")?.pass).toBe(true);
  });

  it("accepts numbers grounded inside source text", () => {
    const checks = checkGeneratedMessage({
      message: "I launched the Grandma's Candy Dish (Aug 26) campaign.",
      sourceData: {
        changes: "Created Grandma's Candy Dish (Aug 26) campaign.",
      },
      canonicalActivities: [],
    });

    expect(checks.find((check) => check.name === "numeric-grounding")?.pass).toBe(true);
  });

  it("recognizes a requested monthly reporting window", () => {
    const checks = checkGeneratedMessage({
      message: "Hey @example account, on Meta (Aug 1 - Aug 31) performance was stable.",
      sourceData: {},
      canonicalActivities: [],
      dateRange: { from: "2026-08-01", to: "2026-08-31" },
    });

    expect(checks.find((check) => check.name === "reporting-window")?.pass).toBe(true);
  });

  it("requires the selected account recipient when requested", () => {
    const checks = checkGeneratedMessage({
      message: "Hey team, last month on Meta (Aug 1 - Aug 31) performance was stable.",
      sourceData: {},
      canonicalActivities: [],
      expectedRecipient: "@example account",
    });

    expect(checks.find((check) => check.name === "recipient")?.pass).toBe(false);
  });
});
