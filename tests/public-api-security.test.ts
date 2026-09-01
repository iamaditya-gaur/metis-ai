import { describe, expect, it } from "vitest";

import * as accountsRoute from "../src/app/api/metis/accounts/route";
import { GET as getHealth } from "../src/app/api/health/route";
import { GET as getSetup } from "../src/app/api/metis/setup/route";

describe("public API security boundaries", () => {
  it("does not expose an environment-backed account-list GET handler", () => {
    expect("GET" in accountsRoute).toBe(false);
    expect(typeof accountsRoute.POST).toBe("function");
  });

  it("returns only aggregate readiness from the public health route", async () => {
    const response = await getHealth();
    const payload = await response.json();

    expect(Object.keys(payload)).toEqual(["ok"]);
    expect(typeof payload.ok).toBe("boolean");
  });

  it("rejects setup metadata without a signed admin cookie", async () => {
    const response = await getSetup(
      new Request("https://example.test/api/metis/setup"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Unauthorized." });
  });
});
