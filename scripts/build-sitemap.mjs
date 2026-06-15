#!/usr/bin/env node
/**
 * Build sitemap.xml for journeywell.io.
 *
 * Scans the repo for top-level *.html plus blog/*.html and emits a sitemap
 * with lastmod = file mtime (UTC, YYYY-MM-DD). Run standalone, or invoked at
 * the end of scripts/blog/generate-post.mjs so a fresh blog post auto-appears
 * in the sitemap.
 *
 * Pages that should never be indexed (e.g. a thank-you/redirect-only page)
 * can be added to EXCLUDE below.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SITE = "https://journeywell.io";

const EXCLUDE = new Set([
  // Add filenames here to keep them out of the sitemap, e.g. "thanks.html".
]);

// Priority + changefreq hints. Anything not listed gets the default.
const HINTS = {
  "index.html":      { priority: "1.0", changefreq: "weekly" },
  "solutions.html":  { priority: "0.9", changefreq: "monthly" },
  "studio.html":     { priority: "0.9", changefreq: "monthly" },
  "podcast.html":    { priority: "0.9", changefreq: "monthly" },
  "authority.html":  { priority: "0.9", changefreq: "monthly" },
  "work.html":       { priority: "0.8", changefreq: "weekly" },
  "portfolio.html":  { priority: "0.8", changefreq: "monthly" },
  "blog.html":       { priority: "0.8", changefreq: "daily" },
  "about.html":      { priority: "0.7", changefreq: "monthly" },
  "get-started.html":{ priority: "0.7", changefreq: "monthly" },
};
const DEFAULT_HINT = { priority: "0.6", changefreq: "monthly" };
const BLOG_HINT    = { priority: "0.7", changefreq: "monthly" };

function fmtDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function urlFor(file) {
  // index.html → /, everything else → /<file>
  if (file === "index.html") return `${SITE}/`;
  return `${SITE}/${file.replace(/\\/g, "/")}`;
}

function collect() {
  const entries = [];

  // Top-level *.html
  for (const name of fs.readdirSync(REPO_ROOT)) {
    if (!name.endsWith(".html")) continue;
    if (EXCLUDE.has(name)) continue;
    const full = path.join(REPO_ROOT, name);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;
    const hint = HINTS[name] || DEFAULT_HINT;
    entries.push({ loc: urlFor(name), lastmod: fmtDate(stat.mtimeMs), ...hint });
  }

  // blog/*.html
  const blogDir = path.join(REPO_ROOT, "blog");
  if (fs.existsSync(blogDir)) {
    for (const name of fs.readdirSync(blogDir)) {
      if (!name.endsWith(".html")) continue;
      const rel = `blog/${name}`;
      if (EXCLUDE.has(rel)) continue;
      const full = path.join(blogDir, name);
      const stat = fs.statSync(full);
      entries.push({ loc: urlFor(rel), lastmod: fmtDate(stat.mtimeMs), ...BLOG_HINT });
    }
  }

  // Stable ordering: home first, blog posts at end newest-first, the rest alpha.
  entries.sort((a, b) => {
    const aBlog = a.loc.includes("/blog/");
    const bBlog = b.loc.includes("/blog/");
    if (a.loc === `${SITE}/`) return -1;
    if (b.loc === `${SITE}/`) return 1;
    if (aBlog && !bBlog) return 1;
    if (!aBlog && bBlog) return -1;
    if (aBlog && bBlog) return b.lastmod.localeCompare(a.lastmod);
    return a.loc.localeCompare(b.loc);
  });

  return entries;
}

function render(entries) {
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ];
  for (const e of entries) {
    lines.push(
      `  <url>`,
      `    <loc>${e.loc}</loc>`,
      `    <lastmod>${e.lastmod}</lastmod>`,
      `    <changefreq>${e.changefreq}</changefreq>`,
      `    <priority>${e.priority}</priority>`,
      `  </url>`,
    );
  }
  lines.push(`</urlset>`, ``);
  return lines.join("\n");
}

export function buildSitemap() {
  const entries = collect();
  const xml = render(entries);
  const out = path.join(REPO_ROOT, "sitemap.xml");
  fs.writeFileSync(out, xml);
  return { out, count: entries.length };
}

// CLI: `node scripts/build-sitemap.mjs`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("build-sitemap.mjs")) {
  const { out, count } = buildSitemap();
  console.log(`wrote ${out} (${count} urls)`);
}
