import { describe, expect, it } from "vitest";
import { buildVersion } from "./version.ts";

describe("buildVersion", () => {
  it("accepts build versions and dev", () => {
    expect(buildVersion("v2026.10.08-build203015")).toBe("v2026.10.08-build203015");
    expect(buildVersion("dev")).toBe("dev");
  });

  it("rejects anything else", () => {
    expect(buildVersion("")).toBeNull();
    expect(buildVersion("<b>x</b>")).toBeNull();
    expect(buildVersion("x".repeat(65))).toBeNull();
  });
});
