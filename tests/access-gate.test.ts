import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasValidAccessCookie,
  isAccessGateConfigured,
  issueAccessCookieValue,
  verifyAccessCode,
} from "../src/lib/auth/access-gate";

const CODE = "test-code-0123456789abcdef";

describe("access gate", () => {
  beforeEach(() => {
    vi.stubEnv("METIS_ACCESS_CODE", CODE);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("accepts the exact code and rejects anything else", () => {
    expect(verifyAccessCode(CODE)).toBe(true);
    expect(verifyAccessCode(`  ${CODE}  `)).toBe(true);
    expect(verifyAccessCode(CODE.slice(0, -1))).toBe(false);
    expect(verifyAccessCode("")).toBe(false);
    expect(verifyAccessCode("x".repeat(1000))).toBe(false);
  });

  it("stays locked when the code is missing or too short", () => {
    vi.stubEnv("METIS_ACCESS_CODE", "");
    expect(isAccessGateConfigured()).toBe(false);
    expect(verifyAccessCode("")).toBe(false);
    expect(issueAccessCookieValue()).toBeNull();

    vi.stubEnv("METIS_ACCESS_CODE", "short");
    expect(isAccessGateConfigured()).toBe(false);
    expect(verifyAccessCode("short")).toBe(false);
  });

  it("issues a cookie that verifies, and rejects tampering", () => {
    const issued = issueAccessCookieValue();
    expect(issued).not.toBeNull();
    expect(hasValidAccessCookie(issued!.value)).toBe(true);

    const [expiresAt, signature] = issued!.value.split(".");
    expect(hasValidAccessCookie(`${Number(expiresAt) + 999999}.${signature}`)).toBe(false);
    expect(hasValidAccessCookie(`${expiresAt}.${"0".repeat(signature.length)}`)).toBe(false);
    expect(hasValidAccessCookie(`${expiresAt}.short`)).toBe(false);
    expect(hasValidAccessCookie("garbage")).toBe(false);
    expect(hasValidAccessCookie(undefined)).toBe(false);
  });

  it("expires the cookie after its lifetime", () => {
    const issued = issueAccessCookieValue()!;
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (issued.maxAge + 1) * 1000);
    expect(hasValidAccessCookie(issued.value)).toBe(false);
  });

  it("signs every browser out when the code changes", () => {
    const issued = issueAccessCookieValue()!;
    vi.stubEnv("METIS_ACCESS_CODE", "a-different-code-0123456789");
    expect(hasValidAccessCookie(issued.value)).toBe(false);
  });
});
