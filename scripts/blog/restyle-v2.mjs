#!/usr/bin/env node
/**
 * v2 restyle: re-render every existing blog/*.html post inside the v2
 * article shell (blog/_template.html), preserving each post's SEO head
 * (canonical, OG, Twitter, JSON-LD, icons) byte-for-byte, and rebuild the
 * blog.html index (featured + contents rows) between the BLOG-INDEX markers.
 *
 * Idempotent: posts already carrying the <!-- jw-v2-article --> marker are
 * skipped for conversion; the index is always rebuilt from all posts.
 *
 * Run:
 *   node scripts/blog/restyle-v2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BLOG_DIR = path.join(REPO_ROOT, "blog");
const MARKER = "<!-- jw-v2-article -->";
const TEMPLATE = fs.readFileSync(path.join(BLOG_DIR, "_template.html"), "utf8");

// bts fallback cover (relative to blog/ depth) for posts without a real og:image
const BTS_FALLBACK = "../images/bts/06-studio-mic.jpg";

const esc = (s) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const stripTags = (html) => String(html || "").replace(/<[^>]*>/g, "");
const unescAmp = (s) => String(s || "").replace(/&amp;/g, "&");
// decode basic entities so extracted (already-escaped) source text is not double-escaped on render
const decode = (s) =>
  String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function pick(re, html, group = 1) {
  const m = html.match(re);
  return m ? m[group].trim() : null;
}
function pickAll(re, html) {
  return [...html.matchAll(re)].map((m) => m[0]);
}

function fill(tpl, map) {
  let out = tpl;
  for (const [k, v] of Object.entries(map)) out = out.split(`{{${k}}}`).join(v ?? "");
  return out;
}

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Parse a post file (works on both the legacy lite/blog-prose formats and the
// already-converted v2 format, so the index rebuild stays idempotent).
// ---------------------------------------------------------------------------
function parsePost(file) {
  const full = path.join(BLOG_DIR, file);
  const html = fs.readFileSync(full, "utf8");
  const slug = file.replace(/\.html$/, "");
  const converted = html.includes(MARKER);

  // --- SEO head bits (preserved exactly) ---
  const titleTag = pick(/<title>([\s\S]*?)<\/title>/i, html) || slug;
  const description =
    pick(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i, html) || "";
  const seoParts = [
    ...pickAll(/<link rel="canonical"[^>]*\/?>/g, html),
    ...pickAll(/<meta name="theme-color"[^>]*\/?>/g, html),
    ...pickAll(/<link rel="icon"[^>]*\/?>/g, html),
    ...pickAll(/<link rel="apple-touch-icon"[^>]*\/?>/g, html),
    ...pickAll(/<meta property="og:[^"]*"[^>]*\/?>/g, html),
    ...pickAll(/<meta property="article:[^"]*"[^>]*\/?>/g, html),
    ...pickAll(/<meta name="twitter:[^"]*"[^>]*\/?>/g, html),
    ...pickAll(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, html),
  ];
  const seoHead = seoParts.join("\n");

  // --- display data ---
  const ogImage = unescAmp(pick(/<meta property="og:image" content="([^"]*)"/i, html) || "");
  const author =
    pick(/<meta property="article:author" content="([^"]*)"/i, html) || "Tim Simmons";
  const category =
    pick(/color:var\(--accent-deep\)[^>]*>([\s\S]*?)<\/span>/i, html) || // legacy lite meta
    pick(/<span class="chip">([\s\S]*?)<\/span>/i, html) || // converted v2 header
    pick(/<div class="blog-meta"[^>]*>([\s\S]*?)<\/div>/i, html) || // legacy blog-prose hero
    pick(/<meta property="article:section" content="([^"]*)"/i, html) ||
    "Notes";
  const readMin = pick(/(\d+)\s*min read/i, html) || "6";
  const dateISO = pick(/"datePublished":"([^"]+)"/, html);
  const dateHumanRaw = pick(/([A-Za-z]{3,9} \d{1,2}, \d{4})/, html.slice(html.indexOf("<body")));
  const date = dateISO ? new Date(dateISO) : dateHumanRaw ? new Date(dateHumanRaw) : new Date(0);
  const dateHuman = dateHumanRaw || fmtDate(date);

  const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html) || esc(stripTags(titleTag));
  const lead =
    pick(/<p class="(?:lead|blog-post-lede|post-dek)[^"]*">([\s\S]*?)<\/p>/i, html) || description;

  // display cover: post's own cover img, else its og:image, else bts photo
  let cover =
    pick(/class="(?:lite-post-cover|pc-in)[^"]*">\s*(?:<div[^>]*>\s*)?<img\s+src="([^"]+)"/i, html) ||
    ogImage;
  if (!cover || /jw-logo\.png/.test(cover)) cover = BTS_FALLBACK;

  // --- body (only needed for legacy files being converted) ---
  let body = null;
  if (!converted) {
    const containers = [
      ['<div class="lite-post-body">', "</section>"], // lite posts: body div is last child before </section>
      ['<article class="blog-prose">', "</article>"], // long-form editorial post
    ];
    for (const [opener, closer] of containers) {
      const at = html.indexOf(opener);
      if (at === -1) continue;
      const from = at + opener.length;
      const close = html.indexOf(closer, from);
      if (close === -1) continue;
      body = html.slice(from, close).replace(/(<\/div>\s*)+$/, "");
      break;
    }
    if (body) {
      // strip legacy in-prose promo widgets (blog.css-dependent)
      body = body.replace(/<button[^>]*jw-promo[\s\S]*?<\/button>/g, "").trim();
    }
  }

  return {
    file, slug, converted, html,
    titleTag, description, seoHead,
    ogImage, author, readMin,
    date, dateHuman, h1, cover, body,
    // decoded plain-text variants (safe to re-escape at render time)
    category: decode(stripTags(category)),
    lead: decode(stripTags(lead)),
    titleText: decode(stripTags(h1)),
  };
}

// ---------------------------------------------------------------------------
// Render helpers (index cards + related cards)
// ---------------------------------------------------------------------------
// hrefPrefix: "blog/" from the root index, "" from within blog/
function coverSrc(p, fromRoot) {
  const cover = unescAmp(p.cover);
  // bts fallback is stored ../-relative (blog depth); re-base for the root index
  if (cover.startsWith("../")) return fromRoot ? cover.slice(3) : cover;
  return cover;
}

function trunc(s, n) {
  return s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s;
}

function renderFeatured(p) {
  return `    <a class="feat reveal" href="blog/${p.slug}.html">
      <div class="feat-img"><img src="${esc(coverSrc(p, true))}" alt="${esc(p.titleText)}"/></div>
      <div class="feat-body">
        <div class="feat-meta"><span class="chip">${esc(p.category)}</span><span class="fm">Latest · ${p.dateHuman}</span></div>
        <h2 class="feat-title">${p.h1}</h2>
        <p class="feat-dek">${esc(trunc(p.lead, 220))}</p>
        <span class="feat-more">Read the note <span class="a">→</span></span>
      </div>
    </a>`;
}

function renderRow(p) {
  return `      <a class="ix-row reveal" href="blog/${p.slug}.html">
        <div class="ix-thumb"><img src="${esc(coverSrc(p, true))}" alt="${esc(p.titleText)}" loading="lazy"/></div>
        <div class="ix-main">
          <div class="ix-title">${p.h1}</div>
          <p class="ix-dek">${esc(trunc(p.lead, 200))}</p>
        </div>
        <div class="ix-side"><span class="chip">${esc(p.category)}</span><span class="ix-date">${p.dateHuman} · ${p.readMin} min read</span></div>
      </a>`;
}

function renderRelatedCard(p) {
  return `    <a class="rel-card reveal" href="${p.slug}.html">
      <div class="rc-thumb"><img src="${esc(coverSrc(p, false))}" alt="${esc(p.titleText)}" loading="lazy"/></div>
      <div class="rc-body">
        <span class="chip sm">${esc(p.category)}</span>
        <div class="rc-title">${p.h1}</div>
        <div class="rc-date">${p.dateHuman} · ${p.readMin} min read</div>
      </div>
    </a>`;
}

function pickRelated(post, all) {
  const others = all.filter((p) => p.slug !== post.slug);
  const same = others.filter((p) => p.category === post.category);
  const rest = others.filter((p) => p.category !== post.category);
  return [...same, ...rest].slice(0, 3);
}

// ---------------------------------------------------------------------------
// Convert one post
// ---------------------------------------------------------------------------
function convert(post, all) {
  if (post.converted) return "skipped (already v2)";
  if (!post.body) return "ERROR: body not found";
  const related = pickRelated(post, all).map(renderRelatedCard).join("\n");
  const out = fill(TEMPLATE, {
    TITLE_TAG: post.titleTag,
    DESCRIPTION: post.description,
    SEO_HEAD: post.seoHead,
    CATEGORY: esc(post.category),
    DATE_HUMAN: post.dateHuman,
    READ_MIN: post.readMin,
    TITLE_HTML: post.h1,
    LEAD: esc(post.lead),
    AUTHOR: esc(post.author),
    COVER_SRC: esc(unescAmp(post.cover)),
    COVER_ALT: esc(post.titleText),
    BODY: post.body,
    RELATED: related,
  });
  fs.writeFileSync(path.join(BLOG_DIR, post.file), out);
  return "converted";
}

// ---------------------------------------------------------------------------
// Rebuild blog.html index between markers
// ---------------------------------------------------------------------------
function rebuildIndex(posts) {
  const indexPath = path.join(REPO_ROOT, "blog.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const START = "<!-- BLOG-INDEX:START (auto-generated by scripts/blog — do not hand-edit between markers) -->";
  const END = "<!-- BLOG-INDEX:END -->";
  if (!html.includes(START) || !html.includes(END)) {
    throw new Error("BLOG-INDEX markers not found in blog.html");
  }
  const [featured, ...rest] = posts;
  const section = `
${renderFeatured(featured)}

    <div class="ix-label">All notes</div>
    <div class="ix-rows">
${rest.map(renderRow).join("\n")}
    </div>`;
  const before = html.slice(0, html.indexOf(START) + START.length);
  const after = html.slice(html.indexOf(END));
  fs.writeFileSync(indexPath, `${before}${section}\n${after}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".html") && f !== "_template.html");
const posts = files.map(parsePost).sort((a, b) => b.date - a.date || a.slug.localeCompare(b.slug));

let converted = 0;
for (const post of posts) {
  const status = convert(post, posts);
  if (status === "converted") converted++;
  console.log(`${status.padEnd(24)} ${post.file}`);
}
rebuildIndex(posts);
console.log(`\n${converted}/${posts.length} converted · blog.html index rebuilt (${posts.length} posts, featured: ${posts[0].slug})`);
