#!/usr/bin/env python3
"""
JW theme-contrast QA gate (FIX-RUNBOOK.md, "QA gate" + B5).

Loads every page from a local server in BOTH themes (light + dark), scroll-triggers
the reveal animations, then scans computed styles for the two hard-fail classes:

  CLASS 1 (limeBgWhiteText) — element with a lime background whose computed text
           color is near-white (r,g,b all >= 225). Tim's rule: lime backgrounds
           ALWAYS carry near-black text. HARD FAIL.
  CLASS 2 (limeTextOnLight) — lime-colored text over a light effective background
           (~1.3:1 contrast, invisible in light theme). HARD FAIL.

Also records limeBgOther (lime backgrounds with non-white text — informational,
these are the correct state) so results stay comparable with
baseline-2026-07-30.json.

Usage:
    python3 -m http.server 8931          # from repo root, any port
    python3 scripts/qa/theme-contrast-scan.py 8931

Writes scripts/qa/scan-results.json and exits non-zero on any CLASS 1 or
CLASS 2 hit, so it can gate deploys.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8931"
BASE = f"http://localhost:{PORT}"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scan-results.json")
PAGES = ["index", "solutions", "studio", "authority", "podcast", "work",
         "portfolio", "about", "blog", "get-started"]

SCAN_JS = r"""
() => {
  const isLime = (r,g,b) => r>=185 && r<=225 && g>=225 && g<=255 && b<=90;
  const isWhite = (r,g,b) => r>=225 && g>=225 && b>=225;
  const parse = (s) => { const m = s && s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? {r:+m[1], g:+m[2], b:+m[3], a: m[4]===undefined?1:+m[4]} : null; };
  // Average the opaque color stops of a computed gradient background-image.
  // Lets the walk see hardcoded-dark gradient surfaces (e.g. .channel-about-inner)
  // whose background-color computes to transparent.
  const gradientBg = (s) => {
    if (!s || s === 'none' || !s.includes('gradient')) return null;
    const stops = [...s.matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g)]
      .map(m => ({r:+m[1], g:+m[2], b:+m[3], a: m[4]===undefined?1:+m[4]}))
      .filter(c => c.a > 0.5);
    if (!stops.length) return null;
    const n = stops.length;
    return { r: stops.reduce((t,c)=>t+c.r,0)/n,
             g: stops.reduce((t,c)=>t+c.g,0)/n,
             b: stops.reduce((t,c)=>t+c.b,0)/n, a: 1 };
  };
  const out = { limeBgWhiteText: [], limeBgOther: [], limeTextOnLight: [] };
  const seen = new Set();
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const bg = parse(cs.backgroundColor); const fg = parse(cs.color);
    if (!fg) continue;
    const txt = (el.innerText || '').trim().slice(0, 50);
    const desc = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0,3).join('.') : '');
    if (bg && bg.a > 0.5 && isLime(bg.r, bg.g, bg.b)) {
      const hasDirectText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!hasDirectText && !txt) continue;
      const key = desc + '|' + txt;
      if (seen.has(key)) continue; seen.add(key);
      const rec = { el: desc, text: txt, bg: cs.backgroundColor, color: cs.color };
      if (isWhite(fg.r, fg.g, fg.b)) out.limeBgWhiteText.push(rec); else out.limeBgOther.push(rec);
    } else if (isLime(fg.r, fg.g, fg.b)) {
      const hasDirectText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!hasDirectText) continue;
      // Effective background: walk up until a non-transparent color, an opaque
      // gradient, or a url() image (unknown -> skip; can't judge a photo).
      let p = el, ebg = null, unknown = false;
      while (p && p !== document.documentElement) {
        const pcs = getComputedStyle(p);
        const pb = parse(pcs.backgroundColor);
        if (pb && pb.a > 0.5) { ebg = pb; break; }
        const bi = pcs.backgroundImage;
        if (bi && bi.includes('url(')) { unknown = true; break; }
        const gb = gradientBg(bi);
        if (gb) { ebg = gb; break; }
        p = p.parentElement;
      }
      if (unknown) continue;
      if (ebg && (ebg.r + ebg.g + ebg.b) / 3 > 200) {
        const key = 'T' + desc + '|' + txt;
        if (seen.has(key)) continue; seen.add(key);
        out.limeTextOnLight.push({ el: desc, text: txt, color: cs.color, effBg: `rgb(${Math.round(ebg.r)},${Math.round(ebg.g)},${Math.round(ebg.b)})` });
      }
    }
  }
  return out;
}
"""


def run_page(browser, name, theme, width=1440, height=900):
    ctx = browser.new_context(viewport={"width": width, "height": height},
                              color_scheme="light" if theme == "light" else "dark")
    ctx.add_init_script(f"try {{ localStorage.setItem('jw-theme', '{theme}'); }} catch(e) {{}}")
    page = ctx.new_page()
    fn = "index.html" if name == "index" else f"{name}.html"
    try:
        page.goto(f"{BASE}/{fn}", wait_until="networkidle", timeout=30000)
    except Exception:
        pass
    page.wait_for_timeout(1500)
    # Scroll the full page so IntersectionObserver reveals + lazy content fire.
    h = page.evaluate("document.body.scrollHeight")
    y = 0
    while y < h:
        y += 700
        page.evaluate(f"window.scrollTo(0, {y})")
        page.wait_for_timeout(180)
        h = page.evaluate("document.body.scrollHeight")
    page.wait_for_timeout(800)
    scan = page.evaluate(SCAN_JS)
    ctx.close()
    return scan


def main():
    report = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome")
        for theme in ["light", "dark"]:
            for name in PAGES:
                try:
                    report[f"{name}-{theme}"] = run_page(browser, name, theme)
                    c = report[f"{name}-{theme}"]
                    print(f"scanned {name}-{theme}: "
                          f"class1={len(c['limeBgWhiteText'])} class2={len(c['limeTextOnLight'])} "
                          f"ok-lime-bg={len(c['limeBgOther'])}", flush=True)
                except Exception as e:
                    print(f"FAIL {name}-{theme}: {e}", flush=True)
                    report[f"{name}-{theme}"] = {"error": str(e)}
        browser.close()

    with open(OUT, "w") as f:
        json.dump(report, f, indent=1)

    hard_fails = 0
    errors = 0
    for key, v in report.items():
        if "error" in v:
            errors += 1
            continue
        for rec in v.get("limeBgWhiteText", []):
            hard_fails += 1
            print(f"CLASS 1 {key}: {rec['el']} '{rec['text']}' color={rec['color']} on {rec['bg']}")
        for rec in v.get("limeTextOnLight", []):
            hard_fails += 1
            print(f"CLASS 2 {key}: {rec['el']} '{rec['text']}' lime text on {rec['effBg']}")

    print(f"\nTOTAL hard fails: {hard_fails} (page errors: {errors}) -> {OUT}")
    sys.exit(1 if (hard_fails or errors) else 0)


if __name__ == "__main__":
    main()
