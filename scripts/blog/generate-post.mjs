#!/usr/bin/env node
/**
 * JourneyWell automated SEO blog generator — Phase 1
 *
 * Pipeline: pick category → pull RSS headlines for inspiration → write an
 * original post with an LLM → fetch a cover image → insert into Supabase
 * (source of truth) → render static blog/<slug>.html → rebuild blog.html
 * index → (optionally) commit + push.
 *
 * Zero npm dependencies — Node 18+ (uses global fetch).
 *
 * Env (see scripts/blog/README.md for where these live):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   — required
 *   ANTHROPIC_API_KEY and/or OPENAI_API_KEY   — at least one required
 *   PEXELS_API_KEY or UNSPLASH_ACCESS         — one required for cover images
 *
 * Usage:
 *   node scripts/blog/generate-post.mjs [--push] [--category "social media marketing"] [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildSitemap } from "../build-sitemap.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ARGS = process.argv.slice(2);
const flag = (name) => ARGS.includes(name);
const opt = (name) => {
  const i = ARGS.indexOf(name);
  return i >= 0 ? ARGS[i + 1] : undefined;
};

// ---------------------------------------------------------------------------
// Env loading — local convenience: pull missing keys from the creds vault.
// Never used in CI (GitHub Actions injects env via secrets).
// ---------------------------------------------------------------------------
function loadLocalEnv() {
  const candidates = [
    path.join(os.homedir(), "jw-vault", "credentials-master.env"),
    path.join(os.homedir(), "Downloads", "Development", "tim-master", "credentials-master.env"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}
if (!process.env.SUPABASE_URL || !(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)) {
  loadLocalEnv();
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Content categories (rotated) + RSS feeds used purely as topic inspiration
// ---------------------------------------------------------------------------
const CATEGORIES = [
  {
    key: "health-wellness-marketing",
    label: "Wellness Marketing",
    brief:
      "Marketing for health & wellness brands — practitioners, gyms, med spas, wellness founders. How they build trust and authority with content (podcasts, video, social).",
    imageQuery: "wellness studio natural light",
  },
  {
    key: "social-media-marketing",
    label: "Social Media",
    brief:
      "Practical social media marketing for founders and small brands — short-form video, IG/LinkedIn strategy, repurposing, hooks, posting systems that survive busy weeks.",
    imageQuery: "creator filming short form video phone",
  },
  {
    key: "content-marketing-seo",
    label: "Content & SEO",
    brief:
      "Content marketing and SEO for founder-led brands — pillar content, search intent, turning podcast/video transcripts into ranking articles, topical authority.",
    imageQuery: "writing content laptop notebook desk",
  },
  {
    key: "video-content-strategy",
    label: "Video Strategy",
    brief:
      "Video content strategy — long-form to short-form pipelines, podcast video, YouTube for founders, production quality vs. consistency tradeoffs, studio workflows.",
    imageQuery: "video production studio camera lighting",
  },
];

const RSS_FEEDS = [
  "https://www.socialmediaexaminer.com/feed/",
  "https://contentmarketinginstitute.com/feed/",
  "https://blog.hubspot.com/marketing/rss.xml",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const stripTags = (html) => String(html || "").replace(/<[^>]*>/g, "");
const esc = (s) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wordCount(html) {
  return stripTags(html).trim().split(/\s+/).filter(Boolean).length;
}

function slugify(s) {
  return stripTags(s)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 7)
    .join("-");
}

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function sb(pathAndQuery, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// 1. Category rotation — pick the category whose latest post is oldest
// ---------------------------------------------------------------------------
function pickCategory(posts) {
  const forced = opt("--category");
  if (forced) {
    const c = CATEGORIES.find(
      (c) => c.key === forced || c.label.toLowerCase() === forced.toLowerCase()
    );
    if (c) return c;
  }
  let best = null;
  let bestTime = Infinity;
  for (const c of CATEGORIES) {
    const latest = posts
      .filter((p) => p.category === c.label)
      .map((p) => new Date(p.published_at || p.created_at).getTime())
      .sort((a, b) => b - a)[0];
    const t = latest ?? 0; // never used → highest priority
    if (t < bestTime) {
      bestTime = t;
      best = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 2. RSS inspiration (headlines only — never copied)
// ---------------------------------------------------------------------------
async function fetchHeadlines() {
  const headlines = [];
  for (const url of RSS_FEEDS) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0 (jw-blog-pipeline)" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = [...xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)];
      headlines.push(...items.slice(0, 6).map((m) => m[1].trim()));
    } catch {
      /* inspiration is optional */
    }
  }
  return headlines.slice(0, 15);
}

