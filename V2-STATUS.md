# JourneyWell www v2 — Taste-Skill Redesign (STATUS)

Branch: `v2-taste-redesign` (isolated; NEVER pushed to origin/main). Prod www.journeywell.io
stays on `main` untouched until Tim approves a cutover.

## Source verified (2026-07-11)
Before building, confirmed local checkout == git origin/main (5257d38) == live www.journeywell.io
byte-for-byte across all 31 tracked HTML/CSS/JS files (`cmp` exact). No stale-clobber risk.

## Direction (Tim's calls)
- Art direction: **Hybrid** — keep JW brand (lime #CFF42A / black #0A0A0A / cream #F6F5F2,
  Inter + Cormorant Garamond italic accents, real studio photography) but elevate craft to
  the taste-skill demo level.
- Motion: **Premium, restrained** — entrance reveals, magnetic CTAs, subtle parallax/hover.
  NO scroll-hijack (conversion/SEO priority).

## Preview (homepage only)
Live: https://lucid-clover-3p2c.here.now/  (self-contained; source in
scratchpad/jw-v2-preview/index.html). Real copy + real photos from images/bts + images/cards.
All homepage sections redesigned: hero, trust marquee, services, stats, how-it-works timeline,
split, recent-work tiles, testimonial, photo grid, founders (cream card), compare, cinematic, CTA.

