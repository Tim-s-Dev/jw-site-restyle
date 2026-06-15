---
name: JourneyWell
description: Marketing site for a working video production studio in Baton Rouge.
colors:
  lime: "#d4ff00"
  accent-spotify: "#1db954"
  accent-deep: "#169c46"
  ink: "#0a0a0a"
  black: "#000000"
  paper: "#f6f5f2"
  paper-white: "#ffffff"
  text-on-cream-muted: "#4a4a4a"
  line-dark: "rgba(0,0,0,0.10)"
  line-dark-strong: "rgba(0,0,0,0.22)"
  line-light: "rgba(255,255,255,0.10)"
  line-light-strong: "rgba(255,255,255,0.22)"
  error: "#d61f4a"
typography:
  display:
    fontFamily: "Helvetica Now Display, Helvetica Neue, Inter, Helvetica, Arial, sans-serif"
    fontSize: "clamp(54px, 9vw, 120px)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "-0.035em"
  display-em:
    fontFamily: "Apple Garamond, ITC Garamond, Garamond, Hoefler Text, Times New Roman, serif"
    fontSize: "inherit"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.01em"
  section-title:
    fontFamily: "Helvetica Now Display, Helvetica Neue, Inter, Helvetica, Arial, sans-serif"
    fontSize: "clamp(36px, 5vw, 72px)"
    fontWeight: 900
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  eyebrow:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  button-label:
    fontFamily: "Helvetica Now Display, Helvetica Neue, Inter, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "28px"
  xxl: "32px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "40px"
  xl: "64px"
  xxl: "96px"
components:
  button-lime:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.black}"
    typography: "{typography.button-label}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
  button-lime-hover:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.black}"
  button-on-cream:
    backgroundColor: "{colors.black}"
    textColor: "{colors.lime}"
    typography: "{typography.button-label}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
  button-ghost-dark:
    backgroundColor: "rgba(255,255,255,0.08)"
    textColor: "#ffffff"
    typography: "{typography.button-label}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  button-ghost-light:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button-label}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  eyebrow-lite:
    backgroundColor: "rgba(29,185,84,0.10)"
    textColor: "{colors.accent-deep}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  lite-card:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "28px"
---

# Design System: JourneyWell

## 1. Overview

**Creative North Star: "The Working Studio"**

JourneyWell is a real studio in Baton Rouge where founders walk in on Monday and walk out with shipped video by Friday. The visual system carries that physical, hands-on feeling: photography of the actual room (lights, mics, monitors, founders mid-take), an unmistakable saturated lime borrowed from gaff tape and signal lights, and editorial type pairings that read like the title sequence of a documentary, not the cover of a fashion magazine. The system is dark by default — bodies sit at near-black `#0a0a0a` so the photography and the lime do the talking — with a fully reconciled light treatment built on a cream paper background for daytime reading and printed-feeling sections.

What it explicitly is NOT: corporate-stiff agency-site grammar. No navy-plus-grey palette, no stock smiling-team grids, no jargon-stuffed taglines about delivering impactful narratives, no portfolio hover-states hiding the work. The site shows the room, names what was made, and lets the lime do the announcing. SaaS-cream cosplay and editorial-magazine drift are also rejected; this is studio voice, not Klim cosplay.

**Key Characteristics:**

- Dark-first surface (`#0a0a0a`) with reconciled cream light mode (`#f6f5f2`).
- One saturated brand color — **Electric Signal Lime** `#d4ff00` — earned, not sprinkled.
- Display: Helvetica Now Display 900 ALL CAPS, tight `-0.035em` tracking, ratio-driven `clamp()` scale.
- Editorial accent voice: Apple Garamond italic `em` inside display headlines, set in lime.
- A second register (`body.lite`) layers a Spotify-influenced palette (`#1DB954` / `#169c46`) on top for blog, portfolio, and content-heavy pages.
- Photography-first: every page leads with the studio. Solid color rectangles where a photo belongs are bugs.

## 2. Colors

The palette is a committed dual-register system: a Black + Lime brand spine for hero / promotional moments, and a Spotify-influenced accent green pair for content-heavy pages where lime would shout. Cream paper is the daylight backdrop.

### Primary

- **Electric Signal Lime** (`#d4ff00`): The brand's voltage. Lives on display `em` italics, primary CTAs (`.btn-gold`), eyebrow accents on dark sections, and the inverted "on cream" button text. Earned placement only — never decorative, never a gradient endpoint. In light mode on cream backgrounds the lime fails contrast on text and is replaced by **Working Green** `#169c46` (see Secondary).

### Secondary

