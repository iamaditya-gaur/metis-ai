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

function humanizeActionType(actionType) {
  return String(actionType ?? "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const PRIMARY_RESULT_PRIORITIES = {
  OUTCOME_SALES: [
    "purchase",
    "onsite_conversion.purchase",
    "omni_purchase",
    "onsite_web_purchase",
    "onsite_web_app_purchase",
    "offsite_conversion.fb_pixel_purchase",
    "web_in_store_purchase",
    "web_app_in_store_purchase",
    "onsite_conversion.initiate_checkout",
    "initiate_checkout",
    "onsite_web_initiate_checkout",
    "omni_initiated_checkout",
    "add_to_cart",
    "onsite_conversion.add_to_cart",
    "onsite_web_add_to_cart",
    "omni_add_to_cart",
  ],
  OUTCOME_LEADS: [
    "lead",
    "onsite_web_lead",
    "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.lead_grouped",
    "offsite_complete_registration_add_meta_leads",
    "complete_registration",
    "omni_complete_registration",
    "onsite_conversion.total_messaging_connection",
    "onsite_conversion.messaging_conversation_started_7d",
    "onsite_conversion.messaging_conversation_replied_7d",
  ],
  OUTCOME_TRAFFIC: ["landing_page_view", "omni_landing_page_view", "link_click"],
  OUTCOME_ENGAGEMENT: ["post_engagement", "page_engagement", "video_view", "post_reaction"],
  OUTCOME_AWARENESS: ["reach", "landing_page_view", "page_engagement", "video_view"],
  OUTCOME_APP_PROMOTION: [
    "mobile_app_install",
    "app_install",
    "onsite_app_purchase",
    "onsite_app_view_content",
  ],
};

const FALLBACK_PRIMARY_RESULTS = [
  "purchase",
  "lead",
  "landing_page_view",
  "link_click",
  "post_engagement",
  "page_engagement",
  "video_view",
];

function getDominantObjective(rows) {
  const spendByObjective = new Map();

  for (const row of rows) {
    const objective = row.objective ?? "UNKNOWN";
    spendByObjective.set(objective, (spendByObjective.get(objective) ?? 0) + (row.spend ?? 0));
  }

  return [...spendByObjective.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function pickPrimaryResult({
  rows,
  totalSpend,
  actionTotals,
  topActions,
}) {
  const dominantObjective = getDominantObjective(rows);
  const preferredTypes = [
    ...(dominantObjective ? (PRIMARY_RESULT_PRIORITIES[dominantObjective] ?? []) : []),
    ...FALLBACK_PRIMARY_RESULTS,
  ];

  for (const actionType of preferredTypes) {
    const value = actionTotals.get(actionType);

    if (!value || value <= 0) {
      continue;
    }

    return {
      actionType,
      label: humanizeActionType(actionType),
      value: round(value, 2),
      costPerResult: round(totalSpend / value, 2),
      objective: dominantObjective,
    };
  }

  const fallback = topActions.find((action) => action.value !== null && action.value > 0) ?? null;

  if (!fallback) {
    return null;
  }

  return {
    actionType: fallback.actionType,
    label: fallback.label,
    value: fallback.value,
    costPerResult: fallback.value ? round(totalSpend / fallback.value, 2) : null,
    objective: dominantObjective,
  };
}

export function buildInsightsSnapshot(rows, dateRange) {
  const totalSpend = sumBy(rows, "spend");
  const totalImpressions = sumBy(rows, "impressions");
  const totalReach = sumBy(rows, "reach");
  const totalClicks = sumBy(rows, "clicks");
  const derivedCtr =
    totalImpressions > 0 ? round((totalClicks / totalImpressions) * 100, 2) : null;
  const derivedCpc = totalClicks > 0 ? round(totalSpend / totalClicks, 2) : null;
  const derivedCpm =
    totalImpressions > 0 ? round((totalSpend / totalImpressions) * 1000, 2) : null;
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
      label: humanizeActionType(actionType),
      value: round(value, 2),
    }));

  const primaryResult = pickPrimaryResult({
    rows,
    totalSpend,
    actionTotals,
    topActions,
  });

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
      cpm: derivedCpm,
      cpc: derivedCpc,
      frequency: averageFrequency,
      primaryResult,
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
