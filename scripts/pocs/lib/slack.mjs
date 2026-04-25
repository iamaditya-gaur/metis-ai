import { sanitizeGraphPayload } from "./mask.mjs";
import { readRateLimitMs, waitForRateLimit } from "./rate-limit.mjs";

export function getSlackWebhookUrl() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    throw new Error("Missing SLACK_WEBHOOK_URL.");
  }

  return webhookUrl;
}

export async function postSlackMessage({ text, blocks = null }) {
  const webhookUrl = getSlackWebhookUrl();

  if (!text?.trim()) {
    throw new Error("Slack message text is empty.");
  }

  await waitForRateLimit("slack-webhook", readRateLimitMs("POC_SLACK_MIN_INTERVAL_MS", 1000));

  const payload = {
    text: text.trim(),
    ...(blocks ? { blocks } : {}),
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  if (!response.ok || rawText.trim() !== "ok") {
    throw new Error(
      `Slack webhook request failed with status ${response.status}: ${rawText.trim() || "empty body"}`,
    );
  }

  return {
    status: response.status,
    payloadPreview: sanitizeGraphPayload(payload),
    responseText: rawText.trim(),
  };
}

export function buildSlackBlocksFromReport(report) {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Metis AI Reporting POC",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: report.executiveSummary,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Next actions*\n${report.nextActions.map((item) => `• ${item}`).join("\n")}`,
      },
    },
  ];
}
