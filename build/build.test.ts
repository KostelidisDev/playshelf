// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SITE_NAME, fillHtml, fillJson, siteName } from "./site-name.ts";
import { sitePolicy } from "./csp.ts";
import { shellFiles } from "./shell.ts";
import { appVersion } from "./version.ts";

describe("appVersion", () => {
  it("defaults to dev and validates APP_VERSION", () => {
    expect(appVersion({})).toBe("dev");
    expect(appVersion({ APP_VERSION: "v2026.10.08-build203015" })).toBe("v2026.10.08-build203015");
    expect(() => appVersion({ APP_VERSION: 'x"; alert(1)' })).toThrow("Invalid APP_VERSION");
  });
});

// Scratch files go in node_modules, which git ignores.
const TMP = resolve(import.meta.dirname, "../node_modules/.tmp");

describe("shellFiles", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("lists the fixed shell plus the hashed app files, without source maps", () => {
    dir = (mkdirSync(TMP, { recursive: true }), mkdtempSync(join(TMP, "shell-")));
    mkdirSync(join(dir, "assets/app"), { recursive: true });
    for (const file of ["index-abc.js", "index-abc.js.map", "index-def.css"]) writeFileSync(join(dir, "assets/app", file), "");
    expect(shellFiles(dir)).toEqual(expect.arrayContaining(["./", "assets/api/videos.csv", "assets/app/index-abc.js", "assets/app/index-def.css"]));
    expect(shellFiles(dir)).not.toContain("assets/app/index-abc.js.map");
  });

  it("fails without an app build", () => {
    dir = (mkdirSync(TMP, { recursive: true }), mkdtempSync(join(TMP, "shell-")));
    mkdirSync(join(dir, "assets/app"), { recursive: true });
    expect(() => shellFiles(dir)).toThrow("No app build");
  });
});

describe("sitePolicy", () => {
  it("reads the strict CSP from site.conf", () => {
    const policy = sitePolicy(resolve(import.meta.dirname, "../site.conf"));
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("style-src 'self'");
    expect(policy).not.toContain("unsafe-inline");
  });
});

describe("site name", () => {
  it("defaults, trims and rejects control characters", () => {
    expect(siteName({})).toBe(DEFAULT_SITE_NAME);
    expect(siteName({ SITE_NAME: " Some Site " })).toBe("Some Site");
    expect(() => siteName({ SITE_NAME: "a\nb" })).toThrow("Invalid SITE_NAME");
  });

  it("escapes the name for HTML and JSON", () => {
    expect(fillHtml('<title>__SITE_NAME__</title>', `Tom & "Jerry"<'>`))
      .toBe("<title>Tom &amp; &quot;Jerry&quot;&lt;&#39;&gt;</title>");
    expect(JSON.parse(fillJson('{"name":"__SITE_NAME__"}', 'a"b\\c'))).toEqual({ name: 'a"b\\c' });
  });
});
