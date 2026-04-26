import crypto from "node:crypto";

import { sanitizeGraphPayload } from "./mask.mjs";
import { readRateLimitMs, waitForRateLimit } from "./rate-limit.mjs";

const GRAPH_BASE_URL = "https://graph.facebook.com";

export class MetaApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "MetaApiError";
    this.details = details;
  }
}

function getMetaAccessToken(tokenOverride = null) {
  const token = tokenOverride?.trim() || process.env.META_ACCESS_TOKEN?.trim();

  if (!token) {
    throw new MetaApiError("Missing META_ACCESS_TOKEN.");
  }

  return token;
}

function getGraphBaseUrl() {
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  return version ? `${GRAPH_BASE_URL}/${version}` : GRAPH_BASE_URL;
}

function buildAppSecretProof(token) {
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (!appSecret) {
    return null;
  }

  return crypto.createHmac("sha256", appSecret).update(token).digest("hex");
}

export function normalizeAdAccountId(accountId) {
  if (!accountId) {
    throw new MetaApiError("Missing Meta ad account ID.");
  }

  const trimmed = String(accountId).trim();

  if (!trimmed) {
    throw new MetaApiError("Meta ad account ID is blank.");
  }

  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeActions(actions) {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map((action) => ({
      actionType: action?.action_type ?? null,
      value: toNumber(action?.value),
    }))
    .filter((action) => action.actionType);
}

function safeJsonParse(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectUsagePercents(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectUsagePercents(item));
  }

  if (!value || typeof value !== "object") {
    return typeof value === "number" ? [value] : [];
  }

  return Object.entries(value).flatMap(([key, entryValue]) => {
    if (
      typeof entryValue === "number" &&
      /(pct|percent|call_count|total_time|total_cputime|cpu_time|acc_id_util_pct)/i.test(key)
    ) {
      return [entryValue];
    }

    return collectUsagePercents(entryValue);
  });
}

function collectRegainTimes(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRegainTimes(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, entryValue]) => {
    if (
      typeof entryValue === "number" &&
      /(estimated_time_to_regain_access|reset_time_duration)/i.test(key)
    ) {
      return [entryValue];
    }

    return collectRegainTimes(entryValue);
  });
}

function getMetaUsageHeaders(headers) {
  const appUsage = safeJsonParse(headers.get("x-app-usage"));
  const adAccountUsage = safeJsonParse(headers.get("x-ad-account-usage"));
  const businessUseCaseUsage = safeJsonParse(headers.get("x-business-use-case-usage"));

  return {
    appUsage,
    adAccountUsage,
    businessUseCaseUsage,
  };
}

function computeMetaCoolDownMs(usageHeaders) {
  const warningThreshold = Number.parseInt(
    process.env.POC_META_USAGE_WARNING_PCT?.trim() || "",
    10,
  );
  const threshold = Number.isFinite(warningThreshold) ? warningThreshold : 70;

  const fallbackMs = readRateLimitMs("POC_META_USAGE_COOLDOWN_MS", 15000);
  const percents = collectUsagePercents(usageHeaders);
  const regainTimes = collectRegainTimes(usageHeaders);
  const highestPercent = percents.length ? Math.max(...percents) : 0;

  if (highestPercent < threshold) {
    return 0;
  }

  const regainedMs = regainTimes.length ? Math.max(...regainTimes) * 1000 : 0;
  return Math.max(fallbackMs, regainedMs);
}

function isMetaThrottleError(metaError) {
  const code = metaError?.code;
  const subcode = metaError?.error_subcode;
  const message = String(metaError?.message ?? "");

  return (
    [4, 17, 32, 613, 80000, 80003].includes(code) ||
    [2446079].includes(subcode) ||
    /rate limit|too many calls|user request limit reached/i.test(message)
  );
}

async function maybeCoolDownFromHeaders(response) {
  const usageHeaders = getMetaUsageHeaders(response.headers);
  const coolDownMs = computeMetaCoolDownMs(usageHeaders);

  if (coolDownMs > 0) {
    await waitForRateLimit("meta-cooldown", coolDownMs);
  }

  return usageHeaders;
}

function buildUrl(pathname, query = {}, tokenOverride = null) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(`${getGraphBaseUrl()}${normalizedPath}`);
  const token = getMetaAccessToken(tokenOverride);

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  url.searchParams.set("access_token", token);

  const appSecretProof = buildAppSecretProof(token);

  if (appSecretProof) {
    url.searchParams.set("appsecret_proof", appSecretProof);
  }

  return url;
}

async function parseJsonResponse(response) {
  const rawText = await response.text();

  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    return { rawText };
  }
}

async function requestJson(url) {
  await waitForRateLimit("meta-read", readRateLimitMs("POC_META_READ_MIN_INTERVAL_MS", 1000));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  const usageHeaders = await maybeCoolDownFromHeaders(response);

  const payload = await parseJsonResponse(response);
  const metaError = payload?.error;

  if (!response.ok || metaError) {
    throw new MetaApiError(
      metaError?.message || `Meta API request failed with status ${response.status}.`,
      {
        status: response.status,
        error: sanitizeGraphPayload(metaError ?? payload),
        usage: sanitizeGraphPayload(usageHeaders),
        throttled: isMetaThrottleError(metaError),
      },
    );
  }

  return {
    status: response.status,
    payload,
  };
}

