// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sitePolicy, studioPolicy } from "./csp.ts";
import { shellFiles, studioShellFiles } from "./shell.ts";
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME, fillHtml, fillJson, linkTags, requireSiteUrl, siteSettings } from "./site.ts";
import { buildStandalone, htaccess, studioHtaccess } from "./standalone.ts";
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
    expect(shellFiles(dir)).toEqual(expect.arrayContaining(["./", "assets/api/Games.txt", "assets/api/Videos.txt", "assets/app/index-abc.js", "assets/app/index-def.css"]));
    expect(shellFiles(dir)).not.toContain("assets/app/index-abc.js.map");
  });

  it("fails without an app build", () => {
    dir = (mkdirSync(TMP, { recursive: true }), mkdtempSync(join(TMP, "shell-")));
    mkdirSync(join(dir, "assets/app"), { recursive: true });
    expect(() => shellFiles(dir)).toThrow("No app build");
  });
});

describe("studioShellFiles", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("lists the editor's page, the hashed files its HTML loads, and its icons, relative to /studio/", () => {
    dir = (mkdirSync(TMP, { recursive: true }), mkdtempSync(join(TMP, "studio-shell-")));
    mkdirSync(join(dir, "studio"), { recursive: true });
    writeFileSync(join(dir, "studio/index.html"), [
      '<link rel="icon" href="../assets/icons/icon.svg">',
      '<script type="module" src="../assets/app/studio-abc.js"></script>',
      '<link rel="modulepreload" href="../assets/app/style-def.js">',
      '<link rel="stylesheet" href="../assets/app/studio-ghi.css">',
    ].join("\n"));
    const files = studioShellFiles(dir);
    expect(files).toEqual(expect.arrayContaining(["./", "manifest.webmanifest", "../assets/app/studio-abc.js", "../assets/app/studio-ghi.css"]));
    // The icon is listed once, though both the page and the list name it.
    expect(files.filter((file) => file === "../assets/icons/icon.svg")).toHaveLength(1);
  });

  it("fails without an editor build", () => {
    dir = (mkdirSync(TMP, { recursive: true }), mkdtempSync(join(TMP, "studio-shell-")));
    mkdirSync(join(dir, "studio"), { recursive: true });
    writeFileSync(join(dir, "studio/index.html"), "<p></p>");
    expect(() => studioShellFiles(dir)).toThrow("No editor build");
  });
});

describe("studio manifest", () => {
  it("has its own id, apart from the site's, so Chrome installs it as its own app", () => {
    const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, "../public/studio/manifest.webmanifest"), "utf8")) as { id: string };
    const site = JSON.parse(readFileSync(resolve(import.meta.dirname, "../public/manifest.webmanifest"), "utf8")) as { id: string };
    // Chrome resolves a relative id against the site root, so "./" here would
    // be the site's own id. An absolute path is the editor's alone.
    expect(manifest.id).toBe("/studio/");
    expect(manifest.id).not.toBe(site.id);
  });

  it("names only icons that exist, as the editor's page sees them", () => {
    const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, "../public/studio/manifest.webmanifest"), "utf8")) as { icons: { src: string }[] };
    const root = resolve(import.meta.dirname, "../public/studio");
    for (const icon of manifest.icons) expect(existsSync(resolve(root, icon.src)), icon.src).toBe(true);
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

