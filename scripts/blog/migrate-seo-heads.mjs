#!/usr/bin/env node
/**
 * One-shot migration: retro-fit SEO head (canonical, OG, Twitter, JSON-LD,
 * favicon, theme-color) onto every existing blog/*.html file.
 *
 * Idempotent: skips files that already have a canonical link tag.
 *
 * Run once:
 *   node scripts/blog/migrate-seo-heads.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.resolve(__dirname, "..", "..", "blog");

const esc = (s) =>
  String(s || "")
    .replace(/&(?!(?:amp|lt|gt|quot|#\d+);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function pickFirst(re, html, group = 1) {
  const m = html.match(re);
  return m ? m[group].trim() : null;
}

function migrateOne(file) {
  const full = path.join(BLOG_DIR, file);
  let html = fs.readFileSync(full, "utf8");

  if (html.includes('rel="canonical"')) return { file, status: "skipped (already migrated)" };

  const slug = file.replace(/\.html$/, "");
  const canonical = `https://journeywell.io/blog/${slug}.html`;

  const rawTitle = pickFirst(/<title>([\s\S]*?)<\/title>/i, html);
  const titleSansSuffix = (rawTitle || "").replace(/\s*[—–-]\s*JourneyWell\s*$/i, "").trim();

  const description = pickFirst(
    /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i,
    html
  ) || "";

  const cover =
    pickFirst(/<div class="lite-post-cover">\s*<img\s+src=["']([^"']+)["']/i, html) ||
    "https://journeywell.io/images/jw-logo.png";

  const category =
    pickFirst(
      /class="lite-post-meta">[\s\S]*?<span[^>]*color:var\(--accent-deep\)[^>]*>([\s\S]*?)<\/span>/i,
      html
    ) || "Blog";

  const author = pickFirst(/<span>([^<]+?)\s*·\s*[A-Z][a-z]{2}\s+\d/i, html) || "Tim Simmons";

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: titleSansSuffix,
    description: description,
    image: cover,
    author: { "@type": "Person", name: author.trim() },
    publisher: {
      "@type": "Organization",
      name: "JourneyWell",
      logo: { "@type": "ImageObject", url: "https://journeywell.io/images/jw-logo.png" },
    },
    mainEntityOfPage: canonical,
    articleSection: category.trim(),
  };

  const injection = `
<link rel="canonical" href="${canonical}" />
<meta name="theme-color" content="#CFF42A" />

<link rel="icon" type="image/png" href="/images/jw-logo.png" />
<link rel="apple-touch-icon" href="/images/jw-logo.png" />

<meta property="og:type" content="article" />
<meta property="og:site_name" content="JourneyWell" />
<meta property="og:title" content="${esc(titleSansSuffix)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${esc(cover)}" />
<meta property="article:section" content="${esc(category.trim())}" />
<meta property="article:author" content="${esc(author.trim())}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(titleSansSuffix)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(cover)}" />

<script type="application/ld+json">
${JSON.stringify(articleSchema)}
</script>
`;

  // Insert before </head>
  if (!html.includes("</head>")) {
    return { file, status: "ERROR: no </head> found" };
  }
  html = html.replace("</head>", `${injection}</head>`);
  fs.writeFileSync(full, html);
  return { file, status: "migrated", canonical };
}

const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".html"));
const results = files.map(migrateOne);
for (const r of results) {
  console.log(`${r.status.padEnd(12)} ${r.file}`);
}
console.log(`\n${results.filter((r) => r.status === "migrated").length}/${files.length} migrated`);
