import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createPkcePair } from "../src/lib/llm-keys/pkce";

describe("createPkcePair", () => {
  it("challenge is base64url sha256 of verifier", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("pairs are unique per call", () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
  });
});
