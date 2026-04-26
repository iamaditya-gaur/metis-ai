import { access } from "node:fs/promises";

import { getObservabilityLogPath } from "../../../scripts/pocs/lib/observability.mjs";
import { normalizeAdAccountId } from "../../../scripts/pocs/lib/meta-client.mjs";

import type { SetupReadiness } from "@/lib/metis/types";

function resolveAccountId(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  try {
    return normalizeAdAccountId(value.trim());
  } catch {
    return null;
  }
}

export function getConfiguredAccountIds() {
  return {
    reportingAccountId: resolveAccountId(
      process.env.META_REPORTING_ACCOUNT_ID ?? process.env.META_AD_ACCOUNT_ID,
    ),
    draftAccountId: resolveAccountId(
      process.env.META_DRAFT_ACCOUNT_ID ??
        process.env.META_ACTION_ACCOUNT_ID ??
        process.env.META_AD_ACCOUNT_ID,
    ),
  };
}

export async function getSetupReadiness(): Promise<SetupReadiness> {
  const logPath = getObservabilityLogPath();
  let observabilityReady = false;

  try {
    await access(logPath);
    observabilityReady = true;
  } catch {
    observabilityReady = false;
  }

  const { reportingAccountId, draftAccountId } = getConfiguredAccountIds();

  return {
    metaTokenReady: Boolean(process.env.META_ACCESS_TOKEN?.trim()),
    reportingAccountReady: Boolean(reportingAccountId),
    draftAccountReady: Boolean(draftAccountId),
    slackReady: Boolean(process.env.SLACK_WEBHOOK_URL?.trim()),
    openRouterReady: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    observabilityReady,
    logPath,
  };
}