// ---------------------------------------------------------------------------
// 3. LLM call — Anthropic first if key present, fall back to OpenAI
// ---------------------------------------------------------------------------
async function callAnthropic(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

async function callOpenAI(system, user) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      response_format: { type: "json_object" },
      max_completion_tokens: 9000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.choices[0].message.content;
}

async function generateWithLLM(system, user) {
  const providers = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push(["anthropic", callAnthropic]);
  if (process.env.OPENAI_API_KEY) providers.push(["openai", callOpenAI]);
  if (!providers.length) throw new Error("No LLM key found (ANTHROPIC_API_KEY / OPENAI_API_KEY)");
  let lastErr;
  for (const [name, fn] of providers) {
    try {
      console.log(`→ generating with ${name}…`);
      return await fn(system, user);
    } catch (e) {
      console.warn(`  ${name} failed: ${e.message.slice(0, 200)}`);
      lastErr = e;
    }
  }
  throw lastErr;
}

function parseJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ---------------------------------------------------------------------------
// 4. The prompt
// ---------------------------------------------------------------------------
function buildPrompt(category, existingTitles, headlines) {
  const system = `You are the in-house writer for JourneyWell, a content studio in Baton Rouge, Louisiana that produces podcasts, films, and short-form content for founders and brands. You write for the studio's Blogs section.

VOICE — this is non-negotiable:
- First-person studio voice ("we", "our clients", "what we've watched work"). Practical, confident, a little contrarian. Short paragraphs. No fluff, no listicle filler, no "in today's digital landscape" boilerplate.
- Write like someone who has actually produced 200+ episodes and runs content systems for real clients — concrete numbers, real tradeoffs, opinionated takes.
- Reference points you can draw on: the JourneyWell Authority System (one recording → 30+ pieces), weekly cadence with a two-week buffer, one studio day a month, founder-led brands, Baton Rouge / Louisiana businesses.

SEO RULES:
- One clear search-intent topic per post. Title ≤ 65 chars, compelling, not clickbait.
- meta_description 140–160 chars, includes the core phrase naturally.
- Use h2 sections (3–5) with keyword-bearing but human headings; h3 sparingly.
- Work the primary phrase into the first 100 words naturally.
- 800–1200 words of body.
- Include 2–3 internal links where they fit NATURALLY (never forced), choosing from: <a href="../solutions.html">, <a href="../work.html">, <a href="../get-started.html">, <a href="../studio.html">, <a href="../podcast.html">. Anchor text must be descriptive, not "click here".

OUTPUT — strict JSON object, nothing else:
{
  "title": "Plain title, may wrap ONE word in <em>…</em> for emphasis",
  "slug": "kebab-case-3-6-words",
  "meta_description": "…",
  "lead": "2–3 sentence standfirst in the studio voice (no HTML)",
  "body_html": "<p>…</p><h2>…</h2>… using only p, h2, h3, ul, ol, li, strong, em, blockquote, a tags. NO h1, NO images, NO scripts.",
  "image_query": "2–4 word stock photo search phrase that visually matches the post",
  "read_time": 5,
  "tags": ["…","…"]
}`;

  const user = `Write one original post for the Blogs section in the category: ${category.label}.
Category focus: ${category.brief}

Posts already on the site (do NOT repeat these topics or angles):
${existingTitles.map((t) => `- ${stripTags(t)}`).join("\n")}

${headlines.length ? `Recent industry headlines — for TOPIC INSPIRATION ONLY. Do not copy, summarize, or reference any of them. Pick a fresh angle a studio operator would actually have an opinion about:\n${headlines.map((h) => `- ${h}`).join("\n")}` : ""}

Choose ONE specific, search-worthy topic in this category and write the post. Make it something a founder or marketing lead would search for, and answer it better and more honestly than the generic results.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// 5. Quality gate
// ---------------------------------------------------------------------------
const SITE_PAGES = ["solutions", "work", "get-started", "studio", "podcast", "about", "portfolio", "authority"];

// Normalize internal links to ../<page>.html regardless of how the model wrote them
function normalizeLinks(html) {
  let out = String(html || "");
  for (const page of SITE_PAGES) {
    out = out.replace(
      new RegExp(`href=['"](?:https?://[^'"]*?)?/?(?:\\.\\./)?${page}\\.html['"]`, "g"),
      `href="../${page}.html"`
    );
  }
  return out;
}

function validatePost(post, existingSlugs) {
  post.body_html = normalizeLinks(post.body_html);
  const problems = [];
  const wc = wordCount(post.body_html);
  if (wc < 700 || wc > 1500) problems.push(`word count ${wc} outside 700–1500`);
  if (!post.title || stripTags(post.title).length > 80) problems.push("bad title");
  if (!post.meta_description || post.meta_description.length < 100 || post.meta_description.length > 180)
    problems.push("meta_description length off");
  if (!/<h2[\s>]/.test(post.body_html)) problems.push("no h2 sections");
  if (!/href="\.\.\//.test(post.body_html)) problems.push("no internal links");
  if (/<(script|img|h1)[\s>]/i.test(post.body_html)) problems.push("forbidden tags");
  if (/in today'?s (digital|fast-paced)/i.test(post.body_html)) problems.push("boilerplate phrasing");
  // crude repetition check: any 6-word shingle appearing 3+ times
  const words = stripTags(post.body_html).toLowerCase().split(/\s+/);
  const seen = new Map();
  for (let i = 0; i + 6 <= words.length; i++) {
    const sh = words.slice(i, i + 6).join(" ");
    seen.set(sh, (seen.get(sh) || 0) + 1);
  }
  if ([...seen.values()].some((n) => n >= 3)) problems.push("repetitive phrasing");
  if (existingSlugs.has(post.slug)) post.slug = `${post.slug}-${Date.now().toString(36).slice(-4)}`;
  return problems;
}

// ---------------------------------------------------------------------------
// 6. Cover image — Pexels if key present, else Unsplash
// ---------------------------------------------------------------------------
async function getCoverImage(query, fallbackQuery) {
  const tryQueries = [query, fallbackQuery, "creative studio workspace"].filter(Boolean);
  for (const q of tryQueries) {
    try {
      if (process.env.PEXELS_API_KEY) {
        const res = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=8&orientation=landscape`,
          { headers: { Authorization: process.env.PEXELS_API_KEY }, signal: AbortSignal.timeout(10000) }
        );
        const data = await res.json();
        if (data.photos?.length) {
          const p = data.photos[Math.floor(Math.random() * Math.min(5, data.photos.length))];
          return `${p.src.landscape.split("?")[0]}?auto=compress&cs=tinysrgb&w=1600`;
        }
      }
      const ukey = process.env.UNSPLASH_ACCESS || process.env.UNSPLASH_ACCESS_KEY;
      if (ukey) {
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=8&orientation=landscape&content_filter=high&client_id=${ukey}`,
          { signal: AbortSignal.timeout(10000) }
        );
        const data = await res.json();
        if (data.results?.length) {
          const p = data.results[Math.floor(Math.random() * Math.min(5, data.results.length))];
          return `${p.urls.raw}&w=1600&q=75&auto=format&fit=crop`;
        }
      }
    } catch (e) {
      console.warn(`  image search "${q}" failed: ${e.message}`);
    }
  }
  // last resort: a known-good generic studio image already used on the site style
  return "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1600&q=75&auto=format&fit=crop";
}

// ---------------------------------------------------------------------------
// 7. Static post renderer — fills the v2 article shell (blog/_template.html)
// ---------------------------------------------------------------------------
function fillTemplate(tpl, map) {
  let out = tpl;
  for (const [k, v] of Object.entries(map)) out = out.split(`{{${k}}}`).join(v ?? "");
  return out;
}

function renderRelatedCard(p) {
  const d = p.published_at ? new Date(p.published_at) : new Date();
  return `    <a class="rel-card reveal" href="${p.slug}.html">
      <div class="rc-thumb"><img src="${esc(p.cover_image_url)}" alt="${esc(stripTags(p.title))}" loading="lazy"/></div>
      <div class="rc-body">
        <span class="chip sm">${esc(p.category)}</span>
        <div class="rc-title">${p.title}</div>
        <div class="rc-date">${fmtDate(d)} · ${p.read_time} min read</div>
      </div>
    </a>`;
}

function renderPostHTML(post, dateStr, related = []) {
  const template = fs.readFileSync(path.join(REPO_ROOT, "blog", "_template.html"), "utf8");
  const plainTitle = stripTags(post.title);
  const canonical = `https://journeywell.io/blog/${post.slug}.html`;
  const ogDesc = esc(post.meta_description);
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: plainTitle,
    description: post.meta_description,
    image: post.cover_image_url,
    author: { "@type": "Person", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "JourneyWell",
      logo: { "@type": "ImageObject", url: "https://journeywell.io/images/jw-logo.png" },
    },
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    mainEntityOfPage: canonical,
    articleSection: post.category,
  };
  const seoHead = `<link rel="canonical" href="${canonical}" />
<meta name="theme-color" content="#CFF42A" />
<link rel="icon" type="image/png" href="/images/jw-logo.png" />
<link rel="apple-touch-icon" href="/images/jw-logo.png" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="JourneyWell" />
<meta property="og:title" content="${esc(plainTitle)}" />
<meta property="og:description" content="${ogDesc}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${esc(post.cover_image_url)}" />
<meta property="article:section" content="${esc(post.category)}" />
<meta property="article:author" content="${esc(post.author)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(plainTitle)}" />
<meta name="twitter:description" content="${ogDesc}" />
<meta name="twitter:image" content="${esc(post.cover_image_url)}" />
<script type="application/ld+json">
${JSON.stringify(articleSchema)}
</script>`;
  return fillTemplate(template, {
    TITLE_TAG: `${esc(plainTitle)} · JourneyWell`,
    DESCRIPTION: esc(post.meta_description),
    SEO_HEAD: seoHead,
    CATEGORY: esc(post.category),
    DATE_HUMAN: dateStr,
    READ_MIN: String(post.read_time),
    TITLE_HTML: post.title,
    LEAD: esc(post.lead),
    AUTHOR: esc(post.author),
    COVER_SRC: esc(post.cover_image_url),
    COVER_ALT: esc(plainTitle),
    BODY: post.body_html,
    RELATED: related.slice(0, 3).map(renderRelatedCard).join("\n"),
  });
}

