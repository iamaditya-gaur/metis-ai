import { readRateLimitMs, waitForRateLimit } from "./rate-limit.mjs";

/**
 * @param {{
 *   systemPrompt: string;
 *   userPayload: unknown;
 *   model?: string;
 *   models?: string[] | null;
 *   temperature?: number;
 * }} options
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
  let lastError = null;

  for (const candidateModel of candidateModels) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: JSON.stringify(userPayload),
          },
        ],
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      lastError = new Error(
        `OpenRouter API request failed for ${candidateModel} with status ${response.status}: ${JSON.stringify(payload)}`,
      );
      continue;
    }

    const message = payload?.choices?.[0]?.message?.content;

    if (typeof message !== "string" || !message.trim()) {
      lastError = new Error(`OpenRouter API returned no message content for ${candidateModel}.`);
      continue;
    }

    try {
      return {
        model: candidateModel,
        data: JSON.parse(message),
      };
    } catch {
      lastError = new Error(`OpenRouter message content was not valid JSON for ${candidateModel}.`);
    }
  }

  throw lastError ?? new Error("OpenRouter request failed for all candidate models.");
}
