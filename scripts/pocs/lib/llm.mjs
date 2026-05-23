import { performance } from "node:perf_hooks";

import { readRateLimitMs, waitForRateLimit } from "./rate-limit.mjs";

/**
 * Extracts usage and cost details from an OpenRouter chat-completions payload.
 * OpenRouter mirrors the OpenAI shape (`usage.prompt_tokens`, etc.) and may
 * additionally include `usage.cost` (USD) for some models.
 *
 * @param {unknown} payload
 */
function extractUsageFromPayload(payload) {
  const usage =
    payload && typeof payload === "object" && "usage" in payload
      ? /** @type {Record<string, unknown>} */ (payload.usage)
      : null;

  if (!usage || typeof usage !== "object") {
    return {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      costUsd: null,
    };
  }

  const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

  return {
    promptTokens: num(usage.prompt_tokens),
    completionTokens: num(usage.completion_tokens),
    totalTokens: num(usage.total_tokens),
    costUsd:
      num(usage.cost) ??
      num(/** @type {Record<string, unknown>} */ (usage.cost_details)?.upstream_inference_cost) ??
      null,
  };
}

/**
 * @param {{
 *   systemPrompt: string;
 *   userPayload: unknown;
 *   model?: string;
 *   models?: string[] | null;
 *   temperature?: number;
 * }} options
 *
 * Returns `{ model, data, usage }` where `usage` contains:
 *   - promptTokens / completionTokens / totalTokens (numbers or null)
 *   - costUsd (number or null — OpenRouter only emits cost for some models)
 *   - latencyMs (wall-clock duration of the winning attempt)
 *   - attempts (one entry per candidate model tried, with status + latency)
 *   - attemptedModels (just the model ids tried, in order)
 */
export async function requestOpenRouterJson({
  systemPrompt,
  userPayload,
  model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5.4-mini",
  models = null,
  temperature,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  await waitForRateLimit(
    "openrouter",
    readRateLimitMs("POC_OPENROUTER_MIN_INTERVAL_MS", 1500),
  );

  const candidateModels = Array.from(
    new Set(
      (Array.isArray(models) ? models : [model])
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean),
    ),
  );
  /** @type {Array<{ model: string; status: "success" | "http_error" | "empty_message" | "invalid_json"; httpStatus: number | null; latencyMs: number; errorMessage: string | null }>} */
  const attempts = [];
  let lastError = null;

  for (const candidateModel of candidateModels) {
    const attemptStarted = performance.now();
    let response;
    let payload;

    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://metis-ai-nine.vercel.app",
          "X-OpenRouter-Title": "Metis AI",
        },
        body: JSON.stringify({
          model: candidateModel,
          ...(typeof temperature === "number" ? { temperature } : {}),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(userPayload) },
          ],
        }),
      });
      payload = await response.json();
    } catch (networkError) {
      const latencyMs = Math.round(performance.now() - attemptStarted);
      attempts.push({
        model: candidateModel,
        status: "http_error",
        httpStatus: null,
        latencyMs,
        errorMessage:
          networkError instanceof Error ? networkError.message : "network error",
      });
      lastError =
        networkError instanceof Error
          ? networkError
          : new Error(`Network error contacting OpenRouter for ${candidateModel}.`);
      continue;
    }

    const latencyMs = Math.round(performance.now() - attemptStarted);

    if (!response.ok) {
      attempts.push({
        model: candidateModel,
        status: "http_error",
        httpStatus: response.status,
        latencyMs,
        errorMessage: `status ${response.status}`,
      });
      lastError = new Error(
        `OpenRouter API request failed for ${candidateModel} with status ${response.status}: ${JSON.stringify(payload)}`,
      );
      continue;
    }

    const message = payload?.choices?.[0]?.message?.content;

    if (typeof message !== "string" || !message.trim()) {
      attempts.push({
        model: candidateModel,
        status: "empty_message",
        httpStatus: response.status,
        latencyMs,
        errorMessage: "empty message content",
      });
      lastError = new Error(`OpenRouter API returned no message content for ${candidateModel}.`);
      continue;
    }

    try {
      const parsed = JSON.parse(message);
      const usage = extractUsageFromPayload(payload);
      attempts.push({
        model: candidateModel,
        status: "success",
        httpStatus: response.status,
        latencyMs,
        errorMessage: null,
      });
      return {
        model: candidateModel,
        data: parsed,
        usage: {
          ...usage,
          latencyMs,
          attempts,
          attemptedModels: attempts.map((entry) => entry.model),
        },
        prompts: {
          systemPrompt,
          userMessage: JSON.stringify(userPayload),
          responseRaw: message,
        },
      };
    } catch {
      attempts.push({
        model: candidateModel,
        status: "invalid_json",
        httpStatus: response.status,
        latencyMs,
        errorMessage: "response content was not valid JSON",
      });
      lastError = new Error(`OpenRouter message content was not valid JSON for ${candidateModel}.`);
    }
  }

  throw lastError ?? new Error("OpenRouter request failed for all candidate models.");
}