// ---------------------------------------------------------------------------
// 8. blog.html index rebuild — replaces content between BLOG-INDEX markers
// ---------------------------------------------------------------------------
function renderIndexSection(posts) {
  const [featured, ...rest] = posts;
  const fDate = featured.published_at ? new Date(featured.published_at) : new Date();
  const featuredHTML = `    <a class="feat reveal" href="blog/${featured.slug}.html">
      <div class="feat-img"><img src="${esc(featured.cover_image_url)}" alt="${esc(stripTags(featured.title))}"/></div>
      <div class="feat-body">
        <div class="feat-meta"><span class="chip">${esc(featured.category)}</span><span class="fm">Latest · ${fmtDate(fDate)}</span></div>
        <h2 class="feat-title">${featured.title}</h2>
        <p class="feat-dek">${esc(featured.meta_description)}</p>
        <span class="feat-more">Read the note <span class="a">→</span></span>
      </div>
    </a>`;

  const rows = rest
    .map((p) => {
      const d = p.published_at ? new Date(p.published_at) : new Date();
      return `      <a class="ix-row reveal" href="blog/${p.slug}.html">
        <div class="ix-thumb"><img src="${esc(p.cover_image_url)}" alt="${esc(stripTags(p.title))}" loading="lazy"/></div>
        <div class="ix-main">
          <div class="ix-title">${p.title}</div>
          <p class="ix-dek">${esc(p.meta_description)}</p>
        </div>
        <div class="ix-side"><span class="chip">${esc(p.category)}</span><span class="ix-date">${fmtDate(d)} · ${p.read_time} min read</span></div>
      </a>`;
    })
    .join("\n");

  return `
${featuredHTML}

    <div class="ix-label">All notes</div>
    <div class="ix-rows">
${rows}
    </div>`;
}