describe("studioPolicy", () => {
  const conf = resolve(import.meta.dirname, "../site.conf");

  it("is the site's policy with YouTube allowed for the title lookup, and nothing else", () => {
    const site = sitePolicy(conf);
    const studio = studioPolicy(conf);
    expect(site).not.toContain("youtube");
    expect(studio.replace("connect-src 'self' https://www.youtube.com", "connect-src 'self'")).toBe(site);
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

  it("read SITE_URL as the site's root, and reject anything else", () => {
    expect(siteSettings({})).not.toHaveProperty("url");
    expect(siteSettings({ SITE_URL: "  " })).not.toHaveProperty("url");
    expect(siteSettings({ SITE_URL: " https://games.example.com " }).url).toBe("https://games.example.com/");
    expect(siteSettings({ SITE_URL: "https://example.com/games///" }).url).toBe("https://example.com/games/");
    for (const bad of ["games.example.com", "ftp://x.com", "https://x.com/?a=1", "https://x.com/#top", 'https://x.com/"', "https://"]) {
      expect(() => siteSettings({ SITE_URL: bad })).toThrow("Invalid SITE_URL");
    }
  });

  it("write the link tags only with a SITE_URL, escaped for HTML", () => {
    expect(linkTags({ name: "n", description: "d" })).toBe("");
    const tags = linkTags({ name: "n", description: "d", url: "https://x.com/a/&b/" });
    expect(tags).toContain("<link rel='canonical' href='https://x.com/a/&amp;b/'>");
    expect(tags).toContain("<meta property='og:image' content='https://x.com/a/&amp;b/assets/icons/icon-512.png'>");
    expect(tags).not.toContain('"');
    expect(fillHtml('<head>__SITE_LINKS__</head>', { name: "n", description: "d" })).toBe("<head></head>");
  });

  it("leave unknown placeholders alone", () => {
    expect(fillHtml("__SITE_OTHER__", { name: "n", description: "d" })).toBe("__SITE_OTHER__");
  });
});

describe("published sites", () => {
  it("need a SITE_URL", () => {
    expect(() => requireSiteUrl(siteSettings({}))).toThrow("SITE_URL must be set");
    expect(requireSiteUrl(siteSettings({ SITE_URL: "https://games.example.com" })).url).toBe("https://games.example.com/");
  });
});

describe("robots.txt", () => {
  const robots = readFileSync(resolve(import.meta.dirname, "../public/robots.txt"), "utf8");
  const rules = robots.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));

  it("lets crawlers index the home page only, and keeps the editor out", () => {
    expect(rules).toContain("Allow: /$");
    expect(rules).toContain("Disallow: /");
    expect(rules).toContain("Disallow: /studio/");
    // Every allow is for the home page or the files it needs to render.
    for (const rule of rules.filter((line) => line.startsWith("Allow:"))) {
      expect(rule === "Allow: /$" || /^Allow: \/(assets\/(api|app|icons)\/|manifest\.webmanifest)$/.test(rule)).toBe(true);
    }
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
    expect(text).toContain("RewriteCond %{DOCUMENT_ROOT}/assets/api/Games.txt !-f");
    expect(text).toContain("RewriteRule ^assets/api/(Games|Videos)\\.txt$ assets/demo/$1.txt [L]");
    expect(text).toMatch(/AddOutputFilterByType DEFLATE text\/html .* image\/svg\+xml\n/);
  });

  it("keeps the editor's policy out of the site's .htaccess, and puts it in the editor's folder", () => {
    const text = readFileSync(conf, "utf8");
    expect(htaccess(text)).not.toContain("youtube");
    expect(studioHtaccess(text)).toContain(`Header always set Content-Security-Policy "${studioPolicy(conf)}"`);
    expect(studioHtaccess("AddType text/csv .csv\n")).toBeNull();
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
    // The catalog editor's page and manifest carry the name too.
    mkdirSync(join(dist, "studio"));
    writeFileSync(join(dist, "studio/index.html"), '<title>__SITE_NAME__ Catalog editor</title><meta content="__SITE_DESCRIPTION__">');
    writeFileSync(join(dist, "studio/manifest.webmanifest"), '{"name":"__SITE_NAME__ Catalog editor"}');
    for (const file of ["assets/api/Games.txt", "assets/api/Videos.txt", "assets/api/.gitkeep", "assets/thumbnails/abcdefghijk.webp", "assets/demo/Videos.txt", "assets/app/index-abc.js", ".DS_Store"]) {
      writeFileSync(join(dist, file), "");
    }

    buildStandalone(dist, out, { name: "A & B", description: 'Say "hi"' }, conf);

    expect(readFileSync(join(out, "index.html"), "utf8")).toBe('<title>A &amp; B</title><meta content="Say &quot;hi&quot;">');
    expect(JSON.parse(readFileSync(join(out, "manifest.webmanifest"), "utf8"))).toEqual({ name: "A & B", description: 'Say "hi"' });
    expect(readFileSync(join(out, "studio/index.html"), "utf8")).toBe('<title>A &amp; B Catalog editor</title><meta content="Say &quot;hi&quot;">');
    expect(JSON.parse(readFileSync(join(out, "studio/manifest.webmanifest"), "utf8"))).toEqual({ name: "A & B Catalog editor" });
    expect(readFileSync(join(out, ".htaccess"), "utf8")).toContain("Content-Security-Policy");
    expect(readFileSync(join(out, "studio/.htaccess"), "utf8")).toContain("https://www.youtube.com");
    expect(existsSync(join(out, "assets/demo/Videos.txt"))).toBe(true);
    expect(existsSync(join(out, "assets/app/index-abc.js"))).toBe(true);
    expect(existsSync(join(out, "assets/api"))).toBe(true);
    for (const file of ["assets/api/Games.txt", "assets/api/Videos.txt", "assets/api/.gitkeep", "assets/thumbnails/abcdefghijk.webp", ".DS_Store"]) {
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
