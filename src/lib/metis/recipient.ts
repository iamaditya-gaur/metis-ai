const MAX_ACCOUNT_NAME_LENGTH = 80;

export function normalizeAccountDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    // Account names enter LLM prompts and Slack markdown. Keep letters,
    // numbers, and ordinary business-name punctuation only.
    .replace(/[^\p{L}\p{N}\s&.'()_-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^@+/, "")
    .slice(0, MAX_ACCOUNT_NAME_LENGTH)
    .trim();

  return normalized || null;
}

export function buildRecipientHandle(accountName: unknown): string | null {
  const normalized = normalizeAccountDisplayName(accountName);
  return normalized ? `@${normalized.toLowerCase()}` : null;
}

export function resolveReportingAccountName(
  rows: Array<{ accountName?: unknown }>,
  fallbackName?: unknown,
): string | null {
  for (const row of rows) {
    const rowName = normalizeAccountDisplayName(row.accountName);
    if (rowName) return rowName;
  }

  return normalizeAccountDisplayName(fallbackName);
}

export function ensureRecipientOpening(message: string, accountName: unknown) {
  const recipient = buildRecipientHandle(accountName);
  const normalizedMessage = message.trim();

  if (!recipient || !normalizedMessage) {
    return { message: normalizedMessage, recipient, changed: false };
  }

  const escapedRecipient = recipient.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`^(?:hey|hi)\\s+${escapedRecipient}\\s*,`, "i").test(normalizedMessage)) {
    return { message: normalizedMessage, recipient, changed: false };
  }

  const openingGreeting = normalizedMessage.match(
    /^(?:hey|hi)\b[^\n]{0,80}(?:[,!:;]\s*|\n+)/i,
  );
  const body = openingGreeting
    ? normalizedMessage.slice(openingGreeting[0].length).trimStart()
    : normalizedMessage;
  const repaired = body
    ? `Hey ${recipient},\n\n${body}`
    : `Hey ${recipient},`;

  return { message: repaired, recipient, changed: true };
}

export function redactGreetingRecipient(message: string) {
  return message.replace(
    /^(hey|hi)\s+@?[^,\n!:;]{1,80}[,!:;]?/i,
    "$1 @recipient,",
  );
}
