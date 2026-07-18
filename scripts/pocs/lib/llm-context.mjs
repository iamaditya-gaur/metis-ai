import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request LLM credential context (BYOK). API routes wrap workflow calls
 * in runWithLlmKey(...) so the low-level LLM modules pick up the signed-in
 * user's own key. When no context is set (public demo path, POC scripts),
 * everything falls back to OPENROUTER_API_KEY exactly as before.
 *
 * AsyncLocalStorage — not process.env mutation — because two overlapping
 * requests in one serverless process must never see each other's keys.
 */

const storage = new AsyncLocalStorage();

/**
 * @param {{ provider: "openrouter" | "openai"; apiKey: string }} context
 * @param {() => any} fn
 */
export function runWithLlmKey(context, fn) {
  return storage.run(context, fn);
}

const PROVIDERS = {
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    extraHeaders: {
      "HTTP-Referer": "https://metis-ai-nine.vercel.app",
      "X-OpenRouter-Title": "Metis AI",
    },
    mapModel: (model) => model,
  },
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    extraHeaders: {},
    mapModel: (model) => {
      if (!model.startsWith("openai/")) {
        throw new Error(
          `Model "${model}" is not available on a direct OpenAI key. Connect an OpenRouter key instead.`,
        );
      }
      return model.slice("openai/".length);
    },
  },
};

export function getLlmCallConfig() {
  const context = storage.getStore() ?? null;
  const provider = context?.provider ?? "openrouter";
  const apiKey = context?.apiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
  const { endpoint, extraHeaders, mapModel } = PROVIDERS[provider];
  return { provider, apiKey, endpoint, extraHeaders, mapModel, isUserKey: Boolean(context) };
}