- **Working Green — Accent Deep** (`#169c46`): Light-mode text substitute for lime where contrast matters; also the eyebrow color on `body.lite` content pages. Use whenever lime would wash out on cream.
- **Spotify Green — Accent** (`#1DB954`): Interactive states on lite pages (link hover, focus outlines, card affordances, the eyebrow pill background at 10% alpha as `--accent-tint`).

### Neutral

- **Studio Black** (`#000000`): Reserved for inverted CTAs on cream (`.btn-on-cream`) and the body background on hero-led promotional moments.
- **Studio Ink** (`#0a0a0a`): Default dark-mode body, primary text on cream, default text color. Slightly off-pure-black so highlights from photography read truer.
- **Studio Paper** (`#f6f5f2`): Light-mode body background. The cream is muted, lower-saturation than the AI-default warm-neutral band — closer to a working bond paper than a magazine spread.
- **Studio Paper-White** (`#ffffff`): Card and surface bg on lite pages where the cream would compete.
- **Muted on Cream** (`#4a4a4a`): Paragraph text on cream where pure ink reads as heavy. Hits 4.5:1.
- **Line — Dark on Light** (`rgba(0,0,0,0.10)` / `rgba(0,0,0,0.22)`): Dividers and borders in light mode.
- **Line — Light on Dark** (`rgba(255,255,255,0.10)` / `rgba(255,255,255,0.22)`): Dividers and ghost borders in dark mode.

### Named Rules

**The Voltage Rule.** Electric Signal Lime appears on ≤10% of any given screen, and never on a body-text-sized run of words. Its scarcity is the point. If two CTAs on a page are lime, one of them is wrong.

**The Cream-Contrast Rule.** Lime `#d4ff00` is prohibited as a text color on `var(--paper)` or any near-white background. Substitute Working Green `#169c46`. This is a contrast contract, not a preference.

**The No-Gradient Rule.** Lime is a flat color. No gradients from lime to anything. No `background-clip: text` over a lime gradient. If you want emphasis, use weight and size.

## 3. Typography

**Display Font:** Helvetica Now Display (with Helvetica Neue, Inter, system fallbacks)
**Body Font:** Inter (with system sans fallback)
**Editorial Italic:** Apple Garamond (with ITC Garamond, Garamond, Hoefler Text fallbacks); on lite pages, Cormorant Garamond italic stands in for the same role.

**Character:** Helvetica Now Display at 900 black, ALL CAPS, tight `-0.035em` tracking is the studio's announcement voice — confident, hands-on, no apologies. Inter carries running copy in a neutral, technical register. The pairing is contrast-axis (geometric-sans display + humanist-sans body); the editorial italic Garamond `em` inside display headlines is the dial — one beat of warmth and authorship in an otherwise loud declaration.

### Hierarchy

- **Display** (900, `clamp(54px, 9vw, 120px)`, 0.92 line-height, `-0.035em` tracking, ALL CAPS): Hero `h1` only. Capped at 120px — the ceiling holds even when viewport allows more. `text-wrap: balance`.
- **Headline / Section Title** (900, `clamp(36px, 5vw, 72px)`, 0.96 line-height, ALL CAPS): `.section-title` and major section `h2`. Same display family, same tracking. `text-wrap: balance`.
- **Title** (700-800, 20–28px, 1.2 line-height): Card titles, sub-section headings on lite pages. Inter, mixed case.
- **Body** (400, 16px, 1.6 line-height): Inter for all running copy. Cap line length at 65–75ch on long-form (blog posts, About). `text-wrap: pretty` for orphan reduction.
- **Eyebrow / Label** (600-700, 12px, `0.06em-0.10em` tracking, uppercase): Section eyebrows on lite pages as filled accent-tint pills; on the dark brand spine, smaller uppercase rules without a pill background.
- **Editorial Italic `em`** (Apple Garamond italic, 400, inherit size, `-0.01em` tracking, mixed case, lime in dark mode / Working Green in light mode): Inside display headlines only. This is the editorial voice and it must read as authored, not decorative.

### Named Rules

**The Apple Garamond Italic Rule.** Italic `em` inside display headlines is automatically Apple Garamond + lime. Do not override unless `inline style="font-style:normal"` is set. The em IS the editorial accent voice; treating it as a plain inline span breaks the system.

**The Caps Ceiling.** ALL CAPS is for display headlines, eyebrows, and button labels only. Never for body copy, never for long card titles. ALL CAPS at body sizes reads as shouting, not designed.

**The Single-Family-Per-Run Rule.** Within a single paragraph or running sentence, never mix Helvetica display with Inter body. Mixing happens at the headline boundary (display headline → Inter lede paragraph), never mid-sentence.

## 4. Elevation