function updateBlogIndex(posts) {
  const indexPath = path.join(REPO_ROOT, "blog.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const START = "<!-- BLOG-INDEX:START (auto-generated by scripts/blog — do not hand-edit between markers) -->";
  const END = "<!-- BLOG-INDEX:END -->";
  const section = renderIndexSection(posts);
  if (html.includes(START) && html.includes(END)) {
    const before = html.slice(0, html.indexOf(START) + START.length);
    const after = html.slice(html.indexOf(END));
    html = `${before}\n${section}\n    ${after}`;
  } else {
    throw new Error("BLOG-INDEX markers not found in blog.html — refusing to rewrite blindly");
  }
  fs.writeFileSync(indexPath, html);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("JourneyWell blog generator");

  const posts = await sb("blog_posts?select=slug,title,category,meta_description,cover_image_url,read_time,published_at,created_at,status&order=published_at.desc");
  const published = posts.filter((p) => p.status === "published");
  const existingSlugs = new Set(posts.map((p) => p.slug));
  const category = pickCategory(published);
  console.log(`→ category: ${category.label}`);

  const headlines = await fetchHeadlines();
  console.log(`→ ${headlines.length} RSS headlines pulled for inspiration`);

  const { system, user } = buildPrompt(category, published.map((p) => p.title), headlines);

  let post;
  let attempt = 0;
  while (attempt < 3) {
    attempt++;
    const raw = await generateWithLLM(
      system,
      attempt === 1 ? user : `${user}\n\nIMPORTANT: your previous draft was rejected (${post?._problems?.join("; ")}). Write a fresh, tighter draft fixing those issues.`
    );
    try {
      post = parseJSON(raw);
    } catch {
      console.warn("  could not parse JSON, retrying");
      post = { _problems: ["invalid JSON"] };
      continue;
    }
    post.slug = slugify(post.slug || post.title);
    post.category = category.label;
    post.author = "Tim Simmons";
    post.read_time = Math.max(4, Math.min(9, Math.round(wordCount(post.body_html) / 180)));
    const problems = validatePost(post, existingSlugs);
    if (!problems.length) break;
    console.warn(`  draft rejected: ${problems.join("; ")}`);
    post._problems = problems;
    if (attempt === 3) throw new Error(`Could not produce a passing draft: ${problems.join("; ")}`);
  }
  delete post._problems;
  console.log(`→ "${stripTags(post.title)}" (${wordCount(post.body_html)} words, slug: ${post.slug})`);

  post.cover_image_url = await getCoverImage(post.image_query, category.imageQuery);
  console.log(`→ cover: ${post.cover_image_url.slice(0, 80)}…`);

  const now = new Date();
  const dateStr = fmtDate(now);

  if (flag("--dry-run")) {
    console.log(JSON.stringify(post, null, 2));
    return;
  }

  // Insert into Supabase (source of truth)
  await sb("blog_posts", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      slug: post.slug,
      title: post.title,
      meta_description: post.meta_description,
      category: post.category,
      body_html: post.body_html,
      cover_image_url: post.cover_image_url,
      author: post.author,
      status: "published",
      read_time: post.read_time,
      published_at: now.toISOString(),
    }),
  });
  console.log("→ inserted into Supabase");

  // Render static post file (v2 shell + related posts row)
  const related = [
    ...published.filter((p) => p.slug !== post.slug && p.category === post.category),
    ...published.filter((p) => p.slug !== post.slug && p.category !== post.category),
  ].slice(0, 3);
  const postPath = path.join(REPO_ROOT, "blog", `${post.slug}.html`);
  fs.writeFileSync(postPath, renderPostHTML(post, dateStr, related));
  console.log(`→ wrote blog/${post.slug}.html`);

  // Rebuild index from Supabase (all published posts, newest first)
  const all = await sb(
    "blog_posts?select=slug,title,meta_description,category,cover_image_url,author,read_time,published_at&status=eq.published&order=published_at.desc"
  );
  updateBlogIndex(all);
  console.log("→ rebuilt blog.html index");

  const sm = buildSitemap();
  console.log(`→ rebuilt sitemap.xml (${sm.count} urls)`);

  if (flag("--push")) {
    const run = (cmd) => execSync(cmd, { cwd: REPO_ROOT, stdio: "inherit" });
    run(`git config user.name "Tim Simmons"`);
    run(`git config user.email "timsimmons@journeywell.io"`);
    run(`git add blog.html sitemap.xml "blog/${post.slug}.html"`);
    run(`git commit -m "blog: ${stripTags(post.title).replace(/"/g, "'")}"`);
    run(`git push origin main`);
    console.log("→ pushed to main (Vercel will deploy in ~20s)");
  }

  console.log(`\nDone. Live at: https://jw-site-restyle.vercel.app/blog/${post.slug}.html`);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
