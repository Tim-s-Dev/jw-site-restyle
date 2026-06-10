// chrome.js — injects nav, footer, floating button, drawer on every page
// Also loads content.json and exposes a small render helper for show cards.

// ---- Early theme application (runs before installChrome to minimize FOUC) ----
(function applyEarlyTheme() {
  try {
    var stored = localStorage.getItem('jw-theme');
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) { /* localStorage blocked — default to dark */ }
})();

// ---- Inject redesign.css on every page (so toggle + carousel + theme work everywhere) ----
(function injectRedesignCss() {
  if (document.querySelector('link[data-jw-redesign]')) return;
  var depth = location.pathname.split('/').filter(function (s) { return s && !s.endsWith('.html'); }).length;
  var prefix = '../'.repeat(depth);
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = prefix + 'redesign.css';
  link.setAttribute('data-jw-redesign', '1');
  (document.head || document.documentElement).appendChild(link);
})();

(function () {
  // Portfolio (portfolio.html) and Journal (blog.html) are temporarily hidden
  // from navigation — the pages still exist and can be revealed by adding them
  // back to PAGES + MENU when ready.
  const PAGES = [
    { href: 'solutions.html', label: 'Solutions' },
    { href: 'work.html',      label: 'Work' },
    { href: 'about.html',     label: 'About' },
  ];

  // Service sub-pages (kept in footer + linked from Solutions, off main nav)
  const SUB_PAGES = [
    { href: 'studio.html',    label: 'Studio' },
    { href: 'podcast.html',   label: 'Podcast' },
    { href: 'authority.html', label: 'Authority' },
  ];

  // Desktop mega-menu definition. Items with `panel` open a Vimeo-style dropdown
  // on hover/click; items without are plain links. Mobile-nav stays flat (uses PAGES).
  // Each link supports either `href` (navigate) or `drawer` (open get-started drawer).
  const MENU = [
    {
      label: 'Solutions',
      href: 'solutions.html',
      panel: {
        cols: [
          {
            heading: 'Services',
            links: [
              { icon: 'mic',    label: 'Studio',           sub: 'Book studio time',                 href: 'studio.html' },
              { icon: 'headphones', label: 'Podcast',      sub: 'Full launch & ops',                href: 'podcast.html' },
              { icon: 'layers', label: 'Authority System', sub: 'One recording → 30+ assets',       href: 'authority.html' },
            ],
          },
          {
            heading: 'Get started',
            links: [
              { icon: 'rocket', label: 'Launch a podcast',        sub: 'Branded & distributed in days', drawer: 'podcast' },
              { icon: 'video',  label: 'Get a stack of shorts',    sub: 'Captioned, packaged, postable', drawer: 'shorts' },
              { icon: 'star',   label: 'Build content authority',  sub: 'Full system, every platform',   drawer: 'authority' },
            ],
          },
        ],
        featured: {
          media: { tag: 'nav:solutions' },
          eyebrow: 'How it works',
          title: 'Content authority, produced & shipped',
          body: 'One recording becomes 30+ assets. We capture it, edit it, ship it — you own the audience.',
          ctaLabel: 'See the system',
          ctaHref: 'solutions.html',
        },
      },
    },
    {
      label: 'Work',
      href: 'work.html',
      panel: {
        cols: [
          {
            heading: 'Watch',
            links: [
              { icon: 'play',   label: 'Episodes',          sub: 'Long-form interviews',   href: 'work.html#section-episodes' },
              { icon: 'video',  label: 'Shorts',            sub: 'Vertical reels & cuts',  href: 'work.html#section-shorts' },
            ],
          },
          {
            heading: 'Explore',
            links: [
              { icon: 'camera', label: 'Behind the scenes', sub: 'How the work gets made', href: 'work.html#section-bts' },
              { icon: 'grid',   label: 'All shows',         sub: 'Every brand, every row', href: 'work.html' },
            ],
          },
        ],
        featured: {
          media: { tag: 'nav:work' },
          eyebrow: 'Channel trailer',
          title: 'Two minutes on what we ship',
          body: 'A quick tour of the JourneyWell studio channel — episodes, shorts, and the production rhythm behind them.',
          ctaLabel: 'Open the channel',
          ctaHref: 'work.html',
        },
      },
    },
    // Portfolio and Journal mega-menu entries are temporarily hidden.
    // Their panel/link definitions can be restored alongside the PAGES
    // entries above when these pages return to navigation.
    { label: 'About',   href: 'about.html' },
  ];

  // Subfolder-aware path prefix. Blog posts live under /blog/<slug>.html
  // and need to reference root-level pages with ../. Detect by counting depth.
  const PATH_DEPTH = location.pathname.split('/').filter(s => s && !s.endsWith('.html')).length;
  const PATH_PREFIX = '../'.repeat(PATH_DEPTH);
  const IN_BLOG_POST = location.pathname.includes('/blog/') && !location.pathname.endsWith('/blog.html');

  // Lead intake webhook — n8n workflow "JW Website Lead Intake" (id lEWEKZubGriIj2sN)
  // Fans out to GHL Upsert + Notion Log + Slack Notify (#jw-leadteam C0AEWAS4Y6N).
  // SOP: AUTOMATION_SOP.md (Tim's Mac copy) and Memory API "JourneyWell Website Lead Automation".
  const GHL_WEBHOOK_URL = 'https://n8n.journeywellhub.com/webhook/jw-lead';

  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  // Blog posts should mark "Journal" as the active nav item
  const activeHref = IN_BLOG_POST ? 'blog.html' : here;

  // ---------- NAV ----------
  function megapanelLinkHtml(link) {
    const iconHtml = link.icon ? `<span class="megapanel-link-icon">${icon(link.icon, { size: 16 })}</span>` : '';
    const subHtml  = link.sub ? `<span class="megapanel-link-sub">${link.sub}</span>` : '';
    const attrs    = link.drawer
      ? `href="javascript:void(0)" data-open-drawer-with="${link.drawer}"`
      : `href="${PATH_PREFIX}${link.href}"`;
    return `<a class="megapanel-link" ${attrs}>
        ${iconHtml}
        <span class="megapanel-link-text">
          <span class="megapanel-link-title">${link.label}</span>
          ${subHtml}
        </span>
      </a>`;
  }
  function megapanelHtml(panel) {
    const cols = panel.cols.map(col => `
      <div class="megapanel-col">
        <div class="megapanel-col-heading">${col.heading}</div>
        <div class="megapanel-col-links">${col.links.map(megapanelLinkHtml).join('')}</div>
      </div>
    `).join('');
    const f = panel.featured;
    const media = f && f.media ? `
      <div class="megapanel-featured-media" data-nav-media-tag="${f.media.tag || ''}">
        ${f.media.poster ? `<img src="${PATH_PREFIX}${f.media.poster}" alt="" loading="lazy">` : ''}
      </div>
    ` : '';
    const featured = f ? `
      <div class="megapanel-featured">
        ${media}
        ${f.eyebrow ? `<div class="megapanel-featured-eyebrow">${f.eyebrow}</div>` : ''}
        <div class="megapanel-featured-title">${f.title}</div>
        ${f.body ? `<p class="megapanel-featured-body">${f.body}</p>` : ''}
        ${f.ctaHref ? `<a class="megapanel-featured-cta" href="${PATH_PREFIX}${f.ctaHref}">${f.ctaLabel || 'Learn more'} →</a>` : ''}
      </div>
    ` : '';
    return `<div class="megapanel" role="region" aria-hidden="true">
      <div class="megapanel-inner">
        <div class="megapanel-cols">${cols}</div>
        ${featured}
      </div>
    </div>`;
  }
  function navItemHtml(item) {
    const isActive = item.href === activeHref;
    if (!item.panel) {
      return `<a class="nav-link ${isActive ? 'active' : ''}" href="${PATH_PREFIX}${item.href}">${item.label}</a>`;
    }
    return `<div class="nav-item-mega ${isActive ? 'active' : ''}">
      <a class="nav-link nav-link-mega" href="${PATH_PREFIX}${item.href}" aria-haspopup="true" aria-expanded="false">
        ${item.label}
        <span class="nav-chevron">${icon('chevronDown', { size: 14 })}</span>
      </a>
      ${megapanelHtml(item.panel)}
    </div>`;
  }
  function navHtml() {
    return `
      <header class="nav">
        <div class="container nav-inner">
          <a href="${PATH_PREFIX}index.html" class="logo">
            <img class="logo-mark" src="${PATH_PREFIX}images/jw-logo.png" alt="" aria-hidden="true">
            <span class="logo-text">JourneyWell</span>
          </a>
          <nav class="nav-links">
            ${MENU.map(navItemHtml).join('')}
          </nav>
          <div class="nav-cta">
            <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle light/dark theme">
              <span class="icon-sun">${icon('sun', { size: 18 })}</span>
              <span class="icon-moon">${icon('moon', { size: 18 })}</span>
            </button>
            <button class="btn btn-gold" data-open-drawer>Get Started</button>
            <button class="nav-hamburger" id="navHamburger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
              <span class="hamburger-bar"></span>
              <span class="hamburger-bar"></span>
              <span class="hamburger-bar"></span>
            </button>
          </div>
        </div>
        <nav class="mobile-nav" id="mobileNav" aria-label="Mobile navigation">
          ${PAGES.map(p => `<a href="${PATH_PREFIX}${p.href}" class="${p.href === activeHref ? 'active' : ''}">${p.label}</a>`).join('')}
        </nav>
      </header>
    `;
  }

  // ---------- FOOTER ----------
  function footerHtml() {
    const allPages = PAGES.concat(SUB_PAGES);
    return `
      <footer class="footer">
        <div class="container footer-inner">
          <a href="${PATH_PREFIX}index.html" class="logo">
            <img class="logo-mark" src="${PATH_PREFIX}images/jw-logo.png" alt="" aria-hidden="true">
            <span class="logo-text">JourneyWell</span>
          </a>
          <div class="footer-meta">
            ${allPages.map(p => `<a href="${PATH_PREFIX}${p.href}">${p.label}</a>`).join('')}
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
          <div class="footer-meta">© 2026 JourneyWell</div>
        </div>
      </footer>
    `;
  }

  // ---------- ICONS (Lucide-style flat SVGs, inlined) ----------
  const ICONS = {
    play:        '<path d="M8 5v14l11-7z"/>',
    pause:       '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
    arrowRight:  '<path d="M5 12h14M13 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    arrowUpRight:'<path d="M7 17L17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    close:       '<path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    expand:      '<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    check:       '<path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    minus:       '<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    mic:         '<path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM5 11v1a7 7 0 0014 0v-1M12 19v3M8 22h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    video:       '<path d="M23 7l-7 5 7 5V7zM3 5h11a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    layers:      '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    rocket:      '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 014-7c1.91-2.84 5.93-3.99 9-4 0 3.07-1.16 7.09-4 9a22 22 0 01-7 4zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    sparkles:    '<path d="M12 3l1.9 5.5L19 10l-5.1 1.5L12 17l-1.9-5.5L5 10l5.1-1.5L12 3zM19 17l.9 2.5L22 20l-2.1.5L19 23l-.9-2.5L16 20l2.1-.5L19 17zM5 17l.9 2.5L8 20l-2.1.5L5 23l-.9-2.5L2 20l2.1-.5L5 17z" fill="currentColor"/>',
    bolt:        '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    eye:         '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
    headphones:  '<path d="M3 18v-6a9 9 0 0118 0v6M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    calendar:    '<rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    target:      '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
    grid:        '<rect x="3" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/>',
    sliders:     '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    users:       '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
    quote:       '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h2c0 .75-.5 4-3 4M14 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h2c0 .75-.5 4-3 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    book:        '<path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    star:        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>',
    sun:         '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    moon:        '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    chevronDown: '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    building:    '<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 9h.01M9 12h.01M9 15h.01M9 18h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    home:        '<path d="M3 12l9-9 9 9M5 10v10h14V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    heart:       '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    camera:      '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
    chevronUp:   '<path d="M18 15l-6-6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    message:     '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    share:       '<circle cx="18" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    bookmark:    '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    volume:      '<path d="M11 5L6 9H2v6h4l5 4V5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    volumeOff:   '<path d="M11 5L6 9H2v6h4l5 4V5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 9l-6 6M17 9l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    expandArrows:'<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  function icon(name, opts) {
    const o = opts || {};
    const sz = o.size || 24;
    const cls = o.class || 'icon';
    const inner = ICONS[name] || '';
    // `fill="currentColor"` so filled paths (play, pause) inherit the parent
    // text color instead of SVG's default black — paths that set their own
    // `fill="none"` or `fill="currentColor"` override this and stay correct.
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${inner}</svg>`;
  }
  // Swap any [data-icon="name"] element for its flat SVG. Idempotent + re-callable
  // so dynamically-injected markup (e.g. the reels feed built via innerHTML) also
  // gets flat icons. SVGs use currentColor, so they inherit the element's text
  // color and flip automatically with the light/dark theme.
  function hydrateIcons(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-icon]:not([data-icon-done])').forEach((el) => {
      const name = el.getAttribute('data-icon');
      if (!ICONS[name]) return;
      const sz = parseInt(el.getAttribute('data-icon-size'), 10) || 18;
      el.innerHTML = icon(name, { size: sz });
      el.setAttribute('data-icon-done', '');
    });
  }

  // ---------- FLOATING BUTTON ----------
  function floatBtnHtml() {
    return `<button class="float-btn" data-open-drawer>Get Started</button>`;
  }

  // ---------- DRAWER (multi-step form) ----------
  function drawerHtml() {
    return `
      <div class="drawer-overlay" id="drawerOverlay"></div>
      <aside class="drawer" id="drawer" role="dialog" aria-label="Get started">
        <header class="drawer-header">
          <div class="drawer-step-indicator" id="drawerStepIndicator">Step 1 of 4</div>
          <button class="drawer-close" data-close-drawer aria-label="Close" data-icon="close" data-icon-size="18"></button>
        </header>
        <div class="drawer-body" id="drawerBody">
          <div class="drawer-progress"><div class="drawer-progress-fill" id="drawerProgressFill"></div></div>

          <!-- STEP 1 -->
          <section class="drawer-step active" data-step="1">
            <div class="drawer-eyebrow">Tell us where to start</div>
            <h2 class="drawer-title">What brings you here?</h2>
            <p class="drawer-sub">Pick the closest match. We'll route you to the right next step — no commitment yet.</p>
            <div class="drawer-options" id="pathOptions">
              <button class="drawer-option" data-path="studio">
                <div class="drawer-option-text">
                  <div class="drawer-option-title">Book the studio</div>
                  <div class="drawer-option-desc">I want to record one or more sessions in JourneyWell's studio.</div>
                </div>
                <div class="drawer-option-arrow">→</div>
              </button>
              <button class="drawer-option" data-path="podcast">
                <div class="drawer-option-text">
                  <div class="drawer-option-title">Start a podcast</div>
                  <div class="drawer-option-desc">I want a full launch — production, branding, and distribution.</div>
                </div>
                <div class="drawer-option-arrow">→</div>
              </button>
              <button class="drawer-option" data-path="shorts">
                <div class="drawer-option-text">
                  <div class="drawer-option-title">Get a stack of shorts</div>
                  <div class="drawer-option-desc">I want short-form clips and reels — captioned, packaged, ready to post.</div>
                </div>
                <div class="drawer-option-arrow">→</div>
              </button>
              <button class="drawer-option" data-path="authority">
                <div class="drawer-option-text">
                  <div class="drawer-option-title">Build content authority</div>
                  <div class="drawer-option-desc">I want the full system — one recording, multiplied across every platform.</div>
                </div>
                <div class="drawer-option-arrow">→</div>
              </button>
              <button class="drawer-option" data-path="learn">
                <div class="drawer-option-text">
                  <div class="drawer-option-title">Just exploring</div>
                  <div class="drawer-option-desc">Show me what JourneyWell does. I'm not sure what I need yet.</div>
                </div>
                <div class="drawer-option-arrow">→</div>
              </button>
            </div>
          </section>

          <!-- STEP 2 — branch-specific qualifiers (rendered dynamically) -->
          <section class="drawer-step" data-step="2">
            <div class="drawer-eyebrow" id="step2Eyebrow">Tell us a bit more</div>
            <h2 class="drawer-title" id="step2Title">A few quick questions</h2>
            <p class="drawer-sub" id="step2Sub">This helps us route you to the right person.</p>
            <div id="step2Body"></div>
          </section>

          <!-- STEP 3 — contact info -->
          <section class="drawer-step" data-step="3">
            <div class="drawer-eyebrow">Almost there</div>
            <h2 class="drawer-title">Where can we reach you?</h2>
            <p class="drawer-sub">We'll only use this to get you to the right next step.</p>
            <div class="drawer-form-group">
              <label>Full name</label>
              <input type="text" id="contactName" placeholder="Your name" />
            </div>
            <div class="drawer-form-group">
              <label>Email</label>
              <input type="email" id="contactEmail" placeholder="you@example.com" />
            </div>
            <div class="drawer-form-group">
              <label>Phone (optional)</label>
              <input type="tel" id="contactPhone" placeholder="+1 (555) 555-5555" />
            </div>
            <div class="drawer-form-group">
              <label>Anything else we should know? (optional)</label>
              <textarea id="contactNotes" placeholder="Quick context, timeline, the goal you have in mind..."></textarea>
            </div>
          </section>

          <!-- STEP 4 — confirmation -->
          <section class="drawer-step" data-step="4">
            <div class="drawer-eyebrow gold">Done</div>
            <h2 class="drawer-title">We'll be in touch within one business day.</h2>
            <p class="drawer-sub" id="confirmSub">Your inquiry is on its way to the JourneyWell team. Expect a personal email — not a no-reply autoresponder.</p>
            <div class="drawer-options">
              <button class="drawer-option" onclick="window.location.href='${PATH_PREFIX}work.html'">
                <div class="drawer-option-text">
                  <div class="drawer-option-title">Browse our work</div>
                  <div class="drawer-option-desc">See recent episodes, reels, and series.</div>
                </div>
                <div class="drawer-option-arrow">→</div>
              </button>
              <button class="drawer-option" onclick="window.location.href='${PATH_PREFIX}authority.html'">
                <div class="drawer-option-text">
                  <div class="drawer-option-title">Read about the Authority System</div>
                  <div class="drawer-option-desc">How one recording becomes thirty pieces of content.</div>
                </div>
                <div class="drawer-option-arrow">→</div>
              </button>
            </div>
          </section>
        </div>
        <footer class="drawer-footer">
          <button class="drawer-back" id="drawerBack" disabled>← Back</button>
          <button class="btn btn-gold" id="drawerNext" style="display:none;">Continue →</button>
          <span style="font-size:13px; color:var(--text-tertiary)" id="drawerHint">Press ESC to close</span>
        </footer>
      </aside>
    `;
  }

  // ---------- STEP 2 CONTENT PER PATH ----------
  const STEP2 = {
    studio: {
      eyebrow: 'Pick your session length',
      title: 'How long do you need the studio?',
      sub: 'Pick the length that fits and we\'ll follow up to confirm availability.',
      body: `
        <div class="drawer-form-group">
          <label>Studio session length</label>
          <div class="drawer-pill-group" data-single-pill="studioHours">
            <button class="drawer-pill studio-hour-pill" data-val="2"><span class="hr">2 hr</span></button>
            <button class="drawer-pill studio-hour-pill" data-val="3"><span class="hr">3 hr</span></button>
            <button class="drawer-pill studio-hour-pill" data-val="4"><span class="hr">4 hr</span></button>
            <button class="drawer-pill studio-hour-pill" data-val="5"><span class="hr">5 hr</span></button>
            <button class="drawer-pill studio-hour-pill" data-val="6"><span class="hr">6 hr</span></button>
            <button class="drawer-pill studio-hour-pill" data-val="7"><span class="hr">7 hr</span></button>
            <button class="drawer-pill studio-hour-pill" data-val="8"><span class="hr">8 hr</span></button>
          </div>
        </div>
      `,
    },
    shorts: {
      eyebrow: 'Tell us about the shorts',
      title: 'What kind of clips do you need?',
      sub: 'A few quick details so we can put together a quote that fits your volume and your platforms.',
      body: `
        <div class="drawer-form-group">
          <label>How many short-form clips per month?</label>
          <div class="drawer-pill-group" data-single-pill="shortsVolume">
            <button class="drawer-pill" data-val="1-5">1–5</button>
            <button class="drawer-pill" data-val="6-15">6–15</button>
            <button class="drawer-pill" data-val="16-30">16–30</button>
            <button class="drawer-pill" data-val="30+">30+</button>
          </div>
        </div>
        <div class="drawer-form-group">
          <label>Where will they live?</label>
          <div class="drawer-pill-group" data-multi-pill="shortsPlatforms">
            <button class="drawer-pill" data-val="instagram">Instagram</button>
            <button class="drawer-pill" data-val="tiktok">TikTok</button>
            <button class="drawer-pill" data-val="youtube">YouTube Shorts</button>
            <button class="drawer-pill" data-val="linkedin">LinkedIn</button>
            <button class="drawer-pill" data-val="x">X / Twitter</button>
          </div>
        </div>
        <div class="drawer-form-group">
          <label>Do you have source footage already?</label>
          <div class="drawer-pill-group" data-single-pill="shortsSource">
            <button class="drawer-pill" data-val="yes-lots">Yes, hours of it</button>
            <button class="drawer-pill" data-val="some">Some</button>
            <button class="drawer-pill" data-val="need-record">Need to record first</button>
          </div>
        </div>
      `,
    },
    podcast: {
      eyebrow: 'About your podcast',
      title: 'Tell us about the show you want to launch.',
      sub: 'A few details about the show, host, and goals.',
      body: `
        <div class="drawer-form-group">
          <label>What stage are you at?</label>
          <div class="drawer-pill-group" data-single-pill="podcastStage">
            <button class="drawer-pill" data-val="idea">Idea only</button>
            <button class="drawer-pill" data-val="concept">Concept + name</button>
            <button class="drawer-pill" data-val="recorded">Have some episodes</button>
            <button class="drawer-pill" data-val="published">Already published</button>
          </div>
        </div>
        <div class="drawer-form-group">
          <label>How many hosts?</label>
          <div class="drawer-pill-group" data-single-pill="podcastHosts">
            <button class="drawer-pill" data-val="1">Solo</button>
            <button class="drawer-pill" data-val="2">Two</button>
            <button class="drawer-pill" data-val="3+">3+</button>
            <button class="drawer-pill" data-val="rotating">Rotating</button>
          </div>
        </div>
        <div class="drawer-form-group">
          <label>What's the goal?</label>
          <textarea id="podcastGoal" placeholder="Authority, lead gen, audience growth, brand presence..."></textarea>
        </div>
      `,
    },
    authority: {
      eyebrow: 'About your authority play',
      title: 'Tell us about your audience and content goals.',
      sub: 'The Authority System works best when we know who you\'re building for.',
      body: `
        <div class="drawer-form-group">
          <label>What do you do?</label>
          <input type="text" id="authorityRole" placeholder="Founder, coach, financial advisor, agency owner..." />
        </div>
        <div class="drawer-form-group">
          <label>Who are you building authority with?</label>
          <input type="text" id="authorityAudience" placeholder="Other founders, ICPs in [industry], buyers in [segment]..." />
        </div>
        <div class="drawer-form-group">
          <label>How active is your content right now?</label>
          <div class="drawer-pill-group" data-single-pill="authorityActivity">
            <button class="drawer-pill" data-val="dormant">Mostly dormant</button>
            <button class="drawer-pill" data-val="sporadic">Sporadic</button>
            <button class="drawer-pill" data-val="weekly">Weekly</button>
            <button class="drawer-pill" data-val="daily">Daily</button>
          </div>
        </div>
      `,
    },
    learn: {
      eyebrow: 'Help us help you',
      title: 'What\'s the rough shape of what you\'re looking for?',
      sub: 'No wrong answers — this is just to point you to the most useful next read.',
      body: `
        <div class="drawer-form-group">
          <label>Which of these sounds closest?</label>
          <div class="drawer-pill-group" data-multi-pill="learnInterest">
            <button class="drawer-pill" data-val="studio">Just need a studio</button>
            <button class="drawer-pill" data-val="podcast">Want a podcast</button>
            <button class="drawer-pill" data-val="authority">Want the full system</button>
            <button class="drawer-pill" data-val="case">Want to see case studies</button>
            <button class="drawer-pill" data-val="pricing">Just curious about pricing</button>
          </div>
        </div>
      `,
    },
  };

  // ---------- DRAWER STATE + LOGIC ----------
  const state = { step: 1, path: null, payload: {} };

  function openDrawer(preselect) {
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (preselect) {
      const opt = document.querySelector(`[data-path="${preselect}"]`);
      if (opt) opt.click();
    }
  }
  function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(resetDrawer, 320);
  }
  function resetDrawer() {
    state.step = 1; state.path = null; state.payload = {};
    showStep(1);
    document.querySelectorAll('.drawer-option.selected').forEach(o => o.classList.remove('selected'));
  }
  function showStep(n) {
    state.step = n;
    const isStudio = state.path === 'studio';
    const totalSteps = isStudio ? 2 : 4;
    document.querySelectorAll('.drawer-step').forEach(s => {
      s.classList.toggle('active', String(s.dataset.step) === String(n));
    });
    document.getElementById('drawerStepIndicator').textContent = `Step ${n} of ${totalSteps}`;
    document.getElementById('drawerProgressFill').style.width = `${(n / totalSteps) * 100}%`;
    document.getElementById('drawerBack').toggleAttribute('disabled', n <= 1);
    const nextBtn = document.getElementById('drawerNext');
    nextBtn.style.display = (n >= 2 && n <= 3) ? '' : 'none';
    if (isStudio && n === 2) {
      nextBtn.textContent = 'Continue to checkout →';
    } else {
      nextBtn.textContent = n === 3 ? 'Submit →' : 'Continue →';
    }
    document.getElementById('drawerHint').textContent = n === 4 ? '' : 'Press ESC to close';
    document.getElementById('drawerBody').scrollTop = 0;
  }
  function selectPath(path) {
    state.path = path;
    document.querySelectorAll('#pathOptions .drawer-option').forEach(o =>
      o.classList.toggle('selected', o.dataset.path === path)
    );
    setTimeout(() => goStep(2), 280);
  }
  function goStep(n) {
    if (n === 2) {
      const cfg = STEP2[state.path] || STEP2.learn;
      document.getElementById('step2Eyebrow').textContent = cfg.eyebrow;
      document.getElementById('step2Title').textContent = cfg.title;
      document.getElementById('step2Sub').textContent = cfg.sub;
      document.getElementById('step2Body').innerHTML = cfg.body;
      hookPills();
    }
    if (n === 4) {
      const sub = {
        studio:    "Your studio booking inquiry is on its way. We'll confirm availability and a quote within one business day.",
        podcast:   "Your podcast launch inquiry is on its way. We'll send a custom roadmap and pricing within one business day.",
        shorts:    "Your Shorts package inquiry is on its way. We'll send a custom quote based on your volume and platforms within one business day.",
        authority: "Your Authority System inquiry is on its way. We'll send a content audit and a custom plan within one business day.",
        learn:     "Thanks for the context. We'll send a short note pointing you to the most useful next step.",
      }[state.path] || '';
      if (sub) document.getElementById('confirmSub').textContent = sub;
    }
    showStep(n);
  }
  function hookPills() {
    document.querySelectorAll('[data-single-pill]').forEach(group => {
      group.querySelectorAll('.drawer-pill').forEach(p => p.addEventListener('click', () => {
        group.querySelectorAll('.drawer-pill').forEach(x => x.classList.remove('selected'));
        p.classList.add('selected');
      }));
    });
    document.querySelectorAll('[data-multi-pill]').forEach(group => {
      group.querySelectorAll('.drawer-pill').forEach(p => p.addEventListener('click', () => {
        p.classList.toggle('selected');
      }));
    });
  }
  // Wire form submissions to formsubmit.co. First submission triggers an email
  // verification to FORM_TARGET — click the link in your inbox once and all future
  // submissions land in that inbox. Replace FORM_TARGET to change recipient.
  const FORM_TARGET = 'team@journeywell.io';
  const FORM_ENDPOINT = `https://formsubmit.co/ajax/${encodeURIComponent(FORM_TARGET)}`;

  async function submitForm() {
    const name  = document.getElementById('contactName')?.value || '';
    const email = document.getElementById('contactEmail')?.value || '';
    const phone = document.getElementById('contactPhone')?.value || '';
    const notes = document.getElementById('contactNotes')?.value || '';

    // Basic validation
    if (!name.trim() || !email.trim()) {
      alert('Please fill in your name and email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email.');
      return;
    }

    // Collect step-2 selections
    const extra = {};
    document.querySelectorAll('[data-single-pill]').forEach(g => {
      const sel = g.querySelector('.drawer-pill.selected');
      if (sel) extra[g.dataset.singlePill] = sel.dataset.val;
    });
    document.querySelectorAll('[data-multi-pill]').forEach(g => {
      const vals = [...g.querySelectorAll('.drawer-pill.selected')].map(s => s.dataset.val);
      if (vals.length) extra[g.dataset.multiPill] = vals.join(', ');
    });
    // Free-text inputs in step-2 (e.g. authorityRole, podcastGoal)
    ['podcastGoal', 'authorityRole', 'authorityAudience'].forEach(id => {
      const v = document.getElementById(id)?.value;
      if (v) extra[id] = v;
    });

    const subjectMap = {
      studio:    'New JW inquiry — Studio booking',
      podcast:   'New JW inquiry — Podcast launch',
      shorts:    'New JW inquiry — Shorts package',
      authority: 'New JW inquiry — Authority System',
      learn:     'New JW inquiry — General',
    };

    const body = {
      _subject: subjectMap[state.path] || 'New JW inquiry',
      _template: 'table',
      _captcha: 'false',
      path: state.path || 'unknown',
      name, email, phone, notes,
      ...extra,
      submitted_at: new Date().toISOString(),
      page: location.pathname,
    };

    // Show inline-loading on the next button
    const nextBtn = document.getElementById('drawerNext');
    const origText = nextBtn.textContent;
    nextBtn.textContent = 'Sending...';
    nextBtn.disabled = true;

    // Fire to GHL inbound webhook (if configured) AND formsubmit in parallel.
    // Lead is "successful" if either accepts it — formsubmit emails Tim, GHL fires the workflow.
    const requests = [
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => ({ source: 'formsubmit', ok: r.ok, status: r.status })).catch(e => ({ source: 'formsubmit', ok: false, error: String(e) })),
    ];
    if (GHL_WEBHOOK_URL) {
      requests.push(
        fetch(GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(r => ({ source: 'ghl', ok: r.ok, status: r.status })).catch(e => ({ source: 'ghl', ok: false, error: String(e) }))
      );
    }

    try {
      const results = await Promise.all(requests);
      console.log('JW form submitted:', { results, body });
      const anyOk = results.some(r => r.ok);
      if (anyOk) {
        goStep(4);
      } else {
        alert('Sorry — that didn\'t go through. Please email team@journeywell.io directly.');
        nextBtn.textContent = origText;
        nextBtn.disabled = false;
      }
    } catch (e) {
      console.error('JW form submit failed:', e);
      alert('Network error. Please email team@journeywell.io directly.');
      nextBtn.textContent = origText;
      nextBtn.disabled = false;
    }
  }

  // ---------- INSTALL ----------
  function installChrome() {
    // Insert nav at top of body, footer + float-btn + drawer at bottom
    const navMount = document.createElement('div');
    navMount.innerHTML = navHtml();
    document.body.insertBefore(navMount.firstElementChild, document.body.firstChild);

    const tail = document.createElement('div');
    tail.innerHTML = footerHtml() + floatBtnHtml() + drawerHtml();
    while (tail.firstElementChild) document.body.appendChild(tail.firstElementChild);

    // Wire events
    document.querySelectorAll('[data-open-drawer]').forEach(el =>
      el.addEventListener('click', () => openDrawer())
    );
    document.querySelectorAll('[data-close-drawer]').forEach(el =>
      el.addEventListener('click', closeDrawer)
    );
    document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
    document.querySelectorAll('#pathOptions .drawer-option').forEach(opt =>
      opt.addEventListener('click', () => selectPath(opt.dataset.path))
    );
    document.getElementById('drawerBack').addEventListener('click', () => goStep(state.step - 1));
    document.getElementById('drawerNext').addEventListener('click', () => {
      if (state.step === 3) submitForm();
      else goStep(state.step + 1);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('drawer').classList.contains('open')) closeDrawer();
    });

    // Honor [data-open-drawer-with="path"] on any in-page CTA
    document.querySelectorAll('[data-open-drawer-with]').forEach(el =>
      el.addEventListener('click', () => openDrawer(el.dataset.openDrawerWith))
    );

    // Swap any [data-icon] placeholders for flat SVGs (theme-aware via currentColor).
    // A MutationObserver re-runs the swap so dynamically-injected markup (e.g. the
    // reels feed built via innerHTML) gets flat icons too — no per-callsite wiring.
    hydrateIcons(document);
    if (window.MutationObserver) {
      let scheduled = false;
      const obs = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; hydrateIcons(document); });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }

    // Theme toggle
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('jw-theme', next); } catch (e) {}
      });
    }

    // Mobile hamburger
    const hamburger = document.getElementById('navHamburger');
    const mobileNav = document.getElementById('mobileNav');
    if (hamburger && mobileNav) {
      const setOpen = (open) => {
        document.body.classList.toggle('mobile-nav-open', open);
        hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      hamburger.addEventListener('click', () => {
        setOpen(!document.body.classList.contains('mobile-nav-open'));
      });
      mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.body.classList.contains('mobile-nav-open')) setOpen(false);
      });
    }

    // Hero brand video (single top-of-page video, tag `live-feed:hero` cap 1)
    initHeroVideo();

    // Hero carousel (3-up coverflow, tag `live-feed:carousel` cap 6)
    initHeroCarousel();

    // Scroll reveal animations (Apple/Blaksheep style)
    initScrollReveal();

    // Profile pictures pulled from creator-tunnel (any [data-profile-pic="<slug>"])
    initProfilePictures();

    // Mega-menu hover/click/keyboard behavior
    initMegaMenu();
  }

  // ---------- MEGA-MENU ----------
  // Vimeo-style: hover the top-level item, its panel fades in below the nav.
  // Click also opens (touch-friendly). Outside-click and Escape close.
  // The 200ms hover-out delay gives a forgiving cursor path from the nav link
  // down into the panel without it snapping shut mid-traverse.
  function initMegaMenu() {
    const items = document.querySelectorAll('.nav-item-mega');
    if (!items.length) return;
    const HOVER_OPEN_MS  = 80;
    const HOVER_CLOSE_MS = 200;
    const openTimers  = new WeakMap();
    const closeTimers = new WeakMap();

    function openItem(item) {
      // Close any sibling that's open (only one panel at a time).
      items.forEach(other => { if (other !== item) closeItem(other, true); });
      item.classList.add('is-open');
      const link = item.querySelector('.nav-link-mega');
      if (link) link.setAttribute('aria-expanded', 'true');
      const panel = item.querySelector('.megapanel');
      if (panel) panel.setAttribute('aria-hidden', 'false');
      // First-hover lazy-load of the featured-media video from creator-tunnel.
      hydrateMegaMenuMedia(item);
    }
    function closeItem(item, immediate) {
      if (immediate) {
        item.classList.remove('is-open');
        const link = item.querySelector('.nav-link-mega');
        if (link) link.setAttribute('aria-expanded', 'false');
        const panel = item.querySelector('.megapanel');
        if (panel) panel.setAttribute('aria-hidden', 'true');
      }
    }

    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        clearTimeout(closeTimers.get(item));
        openTimers.set(item, setTimeout(() => openItem(item), HOVER_OPEN_MS));
      });
      item.addEventListener('mouseleave', () => {
        clearTimeout(openTimers.get(item));
        closeTimers.set(item, setTimeout(() => closeItem(item, true), HOVER_CLOSE_MS));
      });
      // Click on the top-level link toggles (and stops the navigation so the
      // panel can show first; second click follows the link).
      const link = item.querySelector('.nav-link-mega');
      if (link) {
        link.addEventListener('click', e => {
          // If panel is already open, allow the navigation to proceed.
          if (item.classList.contains('is-open')) return;
          e.preventDefault();
          openItem(item);
        });
        // Keyboard: open on focus so tab-through users can see the menu.
        link.addEventListener('focus', () => openItem(item));
      }
    });

    // Click anywhere outside any mega item closes them all.
    document.addEventListener('click', e => {
      if (e.target.closest('.nav-item-mega')) return;
      items.forEach(item => closeItem(item, true));
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') items.forEach(item => closeItem(item, true));
    });
  }

  // Fetch the creator-tunnel asset matching the panel's `data-nav-media-tag`
  // and swap a looping <video> in over the poster. Runs once per item (a
  // `data-nav-media-state` flag short-circuits subsequent hovers).
  async function hydrateMegaMenuMedia(item) {
    const frame = item.querySelector('.megapanel-featured-media');
    if (!frame) return;
    if (frame.dataset.navMediaState) return;
    const tag = frame.dataset.navMediaTag;
    if (!tag) return;
    frame.dataset.navMediaState = 'loading';
    const ctUrl = resolveCreatorTunnelUrl();
    if (!ctUrl) { frame.dataset.navMediaState = 'no-ct'; return; }
    try {
      const res = await fetch(`${ctUrl}/api/assets?tag=${encodeURIComponent(tag)}&limit=1`, { cache: 'no-store' });
      if (!res.ok) { frame.dataset.navMediaState = 'http-' + res.status; return; }
      const data = await res.json();
      const asset = (data.items || [])[0];
      if (!asset || typeof asset.cdn_url !== 'string' || !asset.cdn_url.startsWith('https://')) {
        frame.dataset.navMediaState = 'empty';
        return;
      }
      const isVideo = /\.(mp4|webm|mov)(\?|#|$)/i.test(asset.cdn_url);
      const isImage = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(asset.cdn_url);
      if (isVideo) {
        const v = document.createElement('video');
        v.src = asset.cdn_url;
        v.autoplay = true; v.muted = true; v.loop = true; v.playsInline = true;
        v.preload = 'metadata';
        v.setAttribute('muted', '');
        v.setAttribute('loop', '');
        v.setAttribute('playsinline', '');
        if (typeof asset.thumbnail_url === 'string' && asset.thumbnail_url.startsWith('https://')) {
          v.poster = asset.thumbnail_url;
        }
        frame.appendChild(v);
        frame.classList.add('has-video');
        frame.dataset.navMediaState = 'video';
      } else if (isImage) {
        // No image yet? swap the poster for the tagged still.
        const existing = frame.querySelector('img');
        const img = existing || document.createElement('img');
        img.src = asset.cdn_url;
        img.alt = '';
        img.loading = 'lazy';
        if (!existing) frame.appendChild(img);
        frame.dataset.navMediaState = 'image';
      } else {
        frame.dataset.navMediaState = 'unsupported';
      }
    } catch (e) {
      console.warn('[nav-media] fetch failed for tag', tag, e);
      frame.dataset.navMediaState = 'error';
    }
  }

  // ---------- SCROLL REVEAL ----------
  // Adds `.reveal` to interesting page elements, then watches them with
  // IntersectionObserver and adds `.is-in-view` when they enter the viewport,
  // which triggers a fade + slide-up + soft blur-clear animation.
  function initScrollReveal() {
    // Bail in reduced-motion mode — just show everything as-is.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    function inExcludedRegion(el) {
      return el.closest('.lite-hero')
          || el.closest('.nav')
          || el.closest('.footer')
          || el.closest('.drawer');
    }

    // Blanket pass: every direct child of every section's main container
    // gets reveal. Catches plain <div> wrappers (.lite-stats etc.) that
    // would otherwise pop in without animation. Hero excluded.
    document.querySelectorAll(
      '.lite-section .lite-container > *,' +
      '.lite-section .lite-narrow > *,' +
      '.lite-cta .lite-container > *'
    ).forEach(function (el) {
      if (inExcludedRegion(el)) return;
      el.classList.add('reveal');
    });

    // Targeted selectors for things outside the .lite-section + .lite-container
    // pattern (work.html, podcast.html etc).
    const EXTRA_SELECTORS = [
      '.work-strip .show-card',
      '.work-strip-title',
      '.hero-piece-info > *',
      '.channel-banner > *',
      '.lite-founders',
      '.lite-founders > *',
    ];
    EXTRA_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (inExcludedRegion(el)) return;
        el.classList.add('reveal');
      });
    });

    // Stagger containers — children cascade in
    document.querySelectorAll(
      '.lite-tile-grid, .lite-grid, .lite-stats, .lite-founders'
    ).forEach(function (container) {
      container.classList.add('reveal-stagger');
      Array.from(container.children).forEach(function (child) {
        if (!child.classList.contains('reveal')) child.classList.add('reveal');
      });
    });

    if (!('IntersectionObserver' in window)) {
      // Old browsers — just show everything
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('is-in-view');
      });
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in-view');
          observer.unobserve(entry.target);  // play once
        }
      });
    }, {
      // Shrink the observed viewport from the bottom by 15% so animations
      // fire when elements scroll into the upper ~85% of the screen — they
      // start fading as soon as they're meaningfully on-screen, not after.
      threshold: 0.05,
      rootMargin: '0px 0px -15% 0px'
    });

    document.querySelectorAll('.reveal').forEach(function (el) {
      observer.observe(el);
    });

    // Bottom-of-page fallback: the strict `-35%` trigger line can never be
    // reached by elements at the very bottom of the page (founders, CTA),
    // because the page can't scroll past its own bottom. When the user
    // is within 120px of the page bottom, force-reveal anything that's
    // still waiting.
    function revealNearBottom() {
      const reachedBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
      if (!reachedBottom) return;
      document.querySelectorAll('.reveal:not(.is-in-view)').forEach(function (el) {
        // Only reveal if the element is already in the viewport at all
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('is-in-view');
        }
      });
    }
    let scrollRaf;
    window.addEventListener('scroll', function () {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(revealNearBottom);
    }, { passive: true });
    // Run once on init in case the page is already short / scrolled to bottom
    revealNearBottom();
  }

  // ---------- PROFILE PICTURES ----------
  // Any element with data-profile-pic="<client-slug>" gets its inner content
  // replaced by an <img> of the latest creator-tunnel asset tagged
  // `profile-picture:<slug>`. Silent failure if the API is unreachable, the
  // tag has no asset, or the asset has a broken legacy Frame.io URL.
  function initProfilePictures() {
    const els = document.querySelectorAll('[data-profile-pic]');
    if (!els.length) return;
    const ctUrl = resolveCreatorTunnelUrl();
    if (!ctUrl) return;
    const cache = new Map(); // slug -> Promise<asset|null>, dedupes parallel fetches
    function fetchOne(slug) {
      if (cache.has(slug)) return cache.get(slug);
      const p = (async () => {
        try {
          const r = await fetch(`${ctUrl}/api/assets?tag=profile-picture:${encodeURIComponent(slug)}&limit=1`, { cache: 'no-store' });
          if (!r.ok) return null;
          const d = await r.json();
          return (d.items && d.items[0]) || null;
        } catch { return null; }
      })();
      cache.set(slug, p);
      return p;
    }
    els.forEach(async (el) => {
      const slug = el.dataset.profilePic;
      if (!slug) return;
      const asset = await fetchOne(slug);
      if (!asset) return;
      const src = asset.cdn_url || asset.thumbnail_url;
      // Skip legacy too-big-Frame.io fallback URLs (see handoffs/02-cdn-link.md)
      if (!src || /^https:\/\/assets\.frame\.io\//.test(src)) return;
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      el.replaceChildren(img);
    });
  }

  // ---------- HERO CAROUSEL ----------
  // Resolve creator-tunnel base URL (same rules as work.html live-feed integration)
  function resolveCreatorTunnelUrl() {
    if (typeof window !== 'undefined' && window.CREATOR_TUNNEL_URL) return window.CREATOR_TUNNEL_URL;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'http://127.0.0.1:8787';
    // Default production fallback so the JW site works wherever it's hosted.
    return 'https://creator-tunnel.vercel.app';
  }

  // Try to swap the placeholder hero slides for assets tagged `live-feed:carousel`
  // in creator-tunnel. Returns the asset list keyed by slide order on success,
  // or null if we should keep the placeholder slides.
  async function fetchHeroAssets() {
    const ctUrl = resolveCreatorTunnelUrl();
    if (!ctUrl) return null;
    try {
      const res = await fetch(`${ctUrl}/api/assets?tag=live-feed:carousel&limit=6`, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      const playable = (data.items || []).filter(a =>
        typeof a.cdn_url === 'string' && a.cdn_url.startsWith('https://') &&
        /\.(mp4|webm|mov)(\?|#|$)/i.test(a.cdn_url)
      );
      // Coverflow needs ≥3 slides; below that, fall back to placeholders.
      return playable.length >= 3 ? playable.slice(0, 6) : null;
    } catch (e) {
      console.warn('[hero-carousel] live-feed:carousel fetch failed', e);
      return null;
    }
  }

  // ---------- HERO BRAND VIDEO (single, top of page) ----------
  // Fetches the one asset tagged `live-feed:hero` (cap 1 in creator-tunnel) and
  // injects a looping <video> into #heroVideoFrame. If nothing is tagged yet,
  // the existing "coming soon" placeholder stays visible.
  async function initHeroVideo() {
    const frame = document.getElementById('heroVideoFrame');
    if (!frame) return;
    const ctUrl = resolveCreatorTunnelUrl();
    if (!ctUrl) return;
    try {
      const res = await fetch(`${ctUrl}/api/assets?tag=live-feed:hero&limit=1`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const a = (data.items || [])[0];
      if (!a || typeof a.cdn_url !== 'string' || !a.cdn_url.startsWith('https://')) return;
      if (!/\.(mp4|webm|mov)(\?|#|$)/i.test(a.cdn_url)) return;
      const v = document.createElement('video');
      v.src = a.cdn_url;
      v.autoplay = true;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'metadata';
      v.setAttribute('muted', '');
      v.setAttribute('loop', '');
      v.setAttribute('playsinline', '');
      if (typeof a.thumbnail_url === 'string' && a.thumbnail_url.startsWith('https://')) {
        v.poster = a.thumbnail_url;
      }
      // Fade in only once the video can actually play — keeps the frame
      // empty during fetch + buffer instead of popping a frozen poster, then
      // the video slides up via the CSS opacity transition on data-ready.
      const markReady = () => v.setAttribute('data-ready', '1');
      v.addEventListener('canplay', markReady, { once: true });
      // Safari sometimes skips canplay when the file is already cached —
      // loadeddata + a readyState check both belt-and-suspender it.
      v.addEventListener('loadeddata', () => { if (v.readyState >= 3) markReady(); }, { once: true });
      frame.insertBefore(v, frame.firstChild);
      frame.classList.add('has-video');
    } catch (e) {
      console.warn('[hero-video] live-feed:hero fetch failed', e);
    }
  }

  function rebuildHeroSlides(stage, assets) {
    stage.querySelectorAll('.hero-slide').forEach(el => el.remove());
    const stageW = stage.getBoundingClientRect().width || 1;
    // Insert before the dots/arrows so slides remain the leading children
    const ref = stage.firstChild;
    assets.forEach((a, i) => {
      const fig = document.createElement('figure');
      fig.className = 'hero-slide';
      fig.setAttribute('data-pos', 'hidden');
      fig.setAttribute('data-asset-index', String(i));
      // Mount with preload='metadata' (moov atom only) so all 6 slides don't
      // fight for bandwidth at page load. syncSlideVideos play()s the current
      // one — with +faststart the moov is at byte 0, so playback begins as
      // soon as the first chunk arrives. Thumbnail rides as the poster so the
      // slide isn't blank while bytes warm up.
      const v = document.createElement('video');
      v.src = a.cdn_url;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'metadata';
      v.setAttribute('muted', '');
      v.setAttribute('loop', '');
      v.setAttribute('playsinline', '');
      if (typeof a.thumbnail_url === 'string' && a.thumbnail_url.startsWith('https://')) {
        v.poster = a.thumbnail_url;
      }
      fig.appendChild(v);
      stage.insertBefore(fig, ref);
    });
  }

  async function initHeroCarousel() {
    const stage = document.querySelector('.hero-carousel-stage');
    if (!stage) return;

    // Optionally replace placeholder slides with live-feed:hero assets.
    // rebuildHeroSlides mounts all 6 videos with preload='metadata' so each
    // slide is ready (moov atom fetched) without saturating bandwidth.
    const heroAssets = await fetchHeroAssets();
    if (heroAssets) rebuildHeroSlides(stage, heroAssets);

    const slides = Array.from(stage.querySelectorAll('.hero-slide'));
    if (slides.length < 3) return;
    const dotsEl = document.getElementById('heroCarouselDots');
    let idx = 0;
    let timer = null;
    const INTERVAL = 5000;

    // Inject prev/next arrow buttons (idempotent)
    if (!stage.querySelector('.hero-carousel-arrow')) {
      const arrowPrev = document.createElement('button');
      arrowPrev.className = 'hero-carousel-arrow hero-carousel-arrow--prev';
      arrowPrev.type = 'button';
      arrowPrev.setAttribute('aria-label', 'Previous slide');
      arrowPrev.innerHTML = icon('arrowRight', { size: 20 });

      const arrowNext = document.createElement('button');
      arrowNext.className = 'hero-carousel-arrow hero-carousel-arrow--next';
      arrowNext.type = 'button';
      arrowNext.setAttribute('aria-label', 'Next slide');
      arrowNext.innerHTML = icon('arrowRight', { size: 20 });

      stage.appendChild(arrowPrev);
      stage.appendChild(arrowNext);
    }

    // Per-state visual config (offset is % of stage width).
    // JS computes the px offset based on the stage's current width and writes
    // it to `style.transform` directly. CSS interpolates the transform via
    // its declared `transition: transform 1.5s ...`.
    const STATES = {
      'current':      { xPct:   0, scale: 1.00, blur:  0, brightness: 1.00, opacity: 1.00, shadow: '0 60px 120px -10px rgba(0,0,0,0.7)' },
      'next':         { xPct:  32, scale: 0.65, blur:  8, brightness: 0.55, opacity: 0.92, shadow: 'none' },
      'prev':         { xPct: -32, scale: 0.65, blur:  8, brightness: 0.55, opacity: 0.92, shadow: 'none' },
      'hidden-right': { xPct:  85, scale: 0.55, blur: 12, brightness: 0.40, opacity: 0.00, shadow: 'none' },
      'hidden-left':  { xPct: -85, scale: 0.55, blur: 12, brightness: 0.40, opacity: 0.00, shadow: 'none' },
    };

    function applyState(slide, pos) {
      const cfg = STATES[pos] || STATES['hidden-right'];
      const stageW = stage.getBoundingClientRect().width || 1;
      const x = stageW * cfg.xPct / 100;
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const brightness = (pos === 'prev' || pos === 'next') && isLight ? 0.88 : cfg.brightness;
      slide.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(2)}px) scale(${cfg.scale})`;
      slide.style.filter = cfg.blur ? `blur(${cfg.blur}px) brightness(${brightness})` : 'none';
      slide.style.opacity = String(cfg.opacity);
      slide.style.boxShadow = cfg.shadow;
    }

    // All 6 video elements are mounted up front by rebuildHeroSlides with
    // preload='auto', so they're already buffering. We just play() the current
    // and pause() the others — instant swap, no fresh round-trip per slide.
    function syncSlideVideos() {
      if (!heroAssets) return;
      slides.forEach(slide => {
        const v = slide.querySelector('video');
        if (!v) return;
        const isCurrent = slide.getAttribute('data-pos') === 'current';
        if (isCurrent) {
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        } else {
          v.pause();
        }
      });
    }

    function positions(i) {
      const n = slides.length;
      const half = Math.floor(n / 2);
      slides.forEach((s, k) => {
        let off = ((k - i) % n + n) % n;
        if (off > half) off -= n;
        let pos;
        if (off === 0) pos = 'current';
        else if (off === 1) pos = 'next';
        else if (off === -1) pos = 'prev';
        else if (off > 0) pos = 'hidden-right';
        else pos = 'hidden-left';
        s.setAttribute('data-pos', pos);
        applyState(s, pos);
      });
      syncSlideVideos();
      if (dotsEl) {
        Array.from(dotsEl.children).forEach((d, k) => d.classList.toggle('is-active', k === i));
      }
    }

    // Build dots
    if (dotsEl) {
      dotsEl.innerHTML = '';
      slides.forEach((_, k) => {
        const dot = document.createElement('button');
        dot.className = 'hero-carousel-dot';
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to slide ${k + 1}`);
        dot.addEventListener('click', () => { idx = k; positions(idx); resetTimer(); });
        dotsEl.appendChild(dot);
      });
    }

    function tick()   { idx = (idx + 1) % slides.length; positions(idx); }
    function goPrev() { idx = (idx - 1 + slides.length) % slides.length; positions(idx); resetTimer(); }
    function goNext() { idx = (idx + 1) % slides.length; positions(idx); resetTimer(); }
    function resetTimer() { if (timer) clearInterval(timer); timer = setInterval(tick, INTERVAL); }

    // Wire arrows
    const prevBtn = stage.querySelector('.hero-carousel-arrow--prev');
    const nextBtn = stage.querySelector('.hero-carousel-arrow--next');
    if (prevBtn) prevBtn.addEventListener('click', goPrev);
    if (nextBtn) nextBtn.addEventListener('click', goNext);

    positions(idx);
    resetTimer();

    stage.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
    stage.addEventListener('mouseleave', resetTimer);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (timer) clearInterval(timer); }
      else resetTimer();
    });

    // Recompute pixel offsets if the stage resizes (window resize, etc.)
    let resizeRaf;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => positions(idx));
    });

    // Click any hero slide → open the player. Feed continues into live-feed:shorts
    // after the 6 hero items so viewers can keep scrolling beyond the carousel.
    if (heroAssets) {
      const continuation = await fetchHeroContinuation(heroAssets);
      slides.forEach((slide, slideIdx) => {
        slide.style.cursor = 'pointer';
        slide.addEventListener('click', () => {
          if (!window.JW || !window.JW.openVideoOverlay) return;
          const asset = heroAssets[slideIdx];
          if (!asset) return;
          window.JW.openVideoOverlay(asset, continuation);
        });
      });
    }
  }

  // Pull live-feed:shorts and append to the hero pool, deduped by id, so
  // when the viewer reaches the end of the 6 hero items the feed continues
  // into the rest of the shorts library.
  async function fetchHeroContinuation(heroAssets) {
    const ctUrl =
      (typeof window !== 'undefined' && window.CREATOR_TUNNEL_URL) ||
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:8787'
        : 'https://creator-tunnel.vercel.app');
    if (!ctUrl) return heroAssets.slice();
    try {
      const res = await fetch(`${ctUrl}/api/assets?tag=live-feed:shorts&limit=48`, { cache: 'no-store' });
      if (!res.ok) return heroAssets.slice();
      const data = await res.json();
      const heroIds = new Set(heroAssets.map(a => a.id));
      const more = (data.items || []).filter(a =>
        !heroIds.has(a.id) &&
        typeof a.cdn_url === 'string' &&
        a.cdn_url.startsWith('https://') &&
        /\.(mp4|webm|mov)(\?|#|$)/i.test(a.cdn_url)
      );
      return [...heroAssets, ...more];
    } catch (e) {
      console.warn('[hero-carousel] live-feed:shorts continuation fetch failed', e);
      return heroAssets.slice();
    }
  }

  // ---------- CONTENT LOADER ----------
  async function loadContent() {
    try {
      const r = await fetch(`${PATH_PREFIX}content.json`, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`status ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn('Could not load content.json — using placeholders.', e);
      return null;
    }
  }

  // ---------- COLLECTION LOADER (MediaVault → site) ----------
  // Live-fetches a curated Creator Tunnel collection (e.g. "web") and shapes
  // each asset into the same fields content.json provides, so the rest of the
  // site code is unchanged.
  const MEDIAVAULT_API = 'http://93.188.160.128:18791';
  function humanize(slug) {
    return String(slug || '').split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
  }
  function tagValue(tags, prefix) {
    const t = (tags || []).find(x => typeof x === 'string' && x.startsWith(prefix + ':'));
    return t ? t.slice(prefix.length + 1) : null;
  }
  function cleanTitle(raw) {
    return String(raw || 'Untitled')
      .replace(/\.(mp4|mov|webm|m4v)$/i, '')
      .replace(/^[✀-➿☀-⛿✅✔︎️\s]+/, '')
      .trim();
  }
  function adaptCollectionAsset(a) {
    const brandSlug = tagValue(a.tags, 'brand');
    const topicSlug = tagValue(a.tags, 'topic');
    const display = cleanTitle(a.title);
    return {
      id: a.id,
      title: a.title || display,
      display_title: display,
      brand: brandSlug ? humanize(brandSlug) : null,
      topic: topicSlug || null,
      polished: (a.tags || []).includes('quality:polished'),
      file_type: a.file_type,
      duration: a.duration_seconds || null,
      thumbnail_url: a.thumbnail_url || null,
      cdn_url: a.cdn_url || null,
      width: a.width || null,
      height: a.height || null,
      tags: a.tags || [],
      created_at: a.created_at || null,
    };
  }
  async function loadCollection(slug) {
    try {
      const r = await fetch(`${MEDIAVAULT_API}/embed/${encodeURIComponent(slug)}`, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const j = await r.json();
      const assets = (j.assets || []).map(adaptCollectionAsset);
      const brand_counts = {};
      const topic_counts = {};
      assets.forEach(a => {
        if (a.brand) brand_counts[a.brand] = (brand_counts[a.brand] || 0) + 1;
        if (a.topic) topic_counts[a.topic] = (topic_counts[a.topic] || 0) + 1;
      });
      return {
        source: 'mediavault-collection',
        collection: j.collection || slug,
        assets,
        total_in_vault: assets.length,
        brand_counts,
        topic_counts,
      };
    } catch (e) {
      console.warn(`Could not load collection "${slug}" — falling back to content.json.`, e);
      return loadContent();
    }
  }
  function renderShowCard(asset, idx) {
    const altClass = `alt-${(idx % 6) + 1}`;
    const isHttps = u => typeof u === 'string' && u.startsWith('https://');
    const hasVideo = isHttps(asset.cdn_url) && /\.(mp4|webm|mov)$/i.test(asset.cdn_url);
    const hasThumb = isHttps(asset.thumbnail_url);
    const meta = asset.brand ? asset.brand : (asset.duration ? `${Math.round(asset.duration)}s` : 'Studio');
    const title = asset.display_title || asset.title || 'Untitled';
    let coverInner = '';
    if (hasVideo) {
      // Native autoplay + muted is allowed by all browsers without user interaction.
      // src set directly so browser can preload + start playing on its own.
      // Native autoplay + muted is allowed by all browsers without user interaction.
      // preload="metadata" pre-fetches the moov atom so playback starts on the
      // next chunk. initAutoplayVideos pauses cards that scroll off-screen.
      coverInner = `<video class="card-video" autoplay muted loop playsinline preload="metadata" ${hasThumb ? `poster="${escapeHtml(asset.thumbnail_url)}"` : ''} src="${escapeHtml(asset.cdn_url)}"></video>`;
    } else if (hasThumb) {
      coverInner = `<img src="${escapeHtml(asset.thumbnail_url)}" alt="" loading="lazy" />`;
    }
    return `
      <div class="show-card playable" data-id="${asset.id || ''}">
        <div class="show-cover ${coverInner ? '' : altClass}">
          ${coverInner}
          ${hasVideo ? '<div class="play-overlay" aria-hidden="true" data-icon="play" data-icon-size="26"></div>' : ''}
        </div>
        <div class="show-title">${escapeHtml(title)}</div>
        <div class="show-meta">${escapeHtml(meta)}</div>
      </div>
    `;
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  async function renderWorkInto(selector, count) {
    const target = document.querySelector(selector);
    if (!target) return;
    const data = await loadContent();
    if (!data || !data.assets || !data.assets.length) return; // keep placeholders
    const items = (count ? data.assets.slice(0, count) : data.assets);
    target.innerHTML = items.map(renderShowCard).join('');
    initAutoplayVideos(target);
  }

  // ---------- AUTOPLAY VIDEOS ON VIEWPORT ----------
  // Native HTML autoplay handles starting; IO just pauses off-screen videos
  // to free CPU. Setting muted/playsInline as JS props is belt-and-suspenders for iOS.
  function initAutoplayVideos(root) {
    const videos = (root || document).querySelectorAll('video.card-video');
    if (!videos.length) return;

    videos.forEach(v => {
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      const tryPlay = () => {
        const p = v.play();
        if (p && p.catch) p.catch(() => {
          v.addEventListener('canplay', () => v.play().catch(() => {}), { once: true });
        });
      };
      if (v.readyState >= 2) tryPlay();
      else v.addEventListener('loadedmetadata', tryPlay, { once: true });
    });

    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const v = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio > 0.25) {
          if (v.paused) {
            const p = v.play();
            if (p && p.catch) p.catch(() => {});
          }
        } else {
          if (!v.paused) v.pause();
        }
      });
    }, { threshold: [0, 0.25, 0.5] });
    videos.forEach(v => io.observe(v));
  }

  // ---------- PROMO HELPER ----------
  // JW.promoCard({ path, eyebrow, title, desc, cta, variant }) → HTML string
  // path: studio|podcast|shorts|authority|learn (drawer pre-select)
  // variant: '' (dark, default) | 'cream'
  // Use either inline (paste the HTML) or with JW.injectPromo(selector, opts).
  function promoCard(opts) {
    const o = opts || {};
    const variant = o.variant === 'cream' ? ' cream' : '';
    const path = o.path || 'learn';
    const eyebrow = o.eyebrow || 'From JourneyWell';
    const title = o.title || 'Run the system in your business.';
    const desc = o.desc || '';
    const cta = o.cta || 'Get started';
    return `
      <button type="button" class="jw-promo-card${variant}" data-open-drawer-with="${escapeHtml(path)}" aria-label="${escapeHtml(cta)}">
        <div class="jw-promo-card-eyebrow">${escapeHtml(eyebrow)}</div>
        <div class="jw-promo-card-title">${title}</div>
        <div class="jw-promo-card-desc">${escapeHtml(desc)}</div>
        <span class="jw-promo-card-cta">${escapeHtml(cta)}</span>
      </button>
    `;
  }
  function injectPromo(selector, opts) {
    const target = document.querySelector(selector);
    if (!target) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = promoCard(opts).trim();
    const el = wrap.firstElementChild;
    target.appendChild(el);
    // Wire the drawer pre-select since chrome already booted
    el.addEventListener('click', () => openDrawer(el.dataset.openDrawerWith));
  }

  // Expose for pages
  window.JW = {
    openDrawer,
    renderWorkInto,
    loadContent,
    loadCollection,
    initAutoplayVideos,
    renderShowCard,
    promoCard,
    injectPromo,
    icon,
    hydrateIcons,
  };

  // ---------- BOOT ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installChrome);
  } else {
    installChrome();
  }
})();
