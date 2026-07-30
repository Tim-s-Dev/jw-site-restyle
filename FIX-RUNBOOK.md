# JW Site Fix Runbook — from the 2026-07-29 stress test

Source audit: https://lemon-ponder-kzhy.here.now/ (lead-persona stress test + 10-competitor teardown).
This file is the implementation contract. Work it top to bottom; check items off in place.
Owner: Tim. Executors: Claude agents (Workstream A + B below), merge + deploy by the orchestrating session.

## Ground rules

1. **This repo (`~/Downloads/Development/jw-site-restyle`) is production source.** Verified 7/30: live `chrome.js` and `index.html` MD5-match this checkout. The `platforms` repo copy is dead (folder deleted in its working tree); AUTOMATION_SOP.md's deploy section is stale on that point.
2. **Deploy** (orchestrator only, after merge + QA): `cd ~/Downloads/Development/jw-site-restyle && vercel deploy --prod --yes` (local CLI auth as timsimmons-7869 works; Vercel project `jw-site-restyle`, rootDirectory unset). After EVERY deploy: `curl -s https://journeywell.io/chrome.js | grep -nE "GHL_WEBHOOK_URL\s*="` must return the n8n URL, per AUTOMATION_SOP.md webhook-regression history.
3. **No invented facts.** Reuse numbers/quotes that already exist on the site (Smile Spa case study, portfolio card stats, homepage stats band, the homepage testimonial). NEVER fabricate testimonials, client names, review scores, or prices. Anything needing new facts goes in "Needs Tim" at the bottom.
4. **Brand color rule (Tim, 7/30): lime (#CFF42A) backgrounds ALWAYS carry near-black text (#0a0a0a or var(--ink)). Lime + white text is forbidden, in both themes, everywhere.** Lime TEXT is only allowed on dark backgrounds. If a surface can't satisfy this, restyle the surface (e.g. black button with lime text) rather than bending the rule.
5. **Fix classes, not instances.** Most visual bugs here are one class: hardcoded dark-era colors (`#fff`, `rgba(255,255,255,x)`, `#0a0a0a`) that break when the OTHER theme renders. Replace with theme-aware vars (`--ink`, `--text`, `--surface`, existing `--text-on-cream` family in redesign.css) so both themes derive correctly. A page-level patch that leaves the class alive is not done.
6. **Both themes are first-class.** Default is dark for dark-OS users (chrome.js `applyEarlyTheme`), light otherwise. Every change must be checked in BOTH themes. The QA gate (below) runs both.
7. Don't touch: `GHL_WEBHOOK_URL`, `FORM_ENDPOINT`, `GHL_BOOKING_CALENDAR_ID` values; `vercel.json` rewrites; blog post content; `scripts/build-sitemap.mjs` behavior (re-run it if you add pages).

## QA gate (build once, then it guards everything)

`scripts/qa/theme-contrast-scan.py` — Playwright: loads every page from `http://localhost:8931` in light AND dark (set `localStorage jw-theme` via init script + matching `color_scheme`), scroll-triggers reveals, then flags:
- any element with lime background whose computed text color is near-white (r,g,b all ≥ 225) → HARD FAIL
- any lime text over a light effective background → HARD FAIL
- writes `scripts/qa/scan-results.json`
Adapt from the session's `capture_live.py` (scratchpad site-audit/). Baseline scan of prod 7/30: `scripts/qa/baseline-2026-07-30.json` (committed). Exit non-zero on any hard fail so it can gate deploys. Serve with `python3 -m http.server 8931` from repo root.

---

## Workstream A — conversion + trust (Agent A)

### A1. Nav "Work" → portfolio until the channel page can stand alone
- `chrome.js` line ~33 (`{ href: 'work.html', label: 'Work' }`) and the mega-menu block (~line 82-107): point the top-level Work label + "All shows" at `portfolio.html`. Keep deep links (Episodes/Shorts/BTS) into work.html sections.
- `index.html` hero secondary CTA "Watch the work" → `portfolio.html`.

### A2. Static fallbacks for every creator-tunnel-fed section (the site must degrade to real content, never skeletons)
- Affected: homepage "Recent work / live channel" carousel, homepage "CONTENT THAT moves" reel wall, work.html entire channel surface ("0 PIECES · CHANNEL IS LOADING…"), studio strips ("PODCAST INTERVIEW / SOLO RECORD / BRAND VIDEO", "THE RECORDING SUITE / FOUNDER SESSIONS / EDIT BAY").
- Mechanism: in `chrome.js` fetch wrappers (`resolveCreatorTunnelUrl` call sites ~970, 1132, 1177, 1202, 1430, 1538): on error OR timeout (>4s), render a baked fallback set defined in `content.json` (add a `fallbacks` key) pointing at real local `images/` frames and existing show cards. Kill the blurred-placeholder + beach-photo state entirely. work.html hero: replace "CHANNEL IS LOADING…" + zero-counters with static copy + the portfolio grid fallback when the API hasn't answered.
- Timeout guard: `Promise.race` or AbortController; never leave skeleton UI as the terminal state.

### A3. Footer contact block, every page
- `chrome.js` `footerHtml()` (~line 225): add studio street address (SOURCE: the answer inside studio.html's "Where is the studio?" FAQ — reuse verbatim), `team@journeywell.io`, phone if present anywhere in repo/GHL copy (if not found: "Needs Tim"), Instagram/LinkedIn/Facebook links (already in header), and "Baton Rouge, LA".
- Surface the address on `studio.html` (visible location line near the booking CTA, not only in the FAQ accordion) and `about.html` ("come tour the studio" paragraph gets the address).

### A4. Deploy the proof that already exists
- Move the stats band (200+ episodes / 9.4k+ assets / 15+ founder brands / 4yr) up the homepage, directly under the hero or the trust chips.
- Homepage testimonial (Smile Spa quote): add attribution styling + tie to the Smile Spa case numbers; duplicate onto `authority.html` beside the case study.
- Client text chips → keep chips but fix truncation ("Two Dudes And" must render its full name — check source string and CSS overflow) and link each chip to its portfolio card anchor.
- `podcast.html` work strip: 4 of 5 tiles are Bonvenu — rebalance using existing portfolio clients (Melara, She's Built Different) from content.json.
- Outcome cards: on `index.html` after "Three ways", add 3 compact result cards reusing ONLY existing published numbers (Smile Spa +50K/90d/12%, Bonvenu "5-figure shoot → quarter of weekly content, 20+ clips", She's Built Different "idea → live in 14 days, 7 episodes"). Portfolio.html card copy is the source of truth.

### A5. Booking panel fixes (`chrome.js` step-5 drawer, ~line 650)
- Loading state: skeleton/spinner + "Loading Tim's calendar…" the moment the pane opens; hide when iframe fires `load`; after 10s error fallback: "Calendar's being slow — email team@journeywell.io or go back and use the form."
- Above the iframe, call-agenda copy: "30 minutes. We map your content system, what it costs, and whether we're a fit. No pitch deck."
- Wizard step 3 ("Where can we reach you?"): add optional budget select (Under $1k / $1k–$2.5k / $2.5k–$5k / $5k+ monthly) posted with the payload; n8n webhook passes arbitrary fields.

### A6. Authority page value grid label visibility
- Class fix belongs to Workstream B (B1 covers `.amplify-label`); A verifies the section reads correctly in both themes after merge and adds nothing new here.

### A7. get-started.html resilience
- `<noscript>` block: plain email + socials + "email team@journeywell.io and tell us what you're after."
- Under the wizard options, small persistent line: "Prefer email? team@journeywell.io".
- Fix wordmark contrast on this page (white-on-white — coordinate with B, it may fall out of B1).

## Workstream B — theme + visual system (Agent B)

### B1. Kill the hardcoded-color class
- Sweep `style.css` (dark-era base) for `#fff` / `rgba(255,255,255,…)` / `#0a0a0a` text+bg pairs that redesign.css doesn't override per-theme. Known confirmed bug: `.amplify-label` (style.css ~1188) is `rgba(255,255,255,0.85)` → invisible on light theme. Replace with theme vars; extend redesign.css `[data-theme="light"]` / `[data-theme="dark"]` override blocks where a var doesn't exist yet.
- Definition of done: `scripts/qa/theme-contrast-scan.py` passes clean on all 10 pages, both themes, AND the amplify grid labels legible in both.

### B2. Lime rule enforcement (Tim's explicit 7/30 directive)
- From the scan JSON: every lime-bg element with near-white computed text gets black text (or restyle the element black-bg/lime-text). Audit every `background: var(--lime…)` / `#CFF42A` declaration in style.css + redesign.css + inline styles in HTML and chrome.js templates; ensure explicit `color: #0a0a0a` travels WITH the lime background declaration (buttons: `.btn-primary`, `.float-btn`, drawer CTAs, `Get Started` pill, Subscribe button, tag pills, wizard chips).
- Add a comment contract at the lime var definition: `/* RULE: lime bg pairs with #0a0a0a text only. Never white-on-lime. */`

### B3. Reveal animation + dead-scroll feel
- Reveal-on-scroll sections currently leave whole viewports empty at human scroll speed. Reduce: animation duration/delay ≤ 300ms, trigger margin earlier (rootMargin so sections start revealing ~200px before entering), and cut the biggest section paddings roughly in half (the empty-gradient bands between homepage sections, solutions below-cards region). Content must be visible without a scroll-stop on a normal-speed scroll.
- Mobile homepage: target ≤ ~20 phone-screens total (from ~36).

### A8. work.html content-quality pass (live 7/30 findings, creator-tunnel back up)
- Raw vault filenames ship as public titles: "IMG_9981", "BTS_RINGLIGHT", "BTS_LIGHTBAR_STUDIO", "BTS_36F4", "CHRIS BUSH BTS 2 MAY 6". Apply B4's render-time title cleanup here too; for BTS items with filename-shaped titles (regex: all-caps/underscores/IMG_\d+), display a generic label ("Behind the scenes · JourneyWell Studio") instead.
- Counter bar: "1 SHOWS · 1 TOPICS" — pluralize correctly; investigate why shows=1 when episodes list She's Built Different + Smile Spa (count distinct shows from the feed).
- Episode tiles with no thumbnail render solid black — add a branded fallback card (logo on ink background).
- Floating "GET STARTED" pill overlaps the NOW SHOWING panel at desktop width — z-index/position fix.
- Pinned trailer card: if no clean poster frame exists, use a real studio frame from images/ as poster.

### B4. Polish list
- Work strip titles: display-title cleanup fn in chrome.js where cards render — strip leading numbering ("9. ", "10. "), trailing "(Really short)"-style notes, and emoji from titles at render time (content.json data stays untouched).
- Nav label "Blogs" → "Blog" (chrome.js nav array + mega-menu).
- Mobile header: white circle overlapping the wordmark (visible on mobile captures; likely the theme-toggle or a decorative pseudo-element) — find and fix stacking/position.
- get-started.html wordmark white-on-white (with A7).
- Solutions "why it works" cards: swap stock photos (letterpress/storm/sunset) for real frames from `images/` (bts/ and cards/ dirs) — pick studio/recording frames, keep aspect ratios.
- Blog thumbnails: where a stock image is referenced for the 6 non-featured cards, prefer any studio frame available; otherwise leave (blog is P2).

### B5. Build the QA gate itself
- `scripts/qa/theme-contrast-scan.py` per the spec above + `scripts/qa/README.md` (how to run, what fails mean). Commit baseline + post-fix results JSON.

---

## Orchestrator: merge, verify, ship

1. Merge A and B branches (expect chrome.js + redesign.css conflicts; A owns markup/copy intent, B owns color/theme intent — reconcile keeping both).
2. Serve locally :8931 → run QA gate both themes → re-capture index/solutions/authority/studio/get-started light+dark and eyeball.
3. `vercel deploy --prod --yes` from repo root; verify webhook grep; spot-check https://journeywell.io in both themes + mobile; re-run QA gate against prod.
4. Commit everything incl. this runbook with checkboxes updated; push to origin.

## Needs Tim (blocked on real facts — do NOT improvise)

- [ ] Studio hourly / session pricing ("from $X") for studio.html + wizard budget bands sanity-check
- [ ] Authority + Podcast Launch retainer price anchors (or explicit decision to keep price off-site and rely on budget select + proposal CTA)
- [ ] 2 more named testimonials with faces (Bonvenu + one more; even one line each)
- [ ] Client logo files for the chip row (Bonvenu Bank, Melara, She's Built Different, Two Dudes And, Smile Spa)
- [ ] Phone number for footer (none found in repo)
- [ ] Decision on mid-funnel offer: productized "Content Engine Audit" page and/or "Get a proposal within hours" CTA wired to the proposal engine (competitor pattern: Fame/ThreeSixtyEight — see report)
