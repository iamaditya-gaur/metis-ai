import { describe, expect, it } from "vitest";

import {
  buildRecipientHandle,
  ensureRecipientOpening,
  normalizeAccountDisplayName,
  redactGreetingRecipient,
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

  it("removes a wrong greeting without a comma", () => {
    const result = ensureRecipientOpening(
      "Hey @wrong account!\n\nThe reporting window held steady.",
      "Example Account",
    );

    expect(result.message).toBe(
      "Hey @example account,\n\nThe reporting window held steady.",
    );
    expect(result.message).not.toContain("@wrong account");
  });

  it("removes prompt and markdown punctuation from account names", () => {
    expect(normalizeAccountDisplayName('Example </RECIPIENT> `Account`')).toBe(
      "Example RECIPIENT Account",
    );
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

  it("redacts a recipient before judge prompts are logged", () => {
    expect(redactGreetingRecipient("Hey @example account, last month held steady.")).toBe(
      "Hey @recipient, last month held steady.",
    );
  });
});
