import { listAccessibleAdAccounts, normalizeAdAccountId } from "../../../scripts/pocs/lib/meta-client.mjs";
import { maskAdAccountId } from "../../../scripts/pocs/lib/mask.mjs";

import { defaultAccountBadges } from "@/lib/metis/types";
import { getConfiguredAccountIds } from "@/lib/metis/env";
import type { AccountOption } from "@/lib/metis/types";

export function getAccountLabel(accountId: string | null, fallbackName?: string | null) {
  if (!accountId) {
    return fallbackName?.trim() || "Unknown account";
  }

  const normalizedId = normalizeAdAccountId(accountId);
  const { reportingAccountId, draftAccountId } = getConfiguredAccountIds();

  if (normalizedId === reportingAccountId) {
    return defaultAccountBadges[0].label;
  }

  if (normalizedId === draftAccountId) {
    return defaultAccountBadges[1].label;
  }

  return fallbackName?.trim() || maskAdAccountId(normalizedId) || "Unknown account";
}

export async function getAccessibleAccounts(options?: {
  accessToken?: string | null;
}): Promise<AccountOption[]> {
  const { accounts } = await listAccessibleAdAccounts({
    accessToken: options?.accessToken ?? null,
  });
  const { reportingAccountId, draftAccountId } = getConfiguredAccountIds();

  return accounts.map((account) => ({
    id: account.id,
    label: getAccountLabel(account.id, account.name),
    role:
      account.id === reportingAccountId
        ? "reporting-default"
        : account.id === draftAccountId
          ? "builder-default"
          : "general",
    name: account.name ?? null,
    accountStatus: account.accountStatus ?? null,
    currency: account.currency ?? null,
    timezoneName: account.timezoneName ?? null,
    amountSpent: account.amountSpent ?? null,
  }));
}
