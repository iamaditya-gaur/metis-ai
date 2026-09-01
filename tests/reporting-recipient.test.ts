import { describe, expect, it } from "vitest";

import {
  buildRecipientHandle,
  ensureRecipientOpening,
  normalizeAccountDisplayName,
  resolveReportingAccountName,
} from "../src/lib/metis/recipient";

describe("reporting recipient guard", () => {
  it("normalizes a display name without allowing prompt delimiters or controls", () => {
    expect(normalizeAccountDisplayName("  @Example\n<Account>  ")).toBe("Example Account");
    expect(buildRecipientHandle("Example Account")).toBe("@example account");
  });

  it("prefers the account name returned by Meta over the request fallback", () => {
    expect(
      resolveReportingAccountName(
        [{ accountName: "Meta Account Name" }],
        "Browser Account Name",
      ),
    ).toBe("Meta Account Name");
  });

  it("replaces a wrong greeting without changing the message body", () => {
    expect(
      ensureRecipientOpening(
        "Hey @wrong account, last month held steady.",
        "Example Account",
      ).message,
    ).toBe("Hey @example account,\n\nlast month held steady.");
  });

  it("adds a greeting when the model omits one", () => {
    expect(
      ensureRecipientOpening("Last month held steady.", "Example Account").message,
    ).toBe("Hey @example account,\n\nLast month held steady.");
  });

  it("leaves an exact recipient opening unchanged", () => {
    const message = "Hi @example account, last month held steady.";
    expect(ensureRecipientOpening(message, "Example Account")).toEqual({
      message,
      recipient: "@example account",
      changed: false,
    });
  });
});