## NOT yet done (integration work, next)
The preview is a STATIC design proof. To become the real v2 it must be wired into the existing
plumbing (all present in this repo's chrome.js/player.js):
- `data-open-drawer` → formsubmit + GHL lead drawer (preview stubs it with an alert)
- `#heroVideoFrame` live-feed:hero video, `#heroCarousel` live-feed:carousel
- `#liteHomeTiles` → loadCtTag + openVideoOverlay (preview uses 3 static stills)
- chrome.js-injected nav/mega-menu + footer, icon system, compare/testimonial hooks
- inner pages (studio/podcast/authority/work/about/blog) still original

## Next steps
1. Tim reviews preview, approves/adjusts direction.
2. Port design into real index.html preserving every hook; keep chrome.js/player.js.
3. Deploy `v2-taste-redesign` to a SEPARATE Vercel project (jw-site-v2 → preview URL), verify
   headless (hero video, carousel, tiles, drawer, network).
4. Roll system across inner pages.
5. Only then: cutover on Tim's explicit go.

## Iteration 2 — "Signature + bespoke assets" (2026-07-11)
Tim's intensity pick. Applied on the homepage preview (https://lucid-clover-3p2c.here.now):
- HERO SHOWPIECE (gpt-taste GSAP): word-by-word blur-reveal headline, scroll-parallax on a
  bespoke light-field backdrop, pointer-depth on the media, magnetic CTAs. Reduced-motion safe
  (`janim` gate + no-GSAP fallback).
- HIGH-END CRAFT: concentric-radius media shell (outer gradient border + inner inset highlight),
  custom cubic-beziers, film grain.
- BESPOKE GENERATED ASSETS (nanobanana / Nano Banana 2): images/gen/hero-field.jpg (lime
  signal/energy streaks behind hero) + images/gen/cta-glow.jpg (energy bloom behind final CTA).
  Abstract/atmospheric on purpose — no fake studio photos (authenticity for a real studio).
  Optimized to 320KB / 192KB. Rest of page kept restrained.
- Verified in real browser desktop+mobile, 0 console errors.

## Ops note — Gemini image keys (in credentials-master.env)
- GEMINI_API_KEY_1 → 403 "reported as leaked" → SHOULD BE ROTATED/REVOKED.
- GEMINI_API_KEY_2 → 429 rate-limited.
- GEMINI_API_KEY_3 → WORKING (used for both assets). nanobanana reads ~/.nanobanana.env.
- Nano Banana 2 at 2K resolution takes >2min; use 1K for iteration speed.

## Iteration 3 — "Go all out" (2026-07-11)
Tim: removed the AI-generated photos (didn't like them), said go all out / high-end.
Full craft rebuild, REAL photography only. Homepage preview (same URL lucid-clover-3p2c):
- Loader intro (JW wordmark reveal + wipe), Lenis smooth scroll (real users; disabled under
  webdriver + reduced-motion), custom cursor with contextual labels (WATCH/VIEW/PLAY).
- Kinetic hero (line-mask reveal), scrub manifesto reveal, PINNED horizontal work gallery
  (real studio stills pan sideways), count-up stats, sticky "how it works", parallax on photos,
  marquee, magnetic CTAs, concentric glass, film grain, custom easings, breathing CSS-glow CTA.
- Removed images/gen entirely. Reduced-motion + touch fallbacks; mobile nav CTA fixed.
- Verified full scroll-through desktop + mobile, 0 console errors.
Next: same options stand — integrate into chrome.js + deploy preview Vercel, or push a
WebGL/shader hero, or roll to inner pages.

## Iteration 4 — "even more" (2026-07-11)
Added to the homepage preview (same URL lucid-clover-3p2c):
- WebGL interactive hero: the real founder photo becomes a live liquid surface (raw WebGL
  fragment shader) that ripples + chromatic-shifts under the cursor with a lime light bloom.
  Falls back to the static photo if WebGL unavailable. NOTE: texImage2D taints under file://
  (origin null) — works on http/https same-origin (verified http://localhost with ANGLE).
- Animated audio-waveform "signal" band (canvas 2D, lime) — "● Always shipping" — on-brand
  podcast/audio motif between manifesto and services.
- Text-scramble/decode on section headings as they enter viewport.
- All still real photography, reduced-motion + fallbacks intact, 0 console errors.

## Iteration 5 — FULL SITE v2 (2026-07-11) ✅ COMPLETE
All six pages now live on the preview (https://lucid-clover-3p2c.here.now):
- index (homepage, all prior craft incl. WebGL hero + waveform)
- work (channel hero w/ count-up stats, featured piece, FILTERABLE gallery: All/Episodes/Shows/Shorts/BTS)
- studio (phero split, checklist grid, split, FAQ accordion)
- podcast (14-day timeline, launch checklist, offer card, FAQ)
- authority (1→30 multiplication visual, sticky loop, before/after, Smile Spa case stats, FAQ)
- about (founders cream card, scrub manifesto, principles, Baton Rouge split, stats)
Architecture: shared v2.css (30KB) + v2.js (13KB) — guarded initializers (loader/GL/wave/FAQ/
filter no-op when target absent), loader only on index. Favicon on all pages.
VERIFIED: 12/12 sweep (6 pages × desktop+mobile) — 0 console errors, 0 horizontal overflow
(fixed authority .mult min-content blowout + mobile nav CTA overlap). Em-dashes purged.
Registry link unchanged (same slug). NEXT: chrome.js integration + separate Vercel preview
deploy on Tim's go; then cutover decision.

## Iteration 6 — Multi-agent authenticity pass (2026-07-11) ✅
Tim: work page must be a real YouTube/IG feed (not bento); every page too similar; pull from
agency/marketing/branding/tech sites; spawn multi agents. Ran Mobbin MCP research (YouTube
channel, IG profile, Instrument, Vucko, Koto, MOUTHWASH, Büro, basement.studio), then 5
parallel agents rebuilt one page each (page-scoped CSS; v2.css/v2.js untouched):
- work: YouTube channel on desktop (banner/avatar/sticky tabs/Now Showing + Up Next/scroll-snap
  shelves w/ view metadata + 9:16 Shorts shelf) / Instagram profile on mobile (3-stat header,
  highlight-circle filters, tight 3-col pin-badged grid). Filters wired to v2.js .wtab/.wgrid.
- studio: editorial-brutal "THE ROOM." (246px type), grayscale photos color-on-hover, spec-sheet
  rider rows, hour-by-hour timeline, coordinates strip.
- podcast: serif editorial hero + rotated show poster w/ sticker, giant-numeral 14-day sections,
  poster wall, signature inverted full-lime offer band.
- authority: terminal hero, SVG animated 1→30 pipeline diagram, stages as system log,
  before/after as git diff (mono voice).
- about: cream magazine body (only light page), drop-cap letter from Tim & Mel, polaroid,
  archive strip, serif principle index; print-lime #5c680f used on cream for contrast.
Final QA (mine, not agent self-report): 12/12 sweep green (6 pages × d+m), 0 errors,
0 overflow, em-dash grep clean. Published same slug.