async function requestWithMethod(url, { method = "GET", body = null } = {}) {
  await waitForRateLimit(
    method === "POST" ? "meta-write" : "meta-read",
    readRateLimitMs(
      method === "POST" ? "POC_META_WRITE_MIN_INTERVAL_MS" : "POC_META_READ_MIN_INTERVAL_MS",
      method === "POST" ? 2000 : 1000,
    ),
  );

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const usageHeaders = await maybeCoolDownFromHeaders(response);

  const payload = await parseJsonResponse(response);
  const metaError = payload?.error;

  if (!response.ok || metaError) {
    throw new MetaApiError(
      metaError?.message || `Meta API request failed with status ${response.status}.`,
      {
        status: response.status,
        error: sanitizeGraphPayload(metaError ?? payload),
        usage: sanitizeGraphPayload(usageHeaders),
        throttled: isMetaThrottleError(metaError),
      },
    );
  }

  return {
    status: response.status,
    payload,
  };
}

async function requestAllPages(pathname, query, maxPages = 10, tokenOverride = null) {
  const pages = [];
  const records = [];
  let nextUrl = buildUrl(pathname, query, tokenOverride).toString();

  for (let page = 1; nextUrl && page <= maxPages; page += 1) {
    const { status, payload } = await requestJson(nextUrl);
    const data = Array.isArray(payload?.data) ? payload.data : [];

    records.push(...data);
    pages.push({
      page,
      status,
      dataCount: data.length,
      hasNextPage: Boolean(payload?.paging?.next),
    });

    nextUrl = payload?.paging?.next ?? null;
  }

  return {
    data: records,
    pages,
  };
}

/**
 * @param {{ accessToken?: string | null }=} options
 */
export async function listAccessibleAdAccounts({ accessToken } = {}) {
  const { data, pages } = await requestAllPages(
    "/me/adaccounts",
    {
      fields:
        "id,account_id,name,account_status,currency,timezone_name,amount_spent",
      limit: 100,
    },
    5,
    accessToken ?? null,
  );

  return {
    accounts: data.map((account) => ({
      id: normalizeAdAccountId(account.id ?? account.account_id),
      accountId: account.account_id ? String(account.account_id) : null,
      name: account.name ?? null,
      accountStatus: account.account_status ?? null,
      currency: account.currency ?? null,
      timezoneName: account.timezone_name ?? null,
      amountSpent: toNumber(account.amount_spent),
    })),
    pages,
  };
}

export function resolveDateRangeFromEnv() {
  const from = process.env.REPORT_DATE_FROM?.trim();
  const to = process.env.REPORT_DATE_TO?.trim();
  const preset = process.env.REPORT_DATE_PRESET?.trim();

  if (from && to) {
    return {
      from,
      to,
      preset: null,
      label: `${from} to ${to}`,
    };
  }

  if (preset) {
    return {
      from: null,
      to: null,
      preset,
      label: `preset:${preset}`,
    };
  }

  throw new MetaApiError(
    "Missing reporting date range. Set REPORT_DATE_FROM and REPORT_DATE_TO, or REPORT_DATE_PRESET.",
  );
}

/**
 * @param {{
 *   accountId: string;
 *   level?: string;
 *   dateRange?: { from?: string | null; to?: string | null; preset?: string | null };
 *   accessToken?: string | null;
 * }} options
 */
export async function getAccountInsights({
  accountId,
  level = "campaign",
  dateRange,
  accessToken = null,
}) {
  const normalizedAccountId = normalizeAdAccountId(accountId);
  const query = {
    fields:
      "account_id,account_name,campaign_id,campaign_name,objective,spend,impressions,reach,clicks,ctr,cpc,frequency,actions,action_values,cost_per_action_type,date_start,date_stop",
    level,
    limit: 100,
    time_increment: "all_days",
  };

  if (dateRange?.from && dateRange?.to) {
    query.time_range = JSON.stringify({
      since: dateRange.from,
      until: dateRange.to,
    });
  } else if (dateRange?.preset) {
    query.date_preset = dateRange.preset;
  }

  const { data, pages } = await requestAllPages(
    `/${normalizedAccountId}/insights`,
    query,
    10,
    accessToken,
  );

  return {
    accountId: normalizedAccountId,
    level,
    dateRange,
    rows: data.map((row) => ({
      accountId: row.account_id ? normalizeAdAccountId(row.account_id) : normalizedAccountId,
      accountName: row.account_name ?? null,
      campaignId: row.campaign_id ?? null,
      campaignName: row.campaign_name ?? null,
      objective: row.objective ?? null,
      spend: toNumber(row.spend),
      impressions: toInteger(row.impressions),
      reach: toInteger(row.reach),
      clicks: toInteger(row.clicks),
      ctr: toNumber(row.ctr),
      cpc: toNumber(row.cpc),
      frequency: toNumber(row.frequency),
      actions: normalizeActions(row.actions),
      actionValues: normalizeActions(row.action_values),
      costPerActionType: normalizeActions(row.cost_per_action_type),
      dateStart: row.date_start ?? null,
      dateStop: row.date_stop ?? null,
    })),
    pages,
  };
}

export async function createPausedCampaignDraft({ accountId, campaignDraft }) {
  const normalizedAccountId = normalizeAdAccountId(accountId);

  if (!campaignDraft || typeof campaignDraft !== "object") {
    throw new MetaApiError("Missing campaignDraft payload for paused campaign creation.");
  }

  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(campaignDraft)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    if (Array.isArray(value) || (value && typeof value === "object")) {
      body.set(key, JSON.stringify(value));
    } else {
      body.set(key, String(value));
    }
  }

  const url = buildUrl(`/${normalizedAccountId}/campaigns`);
  const { status, payload } = await requestWithMethod(url, {
    method: "POST",
    body: body.toString(),
  });

  return {
    status,
    payload: sanitizeGraphPayload(payload),
  };
}
