import { readFile } from "node:fs/promises";

import { maskAdAccountId, maskName } from "./mask.mjs";

function round(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return Number(value.toFixed(decimals));
}

function sumBy(rows, key) {
  return rows.reduce((total, row) => total + (row[key] ?? 0), 0);
}

function normalizeActionType(actionType) {
  return actionType?.trim().toLowerCase() ?? null;
}

export function buildInsightsSnapshot(rows, dateRange) {
  const totalSpend = sumBy(rows, "spend");
  const totalImpressions = sumBy(rows, "impressions");
  const totalReach = sumBy(rows, "reach");
  const totalClicks = sumBy(rows, "clicks");
  const derivedCtr =
    totalImpressions > 0 ? round((totalClicks / totalImpressions) * 100, 2) : null;
  const derivedCpc = totalClicks > 0 ? round(totalSpend / totalClicks, 2) : null;
  const averageFrequency =
    totalReach > 0 ? round(totalImpressions / totalReach, 2) : null;

  const actionTotals = new Map();

  for (const row of rows) {
    for (const action of row.actions ?? []) {
      const actionType = normalizeActionType(action.actionType);

      if (!actionType || action.value === null) {
        continue;
      }

      actionTotals.set(actionType, (actionTotals.get(actionType) ?? 0) + action.value);
    }
  }

  const topActions = [...actionTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([actionType, value]) => ({
      actionType,
      value: round(value, 2),
    }));

  const topCampaigns = [...rows]
    .sort((left, right) => (right.spend ?? 0) - (left.spend ?? 0))
    .slice(0, 5)
    .map((row) => ({
      campaignId: row.campaignId ? maskAdAccountId(row.campaignId) : null,
      campaignName: maskName(row.campaignName),
      objective: row.objective,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      cpc: row.cpc,
    }));

  const dataQuality = [];

  if (rows.length === 0) {
    dataQuality.push("No insight rows were returned.");
  }

  if (!topActions.length) {
    dataQuality.push("No action metrics were present in the returned rows.");
  }

  return {
    dateRange,
    rowCount: rows.length,
    totals: {
      spend: round(totalSpend, 2),
      impressions: totalImpressions,
      reach: totalReach,
      clicks: totalClicks,
      ctr: derivedCtr,
      cpc: derivedCpc,
      frequency: averageFrequency,
    },
    topActions,
    topCampaigns,
    dataQuality,
  };
}

export function buildReportPromptInput({ accountId, rows, dateRange }) {
  return {
    selectedAccountId: maskAdAccountId(accountId),
    reportingWindow: dateRange,
    snapshot: buildInsightsSnapshot(rows, dateRange),
    constraints: [
      "Do not invent metrics that are missing from input.",
      "Keep claims grounded in the provided metrics only.",
      "Output must include executiveSummary, whatChanged, risks, nextActions, and slackMessage.",
      "Slack message must be concise and readable.",
    ],
  };
}

function validateGeneratedReport(value) {
  if (!value || typeof value !== "object") {
    throw new Error("OpenRouter output was not a JSON object.");
  }

  const requiredKeys = [
    "executiveSummary",
    "whatChanged",
    "risks",
    "nextActions",
    "slackMessage",
  ];

  for (const key of requiredKeys) {
    if (!(key in value)) {
      throw new Error(`OpenRouter output is missing required key: ${key}.`);
    }
  }

  return {
    executiveSummary: String(value.executiveSummary ?? "").trim(),
    whatChanged: Array.isArray(value.whatChanged)
      ? value.whatChanged.map((item) => String(item).trim()).filter(Boolean)
      : [],
    risks: Array.isArray(value.risks)
      ? value.risks.map((item) => String(item).trim()).filter(Boolean)
      : [],
    nextActions: Array.isArray(value.nextActions)
      ? value.nextActions.map((item) => String(item).trim()).filter(Boolean)
      : [],
    slackMessage: String(value.slackMessage ?? "").trim(),
  };
}

export async function generateOpenRouterReportSummary(promptInput) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5.4-mini";
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
          content:
            "You are the Reporting Analyst Agent for Metis AI. Use OpenRouter as the LLM gateway. Return valid JSON only with keys executiveSummary, whatChanged, risks, nextActions, slackMessage. Never invent metrics, never expose secrets, and keep the Slack message concise.",
        },
        {
          role: "user",
          content: JSON.stringify(promptInput),
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

  let parsed;

  try {
    parsed = JSON.parse(message);
  } catch {
    throw new Error("OpenRouter message content was not valid JSON.");
  }

  return {
    model,
    report: validateGeneratedReport(parsed),
  };
}

export async function readJsonFile(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}
