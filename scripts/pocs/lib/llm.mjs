import { readRateLimitMs, waitForRateLimit } from "./rate-limit.mjs";

export async function requestOpenRouterJson({
  systemPrompt,
  userPayload,
  model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5.4-mini",
}) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  await waitForRateLimit(
    "openrouter",
    readRateLimitMs("POC_OPENROUTER_MIN_INTERVAL_MS", 1500),
  );

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://metis-ai-nine.vercel.app",
      "X-OpenRouter-Title": "Metis AI",
    },
    body: JSON.stringify({
      model,
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
    throw new Error(
      `OpenRouter API request failed with status ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  const message = payload?.choices?.[0]?.message?.content;

  if (typeof message !== "string" || !message.trim()) {
    throw new Error("OpenRouter API returned no message content.");
  }

  try {
    return {
      model,
      data: JSON.parse(message),
    };
  } catch {
    throw new Error("OpenRouter message content was not valid JSON.");
  }
}
