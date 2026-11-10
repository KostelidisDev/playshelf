// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sitePolicy } from "./csp.ts";
import { shellFiles } from "./shell.ts";
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME, fillHtml, fillJson, siteSettings } from "./site.ts";
import { buildStandalone, htaccess } from "./standalone.ts";
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

describe("site settings", () => {
  it("default, trim and reject control characters", () => {
    expect(siteSettings({})).toEqual({ name: DEFAULT_SITE_NAME, description: DEFAULT_SITE_DESCRIPTION });
    expect(siteSettings({ SITE_NAME: " Some Site ", SITE_DESCRIPTION: " About it. " }))
      .toEqual({ name: "Some Site", description: "About it." });
    expect(() => siteSettings({ SITE_NAME: "a\nb" })).toThrow("Invalid SITE_NAME");
    expect(() => siteSettings({ SITE_DESCRIPTION: "a\tb" })).toThrow("Invalid SITE_DESCRIPTION");
  });

  it("escape each setting for HTML and JSON", () => {
    const site = { name: `Tom & "Jerry"<'>`, description: 'a"b\\c' };
    expect(fillHtml('<title>__SITE_NAME__</title><meta content="__SITE_DESCRIPTION__">', site))
      .toBe('<title>Tom &amp; &quot;Jerry&quot;&lt;&#39;&gt;</title><meta content="a&quot;b\\c">');
    expect(JSON.parse(fillJson('{"name":"__SITE_NAME__","description":"__SITE_DESCRIPTION__"}', site)))
      .toEqual(site);
  });

  it("leave unknown placeholders alone", () => {
    expect(fillHtml("__SITE_OTHER__", { name: "n", description: "d" })).toBe("__SITE_OTHER__");
  });
});

describe("standalone build", () => {
  const conf = resolve(import.meta.dirname, "../site.conf");
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("carries site.conf's policy, headers and caching into .htaccess", () => {
    const text = htaccess(readFileSync(conf, "utf8"));
    expect(text).toContain(`Header always set Content-Security-Policy "${sitePolicy(conf)}"`);
    expect(text).toContain('Header always set X-Frame-Options "DENY"');
    expect(text).toContain("ExpiresByType text/html");
    expect(text).toContain("RewriteRule ^assets/api/videos\\.csv$ assets/demo/videos.csv [L]");
    expect(text).toMatch(/AddOutputFilterByType DEFLATE text\/html .* image\/svg\+xml\n/);
  });

  it("refuses a site.conf without a policy", () => {
    expect(() => htaccess("AddType text/csv .csv\n")).toThrow("site.conf");
  });

  it("fills in the settings and leaves out the catalog and thumbnails", () => {
    dir = (mkdirSync(TMP, { recursive: true }), mkdtempSync(join(TMP, "standalone-")));
    const dist = join(dir, "dist");
    const out = join(dir, "out");
    for (const sub of ["assets/api", "assets/thumbnails", "assets/demo", "assets/app"]) mkdirSync(join(dist, sub), { recursive: true });
    writeFileSync(join(dist, "index.html"), '<title>__SITE_NAME__</title><meta content="__SITE_DESCRIPTION__">');
    writeFileSync(join(dist, "manifest.webmanifest"), '{"name":"__SITE_NAME__","description":"__SITE_DESCRIPTION__"}');
    for (const file of ["assets/api/videos.csv", "assets/api/.gitkeep", "assets/thumbnails/abcdefghijk.webp", "assets/demo/videos.csv", "assets/app/index-abc.js", ".DS_Store"]) {
      writeFileSync(join(dist, file), "");
    }

    buildStandalone(dist, out, { name: "A & B", description: 'Say "hi"' }, conf);

    expect(readFileSync(join(out, "index.html"), "utf8")).toBe('<title>A &amp; B</title><meta content="Say &quot;hi&quot;">');
    expect(JSON.parse(readFileSync(join(out, "manifest.webmanifest"), "utf8"))).toEqual({ name: "A & B", description: 'Say "hi"' });
    expect(readFileSync(join(out, ".htaccess"), "utf8")).toContain("Content-Security-Policy");
    expect(existsSync(join(out, "assets/demo/videos.csv"))).toBe(true);
    expect(existsSync(join(out, "assets/app/index-abc.js"))).toBe(true);
    expect(existsSync(join(out, "assets/api"))).toBe(true);
    for (const file of ["assets/api/videos.csv", "assets/api/.gitkeep", "assets/thumbnails/abcdefghijk.webp", ".DS_Store"]) {
      expect(existsSync(join(out, file))).toBe(false);
    }
  });

  it("refuses a missing build or an output inside it", () => {
    dir = (mkdirSync(TMP, { recursive: true }), mkdtempSync(join(TMP, "standalone-")));
    const site = { name: "n", description: "d" };
    expect(() => buildStandalone(join(dir, "dist"), join(dir, "out"), site, conf)).toThrow("No build");
    mkdirSync(join(dir, "dist"));
    writeFileSync(join(dir, "dist/index.html"), "");
    expect(() => buildStandalone(join(dir, "dist"), join(dir, "dist/out"), site, conf)).toThrow("outside dist");
  });
});
