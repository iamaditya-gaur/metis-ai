import { beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

import { buildAuthDialogUrl, parseSignedRequest } from "../src/lib/meta/oauth";

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

describe("buildAuthDialogUrl", () => {
  beforeEach(() => {
    process.env.META_APP_ID = "123456";
    process.env.META_APP_SECRET = "shh";
    process.env.META_OAUTH_REDIRECT_URI =
      "https://metis-ai-nine.vercel.app/api/meta/oauth/callback";
    delete process.env.META_LOGIN_CONFIG_ID;
    delete process.env.META_GRAPH_API_VERSION;
  });

  it("uses scope=ads_read when no config id is set", () => {
    const url = new URL(buildAuthDialogUrl({ state: "abc" }));
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/v25.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("123456");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://metis-ai-nine.vercel.app/api/meta/oauth/callback",
    );
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("scope")).toBe("ads_read");
    expect(url.searchParams.get("config_id")).toBeNull();
  });

  it("uses config_id when META_LOGIN_CONFIG_ID is set", () => {
    process.env.META_LOGIN_CONFIG_ID = "789";
    const url = new URL(buildAuthDialogUrl({ state: "abc" }));
    expect(url.searchParams.get("config_id")).toBe("789");
    expect(url.searchParams.get("scope")).toBeNull();
  });

  it("throws a named error when an env var is missing", () => {
    delete process.env.META_APP_ID;
    expect(() => buildAuthDialogUrl({ state: "abc" })).toThrow(/META_APP_ID/);
  });
});

describe("parseSignedRequest", () => {
  const secret = "test-secret";

  it("verifies and decodes a well-signed payload", () => {
    const payload = b64url(
      JSON.stringify({ user_id: "fb-1", algorithm: "HMAC-SHA256" }),
    );
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    const parsed = parseSignedRequest(`${sig}.${payload}`, secret);
    expect(parsed.user_id).toBe("fb-1");
  });

  it("rejects a tampered payload", () => {
    const payload = b64url(JSON.stringify({ user_id: "fb-1" }));
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    const evil = b64url(JSON.stringify({ user_id: "fb-2" }));
    expect(() => parseSignedRequest(`${sig}.${evil}`, secret)).toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => parseSignedRequest("no-dot-here", secret)).toThrow();
  });
});
