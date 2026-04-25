import { normalizeAdAccountId } from "./meta-client.mjs";

export const ACCOUNT_LABELS = {
  reporting: "CB",
  draft: "Adi personal",
};

export function resolveReportingAccountId() {
  const value =
    process.env.META_REPORTING_ACCOUNT_ID?.trim() || process.env.META_AD_ACCOUNT_ID?.trim();

  return normalizeAdAccountId(value);
}

export function resolveDraftAccountId() {
  const value =
    process.env.META_DRAFT_ACCOUNT_ID?.trim() ||
    process.env.META_ACTION_ACCOUNT_ID?.trim() ||
    process.env.META_AD_ACCOUNT_ID?.trim();

  return normalizeAdAccountId(value);
}