The system is **flat by default with photographic depth.** Surfaces don't lift via shadow; depth is conveyed by photography, color blocking (lime on black on cream), and the photo grid's `object-fit: cover` cropping. Shadows appear sparingly: lime CTAs carry a faint colored glow as a state signal, and lite-mode cards use Material-style tonal shadows for hover affordance. Both are responses to interaction or state, not ambient decoration.

### Shadow Vocabulary

- **Lime Glow** (`0 8px 30px rgba(212,255,0,0.25)` at rest, `0 12px 36px rgba(212,255,0,0.35)` on hover): The signature CTA glow under `.btn-gold`. Carries voltage. Never used on non-lime elements.
- **Inverse Glow** (`0 12px 40px rgba(0,0,0,0.25)` at rest, `0 16px 50px rgba(0,0,0,0.35)` on hover): The dark counterpart for `.btn-on-cream` (black button on cream surface). Same shape, neutral mass.
- **Lite Shadow — sm** (`0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)`): Resting card affordance on lite pages.
- **Lite Shadow — md** (`0 6px 20px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)`): Hover lift on lite cards.
- **Lite Shadow — lg** (`0 24px 60px rgba(0,0,0,0.10), 0 8px 16px rgba(0,0,0,0.05)`): Emphasis on featured cards and modal panels.

### Named Rules

**The Flat-Brand-Spine Rule.** The dark hero/brand surfaces (`body` default, `.section`, `.jw-cinematic`) carry no shadows. Depth comes from photography and color blocking. Adding ambient shadows to dark surfaces flattens them ironically and reads as "trying to look 3D."

**The Glow-Is-Voltage Rule.** Colored shadows are reserved for primary CTAs (lime glow under `.btn-gold`, inverse glow under `.btn-on-cream`). Glowing a card or a chip dilutes the signal.

## 5. Components

### Buttons

- **Shape:** Pill (`999px` radius). Universal across both registers.
- **Primary — Lime on Dark (`.btn-gold`):** Lime background (`#d4ff00`), black text, Helvetica Now Display 700, `12px / 0.08em` tracking uppercase, `14px 22px` padding when `.btn-large`. Carries the Lime Glow shadow. Used for "Book a session" and the headline CTAs.
- **Inverted — Black on Cream (`.btn-on-cream`):** Black background, lime text. Same dimensions. Used on cream sections where lime-on-cream would fail contrast.
- **Ghost — Dark Surface (`.btn-ghost`):** `rgba(255,255,255,0.08)` background, white text, `1px` border at `rgba(255,255,255,0.10)`. Hover bumps both alphas. Secondary actions on dark surfaces.
- **Ghost — Light Surface (`.btn-ghost` on `.section-cream` or `[data-theme="light"]`):** Transparent background, ink text, `rgba(0,0,0,0.22)` border. Same shape.
- **Hover:** All buttons translate `-2px` and intensify their shadow (or background alpha for ghost). Transition `0.45s ease` on background-color via redesign.css for smooth theme-flip behavior.

### Eyebrows / Labels

- **Style — Lite pages (`body.lite .eyebrow`):** Filled pill, `accent-tint` background (`rgba(29,185,84,0.10)`), `accent-deep` text (`#169c46`), Inter 600, 12px, `0.06em` tracking, uppercase, `6px 12px` padding. The chip itself is the affordance.
- **Style — Dark spine:** Inline uppercase tracked text, no pill background, white at lower alpha, Inter 600. Rare — used as section eyebrows on hero-tight layouts.
- **The Reach-For-It Test:** If a section heading wants an eyebrow, ask whether it's earning its place in the page's rhythm or whether it's there because "landing pages do this." Cut by default.

### Cards / Containers (`body.lite .lite-card`)

- **Corner Style:** `18px` (`rounded.lg`). Soft but not consumer-app-rounded.
- **Background:** `paper-white` `#ffffff`. Cards exist only on lite pages; on the dark brand spine, content sits directly on the page background without card wrapping.
- **Shadow Strategy:** Lite Shadow — sm at rest, md on hover, with a `translate(-2px)` lift and a `border-color` flash to `var(--accent)` at `transition: 150ms ease`.
- **Border:** `1px solid rgba(0,0,0,0.08)` (var --line). The full border is intentional — no side-stripe borders anywhere in the system.
- **Internal Padding:** `28px`.

### Inputs (form fields, `.full-page-form` and lite contact forms)

- **Style:** White background, ink text, `1px` border at `var(--line-dk)`, `radius.md` (14px). Always sits on a cream or paper-white surface so the contrast is automatic. Body Inter at 16px.
- **Focus:** Border darkens to `var(--accent-deep)` or `var(--lime)` depending on register, with a 2px outline ring at `var(--accent-glow)` / `var(--lime-glow)`. Never `outline: none` without a replacement ring.

