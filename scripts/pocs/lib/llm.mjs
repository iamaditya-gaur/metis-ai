import { performance } from "node:perf_hooks";

import { getLlmCallConfig } from "./llm-context.mjs";
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

function boundedStructuredAttempts(value) {
  const configured = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(configured) ? Math.max(1, Math.min(2, configured)) : 2;
}

function messageText(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      part && typeof part === "object" && typeof part.text === "string" ? part.text : "",
    )
    .join("")
    .trim();
}

function parseJsonMessage(content) {
  const text = messageText(content);
  if (!text) return { text, data: null, error: "empty" };

  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return { text, data: JSON.parse(withoutFence), error: null };
  } catch {
    return { text, data: null, error: "invalid_json" };
  }
}

function missingRequiredKeys(data, requiredKeys) {
  if (!requiredKeys.length) return [];
  if (!data || typeof data !== "object" || Array.isArray(data)) return requiredKeys;
  return requiredKeys.filter((key) => !(key in data));
}

function addUsage(total, next) {
  for (const key of ["promptTokens", "completionTokens", "totalTokens", "costUsd"]) {
    const value = next[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      total[key] = (total[key] ?? 0) + value;
    }
  }
}

function attachFailureUsage(error, aggregateUsage, attempts) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  /** @type {Error & { usage?: unknown }} */ (normalized).usage = {
    ...aggregateUsage,
    provider: null,
    requestId: null,
    latencyMs: attempts.reduce((sum, entry) => sum + entry.latencyMs, 0),
    attempts,
    attemptedModels: attempts.map((entry) => entry.model),
  };
  return normalized;
}

/**
 * @param {{
 *   systemPrompt: string;
 *   userPayload?: unknown;
 *   userMessage?: string;
 *   model?: string;
 *   models?: string[] | null;
 *   temperature?: number;
 *   maxTokens?: number;
 *   timeoutMs?: number;
 *   requiredKeys?: string[];
 *   maxAttemptsPerModel?: number;
 *   validateData?: (data: unknown) => boolean | string | null;
 * }} options
 *
 * Returns `{ model, data, usage }` where `usage` contains:
 *   - promptTokens / completionTokens / totalTokens (numbers or null)
 *   - costUsd (number or null — OpenRouter only emits cost for some models)
 *   - latencyMs (combined provider latency across attempts)
 *   - attempts (one entry per candidate model tried, with status + latency)
 *   - attemptedModels (just the model ids tried, in order)
 */
