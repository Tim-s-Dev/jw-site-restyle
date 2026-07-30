#!/usr/bin/env python3
"""Live-site captures (light+dark, scroll-revealed) + lime/white button contrast scan."""
import json
from playwright.sync_api import sync_playwright

OUT = "/private/tmp/claude-501/-Users-tim/4d2c8fd4-025e-469b-be73-3dfafb9d17b7/scratchpad/site-audit/live"
BASE = "https://journeywell.io"
PAGES = ["index", "solutions", "studio", "authority", "podcast", "work",
         "portfolio", "about", "blog", "get-started"]

SCAN_JS = """
() => {
  const isLime = (r,g,b) => r>=185 && r<=225 && g>=225 && g<=255 && b<=90;
  const isWhite = (r,g,b) => r>=225 && g>=225 && b>=225;
  const parse = (s) => { const m = s && s.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    return m ? {r:+m[1], g:+m[2], b:+m[3], a: m[4]===undefined?1:+m[4]} : null; };
  const out = { limeBgWhiteText: [], limeBgOther: [], limeTextOnLight: [] };
  const seen = new Set();
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
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
      // effective background: walk up until non-transparent
      let p = el, ebg = null;
      while (p && p !== document.documentElement) {
        const pb = parse(getComputedStyle(p).backgroundColor);
        if (pb && pb.a > 0.5) { ebg = pb; break; }
        p = p.parentElement;
      }
      if (ebg && (ebg.r + ebg.g + ebg.b) / 3 > 200) {
        const key = 'T' + desc + '|' + txt;
        if (seen.has(key)) continue; seen.add(key);
        out.limeTextOnLight.push({ el: desc, text: txt, color: cs.color, effBg: `rgb(${ebg.r},${ebg.g},${ebg.b})` });
      }
    }
  }
  return out;
}
"""

def run_page(browser, name, theme, width, height, suffix=""):
    ctx = browser.new_context(viewport={"width": width, "height": height},
                              color_scheme="light" if theme == "light" else "dark")
    ctx.add_init_script(f"try {{ localStorage.setItem('jw-theme', '{theme}'); }} catch(e) {{}}")
    page = ctx.new_page()
    fn = "index.html" if name == "index" else f"{name}.html"
    try:
        page.goto(f"{BASE}/{fn}", wait_until="networkidle", timeout=30000)
    except Exception:
        pass
    page.wait_for_timeout(2500)
    h = page.evaluate("document.body.scrollHeight"); y = 0
    while y < h:
        y += 700
        page.evaluate(f"window.scrollTo(0, {y})")
        page.wait_for_timeout(300)
        h = page.evaluate("document.body.scrollHeight")
    page.wait_for_timeout(1200)
    scan = page.evaluate(SCAN_JS)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/{name}-{theme}{suffix}.png", full_page=True)
    ctx.close()
    return scan

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="chrome")
    report = {}
    for theme in ["light", "dark"]:
        for name in PAGES:
            try:
                report[f"{name}-{theme}"] = run_page(browser, name, theme, 1440, 900)
                print(f"done {name}-{theme}", flush=True)
            except Exception as e:
                print(f"FAIL {name}-{theme}: {e}", flush=True)
    for theme in ["light", "dark"]:
        for name in ["index", "studio", "get-started"]:
            try:
                run_page(browser, name, theme, 390, 844, "-mobile")
                print(f"done {name}-{theme}-mobile", flush=True)
            except Exception as e:
                print(f"FAIL {name}-{theme}-mobile: {e}", flush=True)
    browser.close()

with open(f"{OUT}/contrast-scan.json", "w") as f:
    json.dump(report, f, indent=1)
totals = {k: {kk: len(vv) for kk, vv in v.items()} for k, v in report.items() if any(v.values())}
print(json.dumps(totals, indent=1))
