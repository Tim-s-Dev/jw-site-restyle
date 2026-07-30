# QA: theme-contrast scan

Guards the two hard-fail visual defect classes from the 2026-07-29 stress test
(see FIX-RUNBOOK.md "QA gate"):

- **CLASS 1 — `limeBgWhiteText`**: any element with a lime (#CFF42A-family)
  background whose computed text color is near-white (r,g,b all >= 225).
  Tim's rule (7/30): lime backgrounds ALWAYS carry near-black text, both themes.
- **CLASS 2 — `limeTextOnLight`**: lime-colored text over a light effective
  background (contrast ~1.3:1 — invisible in light theme). Lime text is only
  allowed on dark surfaces.

`limeBgOther` in the results is informational — lime backgrounds with dark
text, i.e. the *correct* state.

## Run

```sh
# from repo root
python3 -m http.server 8931 &          # any port
python3 scripts/qa/theme-contrast-scan.py 8931
```

Requires Python Playwright with the Chrome channel (`pip install playwright`,
uses the installed Google Chrome).

The scan loads all 10 pages at 1440x900 in BOTH themes (sets `localStorage
jw-theme` before load + matching `color_scheme`, mirroring chrome.js
`applyEarlyTheme`), scrolls each page end-to-end so reveal animations and lazy
content hydrate, then walks every element's computed styles.

## Output

- `scan-results.json` — per `page-theme` key: `limeBgWhiteText`,
  `limeTextOnLight` (hard fails) and `limeBgOther` (info). Same shape as
  `baseline-2026-07-30.json` (the production scan before the fixes).
- Exit code **non-zero** if there is ANY CLASS 1 or CLASS 2 hit (or a page
  failed to scan) — wire it before `vercel deploy`.

## What a failure means

- CLASS 1 hit: someone declared a lime background without an explicit
  near-black `color`. Fix at the class level — the `color` must travel with
  the lime `background` declaration (see the RULE comment at the `--lime`
  definition in style.css and `--accent` in lite.css).
- CLASS 2 hit: lime used as a text color on a surface that is light in one of
  the themes. Use the theme-aware accent instead: `var(--accent-deep)`
  (lime in dark theme, dark olive in light theme — defined in redesign.css).

## Notes

- The effective-background walk understands solid colors and gradient
  backgrounds (averages opaque stops). Text over `url()` photo backgrounds is
  skipped — a photo's brightness can't be judged from CSS.
- False-negative surface: text absolutely positioned over an image without a
  DOM-ancestor background. Eyeball screenshots for those.
