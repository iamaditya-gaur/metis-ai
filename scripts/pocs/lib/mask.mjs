function maskCore(value, visibleStart = 2, visibleEnd = 4) {
  if (value === null || value === undefined) {
    return null;
  }

  const input = String(value).trim();

  if (!input) {
    return "";
  }

  if (input.length <= visibleStart + visibleEnd) {
    return `${input[0]}***${input.at(-1) ?? ""}`;
  }

  return `${input.slice(0, visibleStart)}***${input.slice(-visibleEnd)}`;
}

export function maskAdAccountId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const input = String(value).trim();

  if (input.startsWith("act_")) {
    return `act_${maskCore(input.slice(4), 0, 4)}`;
  }

  return maskCore(input, 0, 4);
}

export function maskName(value) {
  return maskCore(value, 2, 1);
}

export function sanitizeGraphPayload(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGraphPayload(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => {
        if (/token|secret|authorization|proof/i.test(key)) {
          return [key, "REDACTED"];
        }

        return [key, sanitizeGraphPayload(entryValue)];
      }),
    );
  }

  return value;
}
