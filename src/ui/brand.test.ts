import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BRAND, siteName } from "./brand.ts";

function setMeta(content: string) {
  const meta = document.createElement("meta");
  meta.name = "application-name";
  meta.content = content;
  document.head.append(meta);
}

describe("siteName", () => {
  afterEach(() => document.head.querySelectorAll("meta").forEach((meta) => meta.remove()));

  it("reads the application-name meta tag", () => {
    setMeta(" Some Site ");
    expect(siteName()).toBe("Some Site");
  });

  it("falls back to the default without a filled-in name", () => {
    expect(siteName()).toBe(DEFAULT_BRAND);
    setMeta("__SITE_NAME__");
    expect(siteName()).toBe(DEFAULT_BRAND);
    document.head.querySelector("meta")!.content = "";
    expect(siteName()).toBe(DEFAULT_BRAND);
  });
});