export async function requestOpenRouterJson({
  systemPrompt,
  userPayload,
  userMessage,
  model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5.4-mini",
  models = null,
  temperature,
  maxTokens,
  timeoutMs,
  requiredKeys = [],
  maxAttemptsPerModel,
  validateData,
}) {
  if (typeof userMessage !== "string" && userPayload === undefined) {
    throw new Error("requestOpenRouterJson requires either userMessage or userPayload.");
  }

  const resolvedUserContent =
    typeof userMessage === "string" ? userMessage : JSON.stringify(userPayload);
  const llmConfig = getLlmCallConfig();
  const apiKey = llmConfig.apiKey;

  if (!apiKey) {
    throw new Error(
      llmConfig.isUserKey
        ? "Your connected AI key could not be read. Reconnect it in Settings."
        : "Missing OPENROUTER_API_KEY.",
    );
  }

  const candidateModels = Array.from(
    new Set(
      (Array.isArray(models) ? models : [model])
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean),
    ),
  );
  const normalizedRequiredKeys = Array.from(
    new Set(requiredKeys.map((key) => String(key ?? "").trim()).filter(Boolean)),
  );
  const sharedRetryAllowed =
    llmConfig.isUserKey ||
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.METIS_EVAL_PRIVATE_DIR?.trim()) ||
    process.env.OPENROUTER_ALLOW_SHARED_RETRIES === "true";
  const requestedAttempts = boundedStructuredAttempts(
    maxAttemptsPerModel ??
      (normalizedRequiredKeys.length ? process.env.OPENROUTER_JSON_ATTEMPTS : 1),
  );
  // Anonymous demo requests use the shared application key. Never multiply
  // their cost unless the operator deliberately opts in.
  const attemptsPerModel = sharedRetryAllowed ? requestedAttempts : 1;
  /** @type {Array<{ model: string; attempt: number; status: "success" | "http_error" | "empty_message" | "invalid_json" | "invalid_schema"; httpStatus: number | null; latencyMs: number; errorMessage: string | null }>} */
  const attempts = [];
  const aggregateUsage = {
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    costUsd: null,
  };
  let lastError = null;

  for (const candidateModel of candidateModels) {
    for (let attemptNumber = 1; attemptNumber <= attemptsPerModel; attemptNumber += 1) {
      await waitForRateLimit(
        "openrouter",
        readRateLimitMs("POC_OPENROUTER_MIN_INTERVAL_MS", 1500),
      );
      const attemptStarted = performance.now();
      let response;
      let payload;

      try {
        const wireModel = llmConfig.mapModel(candidateModel);
        response = await fetch(llmConfig.endpoint, {
          method: "POST",
          ...(Number.isInteger(timeoutMs) && timeoutMs > 0
            ? { signal: AbortSignal.timeout(timeoutMs) }
            : {}),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...llmConfig.extraHeaders,
          },
          body: JSON.stringify({
            model: wireModel,
            ...(typeof temperature === "number" ? { temperature } : {}),
            ...(Number.isInteger(maxTokens) && maxTokens > 0
              ? { max_tokens: maxTokens }
              : {}),
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: resolvedUserContent },
            ],
          }),
        });
        payload = await response.json();
      } catch (networkError) {
        const latencyMs = Math.round(performance.now() - attemptStarted);
        attempts.push({
          model: candidateModel,
          attempt: attemptNumber,
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
        break;
      }

      const latencyMs = Math.round(performance.now() - attemptStarted);
      const usage = extractUsageFromPayload(payload);
      addUsage(aggregateUsage, usage);

      if (!response.ok) {
        attempts.push({
          model: candidateModel,
          attempt: attemptNumber,
          status: "http_error",
          httpStatus: response.status,
          latencyMs,
          errorMessage: `status ${response.status}`,
        });
      // 401 from OpenRouter means the API key is invalid, revoked, or the
      // account is out of credits / suspended. This is an auth-config issue,
      // not a model-availability issue — failing over to the next candidate
      // model won't help. Throw immediately with a clear, user-facing message
      // so the run surfaces "update your OpenRouter key" instead of a raw
      // JSON dump from the upstream API.
      // 402 (out of credits) and 403 (forbidden) are also terminal key/account
      // problems that another model can't fix — but only surface them as
      // "reconnect your key" for a per-request user key (BYOK). On the env
      // fallback path (isUserKey === false) behavior stays byte-identical:
      // only 401 short-circuits, exactly as before.
        if (
          response.status === 401 ||
          (llmConfig.isUserKey && (response.status === 402 || response.status === 403))
        ) {
          const err = new Error(
            llmConfig.isUserKey
              ? "Your connected AI key was rejected (invalid, revoked, or out of credits). Reconnect or replace it in Settings → AI key."
              : "OpenRouter API key is invalid, expired, or revoked. Update OPENROUTER_API_KEY in Vercel (Project Settings → Environment Variables) for both Preview and Production, then redeploy.",
          );
          /** @type {Error & { code?: string; httpStatus?: number }} */ (err).code =
            "OPENROUTER_AUTH_FAILED";
          /** @type {Error & { code?: string; httpStatus?: number }} */ (err).httpStatus =
            response.status;
          throw attachFailureUsage(err, aggregateUsage, attempts);
        }
        lastError = new Error(
          `OpenRouter API request failed for ${candidateModel} with status ${response.status}.`,
        );
        break;
      }

      const parsedMessage = parseJsonMessage(payload?.choices?.[0]?.message?.content);
      if (parsedMessage.error === "empty") {
        attempts.push({
          model: candidateModel,
          attempt: attemptNumber,
          status: "empty_message",
          httpStatus: response.status,
          latencyMs,
          errorMessage: "empty message content",
        });
        lastError = new Error(`OpenRouter API returned no message content for ${candidateModel}.`);
        continue;
      }

      if (parsedMessage.error === "invalid_json") {
        attempts.push({
          model: candidateModel,
          attempt: attemptNumber,
          status: "invalid_json",
          httpStatus: response.status,
          latencyMs,
          errorMessage: "response content was not valid JSON",
        });
        lastError = new Error(`OpenRouter message content was not valid JSON for ${candidateModel}.`);
        continue;
      }

      const missingKeys = missingRequiredKeys(parsedMessage.data, normalizedRequiredKeys);
      let validationError = null;
      if (!missingKeys.length && typeof validateData === "function") {
        try {
          const verdict = validateData(parsedMessage.data);
          validationError =
            verdict === true || verdict === null || verdict === undefined
              ? null
              : typeof verdict === "string" && verdict.trim()
                ? verdict.trim()
                : "response values failed validation";
        } catch {
          validationError = "response values failed validation";
        }
      }
      if (missingKeys.length || validationError) {
        const errorMessage = missingKeys.length
          ? `missing required keys: ${missingKeys.join(", ")}`
          : validationError;
        attempts.push({
          model: candidateModel,
          attempt: attemptNumber,
          status: "invalid_schema",
          httpStatus: response.status,
          latencyMs,
          errorMessage,
        });
        lastError = new Error(
          `OpenRouter response for ${candidateModel} failed structured validation: ${errorMessage}.`,
        );
        continue;
      }

      attempts.push({
        model: candidateModel,
        attempt: attemptNumber,
        status: "success",
        httpStatus: response.status,
        latencyMs,
        errorMessage: null,
      });
      return {
        model: candidateModel,
        data: parsedMessage.data,
        usage: {
          ...aggregateUsage,
          provider:
            typeof payload?.provider === "string" ? payload.provider : null,
          requestId: typeof payload?.id === "string" ? payload.id : null,
          latencyMs: attempts.reduce((sum, entry) => sum + entry.latencyMs, 0),
          attempts,
          attemptedModels: attempts.map((entry) => entry.model),
        },
        prompts: {
          systemPrompt,
          userMessage: resolvedUserContent,
          responseRaw: parsedMessage.text,
        },
      };
    }
  }

  throw attachFailureUsage(
    lastError ?? new Error("OpenRouter request failed for all candidate models."),
    aggregateUsage,
    attempts,
  );
}
