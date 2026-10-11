import { afterEach, describe, expect, it } from "vitest";
import { channelName, DEFAULT_BRAND } from "./brand.ts";

function setMeta(content: string) {
  const meta = document.createElement("meta");
  meta.name = "application-name";
  meta.content = content;
  document.head.append(meta);
}

describe("channelName", () => {
  afterEach(() => document.head.querySelectorAll("meta").forEach((meta) => meta.remove()));

  it("reads the application-name meta tag", () => {
    setMeta(" Some Channel ");
    expect(channelName()).toBe("Some Channel");
  });

  it("falls back to the default without a filled-in name", () => {
    expect(channelName()).toBe(DEFAULT_BRAND);
    setMeta("__CHANNEL_NAME__");
    expect(channelName()).toBe(DEFAULT_BRAND);
    document.head.querySelector("meta")!.content = "";
    expect(channelName()).toBe(DEFAULT_BRAND);
  });
});
