import { describe, expect, it } from "vitest";

import {
  getLlmCallConfig,
  runWithLlmKey,
} from "../scripts/pocs/lib/llm-context.mjs";

describe("getLlmCallConfig", () => {
  it("falls back to env + openrouter when no context", () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    const config = getLlmCallConfig();
    expect(config.provider).toBe("openrouter");
    expect(config.apiKey).toBe("env-key");
    expect(config.endpoint).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(config.mapModel("openai/gpt-5.4-mini")).toBe("openai/gpt-5.4-mini");
  });

  it("uses the per-request key inside runWithLlmKey", () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    runWithLlmKey({ provider: "openai", apiKey: "user-key" }, () => {
      const config = getLlmCallConfig();
      expect(config.provider).toBe("openai");
      expect(config.apiKey).toBe("user-key");
      expect(config.endpoint).toBe("https://api.openai.com/v1/chat/completions");
      expect(config.mapModel("openai/gpt-5.4-mini")).toBe("gpt-5.4-mini");
    });
  });

  it("openai provider rejects non-openai models", () => {
    runWithLlmKey({ provider: "openai", apiKey: "user-key" }, () => {
      const config = getLlmCallConfig();
      expect(() => config.mapModel("anthropic/claude-sonnet-5")).toThrow();
    });
  });

  it("context survives async boundaries", async () => {
    await runWithLlmKey({ provider: "openrouter", apiKey: "ctx-key" }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const [a, b] = await Promise.allSettled([
        Promise.resolve().then(() => getLlmCallConfig().apiKey),
        Promise.resolve().then(() => getLlmCallConfig().apiKey),
      ]);
      expect(a.value).toBe("ctx-key");
      expect(b.value).toBe("ctx-key");
    });
  });
});