### Navigation (`body.lite .nav`)

- **Style:** Sticky top, height 64px, `rgba(255,255,255,0.85)` with `backdrop-filter: saturate(180%) blur(14px)`. The single legitimate use of backdrop-blur in the system — earns its place because the nav floats over scrolling photography.
- **Links:** Inter 500, 14px, mixed case, `var(--muted)` resting → `var(--ink)` hover with `var(--bg-hover)` background pill at hover/active. The hover state IS the affordance.
- **Mobile:** Hamburger pattern in `chrome.js`. The mobile-nav uses the same alpha-glass treatment.

### Signature Component — The Photo Grid (`.jw-photo-grid`)

A three-up editorial photography grid that anchors the homepage and reappears as a cinematic element on `studio.html` / `about.html`. Black surface in dark mode (`var(--black)`), cream in light mode (`var(--paper)`), `1fr 1.45fr 1fr` columns with a 10px gap. The middle cell is `.tall` (380px) and the side cells are 280px. Captions are uppercase `11px / 0.10em` tracking. Each `.jw-slot-img` uses `object-fit: cover` with a default `object-position: 50% 72%` (bottom-biased so studio detail in the foreground reads). Per-slot crop overrides are encouraged when the default crop hides the subject — see `.jw-slot-img[src*="03c-home-edit"]`. This component IS the brand's photographic doctrine made structural.

### Signature Component — The Split Section (`.jw-split-wrap` + `.jw-split-txt`)

A two-column 50/50 image-plus-text band that pairs studio imagery with a single declarative headline (display + italic em). Inverts cleanly across themes: in dark mode the text panel is near-black `#0d0d0d` with lime em italics; in light mode it falls back to cream + ink with Working Green em. The `em` color is the visible signal that the theme has switched.

## 6. Do's and Don'ts

### Do:

- **Do** lead pages with photography of the actual studio (lights, monitors, mics, founders mid-take). Photo grids and split sections are the spine of the page.
- **Do** keep Electric Signal Lime `#d4ff00` to ≤10% of any screen. Display `em` italics, primary CTA, eyebrow accents on dark. Earn it.
- **Do** swap lime to Working Green `#169c46` whenever it sits on cream or any near-white background. The Cream-Contrast Rule is a contract.
- **Do** pair Helvetica Now Display 900 ALL CAPS headlines with Apple Garamond italic `em` for the editorial accent — that pairing IS the JW voice.
- **Do** use `text-wrap: balance` on every display headline and section title.
- **Do** keep buttons pill-shaped (`999px`) across both registers. The shape is identity, not aesthetics.
- **Do** use the `body.lite` register with `#1DB954` accent for blog, portfolio, and long-form content. Use the dark brand spine for hero / promotional moments.
- **Do** give every animation a `@media (prefers-reduced-motion: reduce)` fallback. WCAG 2.2 AA is the contract.
- **Do** write alt text that describes what's in the shot — "Founder mid-take in the recording suite, mic up, monitors at 16:02" — not "studio image."

### Don't:

- **Don't** use any corporate-stiff agency tropes: navy + grey palette, stock smiling-team photos, jargon-laden taglines about "delivering impactful narratives." JW is the opposite of agency-stiff.
- **Don't** drift into SaaS-cream cosplay (`--cream`, `--sand`, `--bone`, `--linen` warm-neutral tokens with a tiny tracked eyebrow on every section). The JW cream is `#f6f5f2` and it's a working bond-paper bg, not magazine restraint cosplay.
- **Don't** drop crypto/startup-loud moves — neon gradients, glitchy motion, glassmorphism cards. The single legitimate backdrop-blur is the nav.
- **Don't** put lime `#d4ff00` on white, cream, or any background under 0.20 luminance contrast. It's not "stylish" — it fails 4.5:1.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards or callouts. Use full borders, background tints, or nothing.
- **Don't** ship `background-clip: text` gradients. Lime is flat.
- **Don't** put numbered `01 / 02 / 03` markers above every section. Numbers earn their place when the section IS a sequence, never as default scaffolding.
- **Don't** add ambient shadows to the dark brand spine. Flat is the doctrine. Shadows are reserved for the lime/inverse glow on CTAs and lite-card hover states.
- **Don't** mix Helvetica Display with Inter mid-sentence. The boundary is at the headline / paragraph break.
- **Don't** replace photography with colored CSS panels or generic stock when the brief says "studio." Zero imagery in an image-led brand is a bug, not restraint.
- **Don't** rename or alias the `--lime` token. The name is the brand; calling it `--gold` or `--accent` (which the codebase already has as legacy compatibility shims) is a maintenance trap.
