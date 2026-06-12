# JourneyWell Automated SEO Blog Pipeline (Phase 1)

Generates original SEO/content-marketing posts for the Journal (blog) section and
publishes them to the live site. Built 2026-06-12.

## How it works

```
schedule (n8n or GitHub cron)
        │
        ▼
GitHub Action  .github/workflows/generate-blog.yml
        │
        ▼
node scripts/blog/generate-post.mjs
  1. Reads all posts from Supabase (source of truth)
  2. Picks the category whose latest post is oldest (rotation):
     Wellness Marketing · Social Media · Content & SEO · Video Strategy
  3. Pulls recent RSS headlines (Social Media Examiner, CMI, HubSpot)
     — used ONLY as topic inspiration, never copied
  4. Writes an original 800–1200 word post with an LLM
     (Anthropic claude-opus-4-8 if ANTHROPIC_API_KEY works, else OpenAI gpt-5.5)
     in the first-person JourneyWell studio voice, with title/meta/h2 SEO
     structure and natural internal links to solutions/work/get-started/etc.
  5. Quality gate: word count, h2 structure, internal links present,
     meta description length, repetition + boilerplate checks.
     A failing draft is regenerated (up to 3 attempts) with the rejection
     reasons fed back to the model.
  6. Fetches a cover image (Pexels if PEXELS_API_KEY is set, else Unsplash
     via UNSPLASH_ACCESS) — hotlinked from their CDN, not re-hosted.
  7. Inserts the post into Supabase table `blog_posts`
  8. Renders static `blog/<slug>.html` using the existing lite-post template
     (identical markup/classes to the original 4 hand-written posts)
  9. Rebuilds the featured card + latest grid in `blog.html` from Supabase
     (newest post = featured, next 6 = grid) between the
     `<!-- BLOG-INDEX:START -->` / `<!-- BLOG-INDEX:END -->` markers
        │
        ▼
Action commits + pushes to main → Vercel auto-deploys (~20s)
→ live at https://jw-site-restyle.vercel.app/blog.html
```

## Source of truth: Supabase

- Project: **mediavault** (`pmugvctdtxrssbdzcgwt`), table **`public.blog_posts`**
- Columns: `id, slug, title, meta_description, category, body_html,
  cover_image_url, author, status (draft|published), read_time, created_at, published_at`
- RLS enabled; anon role can read `status='published'` rows only.
- The 4 original hand-written posts are seeded as rows (without `body_html`)
  so the index rebuild includes them. **Their HTML files are never touched.**

## Run manually (local)

```bash
node scripts/blog/generate-post.mjs            # generate + write files (no git)
node scripts/blog/generate-post.mjs --push     # …and commit + push to main
node scripts/blog/generate-post.mjs --dry-run  # print the generated JSON only
node scripts/blog/generate-post.mjs --category video-content-strategy
```

No npm install needed (Node 18+, zero dependencies). When env vars are missing
locally, the script auto-loads them from `~/jw-vault/credentials-master.env`
(or `~/Downloads/Development/tim-master/credentials-master.env`).

## Run manually (cloud)

GitHub → Actions → "Generate blog post" → Run workflow. Or via API:

```bash
gh workflow run generate-blog.yml -R Tim-s-Dev/jw-site-restyle
```

## Credentials

| Var | Where it lives | Notes |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | `~/jw-vault/credentials-master.env` + GitHub Actions secrets | mediavault project |
| `OPENAI_API_KEY` | same | currently the active writer (gpt-5.5) |
| `ANTHROPIC_API_KEY` | same | **out of credits as of 2026-06-12** — script tries it first and falls back to OpenAI automatically; top up credits and it switches back with no code change |
| `UNSPLASH_ACCESS` | same | cover image search (active path) |
| `PEXELS_API_KEY` | not provisioned yet | if added as a secret, Pexels is preferred automatically |

Secrets are set on the repo with `gh secret set NAME -R Tim-s-Dev/jw-site-restyle`.
**Nothing secret is committed to this (public) repo.**

## Scheduling

Two layers:

1. **GitHub cron (active now):** the workflow has
   `schedule: cron "0 14 * * 1,3,5"` → Mon/Wed/Fri 9:00 AM Central.
   This works with zero external dependencies.

2. **n8n (optional, preferred control plane):** self-hosted at
   https://n8n.journeywellhub.com. No n8n API key was available at build time,
   so wire it manually:

   1. Log in to https://n8n.journeywellhub.com (creds: `N8N_OWNER_EMAIL` / `N8N_OWNER_PASSWORD`).
   2. New workflow → add **Schedule Trigger** node → Cron → `0 9 * * 1,3,5`
      (server is US Central; adjust if the instance runs UTC: `0 14 * * 1,3,5`).
   3. Add **HTTP Request** node:
      - Method: `POST`
      - URL: `https://api.github.com/repos/Tim-s-Dev/jw-site-restyle/actions/workflows/generate-blog.yml/dispatches`
      - Headers: `Authorization: Bearer <GitHub PAT with repo+workflow scope>`,
        `Accept: application/vnd.github+json`
      - Body (JSON): `{"ref": "main"}`
   4. Activate the workflow, then **remove the `schedule:` block** from
      `.github/workflows/generate-blog.yml` so posts aren't generated twice.

   Create the GitHub PAT as the `agency-droid` account (Settings → Developer
   settings → Fine-grained token → repo `Tim-s-Dev/jw-site-restyle` →
   Actions: Read and write).

## Editing / extending

- Categories, RSS feeds, voice/SEO prompt: all at the top of `generate-post.mjs`.
- The blog.html index is regenerated from Supabase on every run — edit the
  card templates in `renderIndexSection()`, not blog.html itself (anything
  between the BLOG-INDEX markers gets overwritten).
- To unpublish a post: set `status='draft'` in Supabase and delete the
  static file; the next run removes it from the index automatically.
