// player.js — JourneyWell reels-style player, extracted from work.html so any
// page can summon it via window.JW.openVideoOverlay(asset, pool) or
// window.JW.openReelsFeed(clips, startIndex).
//
// Mounts its own overlay markup at <body> on DOMContentLoaded (idempotent — skips
// if #reelsOverlay already exists, so work.html's existing inline copy still works).
// All styling lives in style.css (.reels-* classes); this file is JS + markup only.

(function () {
  if (window.JW && window.JW.openVideoOverlay && window.JW._playerExtracted) return; // already loaded

  // ---------- helpers ----------
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtDuration(s) {
    if (!s || s < 1) return '';
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
  }
  function isHttps(u) { return typeof u === 'string' && u.startsWith('https://'); }
  function hasPlayableVideo(a) { return isHttps(a.cdn_url) && /\.(mp4|webm|mov)(\?|#|$)/i.test(a.cdn_url); }
  function initials(name) {
    return String(name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  }
  function brandHandle(brand) {
    return '@' + String(brand || 'journeywell').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
  }

  // ---------- state ----------
  const PROMO_EVERY = 3;
  const PROMO_TEMPLATES = [
    { theme: 'studio',    sponsored: 'Sponsored · JourneyWell Studios', headline: 'Book the <em>studio.</em>',          sub: 'Walk in, sit down, walk out with a finished episode. Engineer + lighting + masters in 48hrs.', cta: 'Book a session →',    drawer: 'studio' },
    { theme: 'authority', sponsored: 'Sponsored · The Authority System', headline: 'One recording. <em>Thirty pieces.</em>', sub: 'We turn each studio session into 30+ pieces of social, written, and short-form content.',    cta: 'Build my system →', drawer: 'authority' },
    { theme: 'podcast',   sponsored: 'Sponsored · Podcast Launch',       headline: 'Start a <em>branded</em> podcast.',    sub: 'Concept to launch in two weeks. Production, branding, distribution end-to-end.',                cta: 'Launch your show →',  drawer: 'podcast' },
  ];

  let REELS_SLIDES = [];
  let REELS_OPEN = false;
  let REELS_INDEX = 0;
  let REELS_GLOBAL_MUTED = true;
  let REELS_WHEEL_LOCK = 0;
  let REELS_IO = null;
  const PLAYER_ASSETS = new Map(); // id → asset, for share lookups inside slides

  // ---------- aspect ----------
  function aspectClass(asset) {
    const w = asset && asset.width, h = asset && asset.height;
    if (w && h) {
      if (h > w * 1.1) return 'is-vertical';
      if (Math.abs(w - h) < Math.max(w, h) * 0.1) return 'is-square';
      return 'is-horizontal';
    }
    return 'is-vertical';
  }
  function applyFrameAspect(asset) {
    const frame = document.querySelector('.reels-frame');
    if (!frame) return;
    frame.classList.remove('is-vertical', 'is-horizontal', 'is-square');
    frame.classList.add(aspectClass(asset));
  }

  // ---------- slide templates ----------
  function clipSlideHtml(asset, slideIdx) {
    const hasVideo = hasPlayableVideo(asset);
    const poster = isHttps(asset.thumbnail_url) ? `poster="${escapeHtml(asset.thumbnail_url)}"` : '';
    const brand = asset.brand || 'JourneyWell';
    const handle = brandHandle(brand);
    const title = asset.display_title || asset.title || 'Untitled';
    const caption = (asset.description || asset.ai_description || title).slice(0, 180);
    return `
      <div class="reels-slide" data-slide-index="${slideIdx}" data-asset-id="${escapeHtml(asset.id)}">
        ${hasVideo
          ? `<video class="reels-video" muted playsinline loop preload="metadata" ${poster} src="${escapeHtml(asset.cdn_url)}"></video>`
          : (isHttps(asset.thumbnail_url) ? `<img src="${escapeHtml(asset.thumbnail_url)}" alt="" />` : '')}

        <div class="reels-top-controls">
          <div class="reels-top-left">
            <button class="reels-top-btn" data-action="playpause" title="Play / Pause" data-icon="play" data-icon-size="18"></button>
            <button class="reels-top-btn" data-action="mute" title="Toggle audio" data-icon="volumeOff" data-icon-size="18"></button>
          </div>
          <div class="reels-top-right">
            <button class="reels-top-btn" data-action="expand" title="Open full" data-icon="expandArrows" data-icon-size="18"></button>
            <button class="reels-top-btn" data-action="close" title="Close" data-icon="close" data-icon-size="18"></button>
          </div>
        </div>

        <div class="reels-actions">
          <button class="reels-action" data-action="like" title="Like"><span class="reels-action-icon" data-icon="heart" data-icon-size="24"></span><span class="reels-action-label">Like</span></button>
          <button class="reels-action" data-action="comment" title="Ask" data-open-drawer-with="learn"><span class="reels-action-icon" data-icon="message" data-icon-size="24"></span><span class="reels-action-label">Ask</span></button>
          <button class="reels-action" data-action="share" title="Share"><span class="reels-action-icon" data-icon="share" data-icon-size="24"></span><span class="reels-action-label">Share</span></button>
          <button class="reels-action" data-action="save" title="Save"><span class="reels-action-icon" data-icon="bookmark" data-icon-size="24"></span><span class="reels-action-label">Save</span></button>
          <button class="reels-action cta" data-action="book" title="Book the studio" data-open-drawer-with="studio"><span class="reels-action-icon" data-icon="star" data-icon-size="24"></span><span class="reels-action-label">Book</span></button>
        </div>

        <div class="reels-paused-overlay"><div data-icon="play" data-icon-size="44"></div></div>

        <div class="reels-info">
          <div class="reels-info-row">
            <div class="reels-info-avatar">${escapeHtml(initials(brand))}</div>
            <div class="reels-info-handle">${escapeHtml(handle)}</div>
            <button class="reels-info-subscribe" data-open-drawer-with="podcast">Subscribe</button>
          </div>
          <div class="reels-info-caption">${escapeHtml(caption)}</div>
        </div>

        <div class="reels-progress"><div class="reels-progress-fill"></div></div>
      </div>
    `;
  }
  function promoSlideHtml(promo, slideIdx) {
    return `
      <div class="reels-slide is-promo theme-${promo.theme}" data-slide-index="${slideIdx}" data-type="promo">
        <div class="reels-promo">
          <div class="reels-promo-sponsored">${escapeHtml(promo.sponsored)}</div>
          <div class="reels-promo-headline">${promo.headline}</div>
          <div class="reels-promo-sub">${escapeHtml(promo.sub)}</div>
          <button type="button" class="reels-promo-cta" data-open-drawer-with="${escapeHtml(promo.drawer)}">${escapeHtml(promo.cta)}</button>
        </div>
      </div>
    `;
  }

  // ---------- feed building ----------
  function buildSlides(clips) {
    const out = [];
    let pi = 0;
    clips.forEach((asset, i) => {
      out.push({ type: 'clip', asset });
      if ((i + 1) % PROMO_EVERY === 0) {
        out.push({ type: 'promo', promo: PROMO_TEMPLATES[pi % PROMO_TEMPLATES.length] });
        pi++;
      }
    });
    if (out.length && out[out.length - 1].type !== 'promo') {
      out.push({ type: 'promo', promo: PROMO_TEMPLATES[pi % PROMO_TEMPLATES.length] });
    }
    return out;
  }

  function mountSlides(slides, slideIndex) {
    REELS_SLIDES = slides;
    PLAYER_ASSETS.clear();
    slides.forEach(s => { if (s.type === 'clip' && s.asset && s.asset.id) PLAYER_ASSETS.set(s.asset.id, s.asset); });
    const track = document.getElementById('reelsTrack');
    track.innerHTML = REELS_SLIDES.map((s, i) =>
      s.type === 'clip' ? clipSlideHtml(s.asset, i) : promoSlideHtml(s.promo, i)
    ).join('');
    REELS_INDEX = slideIndex || 0;
    wireSlideEvents(track);
    requestAnimationFrame(() => {
      const slide = track.querySelector(`[data-slide-index="${REELS_INDEX}"]`);
      if (slide) track.scrollTop = slide.offsetTop;
      activateSlide(REELS_INDEX, true);
    });
  }

  function mountReelsFeed(clips, startIndex) {
    if (!clips.length) return;
    const slides = buildSlides(clips);
    let firstSlideForClip = 0;
    if (typeof startIndex === 'number') {
      let count = 0;
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].type === 'clip') {
          if (count === startIndex) { firstSlideForClip = i; break; }
          count++;
        }
      }
    }
    mountSlides(slides, firstSlideForClip);
  }

  // ---------- per-slide event wiring ----------
  function wireSlideEvents(track) {
    track.querySelectorAll('.reels-top-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const slide = btn.closest('.reels-slide');
        const action = btn.dataset.action;
        if (action === 'mute') { toggleReelsMute(); return; }
        if (action === 'close') { closeReelsFeed(); return; }
        if (action === 'expand') { enterFullscreen(); return; }
        if (action === 'playpause') {
          const v = slide.querySelector('video');
          if (!v) return;
          const pausedOverlay = slide.querySelector('.reels-paused-overlay');
          if (v.paused) {
            const p = v.play(); if (p && p.catch) p.catch(() => {});
            pausedOverlay && pausedOverlay.classList.remove('show');
            btn.innerHTML = window.JW.icon('pause', { size: 18 });
          } else {
            v.pause();
            pausedOverlay && pausedOverlay.classList.add('show');
            btn.innerHTML = window.JW.icon('play', { size: 18 });
          }
        }
      });
    });

    track.querySelectorAll('.reels-action').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'like' || action === 'save') { btn.classList.toggle('active'); return; }
        if (action === 'share') {
          const slide = btn.closest('.reels-slide');
          const id = slide && slide.dataset.assetId;
          const asset = id && PLAYER_ASSETS.get(id);
          if (asset && navigator.share) {
            navigator.share({
              title: asset.display_title || asset.title || 'JourneyWell',
              text: asset.description || 'From the JourneyWell channel',
              url: asset.cdn_url || window.location.href,
            }).catch(() => {});
          } else {
            try {
              navigator.clipboard && navigator.clipboard.writeText((asset && asset.cdn_url) || window.location.href);
              btn.classList.add('active');
              const lbl = btn.querySelector('.reels-action-label');
              const oldText = lbl.textContent;
              lbl.textContent = 'Copied';
              setTimeout(() => { btn.classList.remove('active'); lbl.textContent = oldText; }, 1400);
            } catch (err) {}
          }
        }
      });
    });

    track.querySelectorAll('[data-open-drawer-with]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (window.JW && window.JW.openDrawer) window.JW.openDrawer(el.dataset.openDrawerWith);
      });
    });

    track.querySelectorAll('.reels-slide:not(.is-promo)').forEach(slide => {
      slide.addEventListener('click', (e) => {
        // Ignore clicks that originated inside the progress bar (scrub gesture)
        // or any of the action/top buttons — they handle themselves.
        if (e.target.closest('.reels-progress, .reels-top-btn, .reels-action, .reels-info-subscribe, .reels-promo-cta, [data-open-drawer-with]')) return;
        const v = slide.querySelector('video');
        if (!v) return;
        const pausedOverlay = slide.querySelector('.reels-paused-overlay');
        if (v.paused) {
          const p = v.play(); if (p && p.catch) p.catch(() => {});
          pausedOverlay && pausedOverlay.classList.remove('show');
        } else {
          v.pause();
          pausedOverlay && pausedOverlay.classList.add('show');
        }
      });
    });

    if (REELS_IO) REELS_IO.disconnect();
    REELS_IO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          const idx = Number(entry.target.dataset.slideIndex);
          if (!Number.isNaN(idx) && idx !== REELS_INDEX) {
            REELS_INDEX = idx;
            activateSlide(idx, false);
          }
        }
      });
    }, { root: track, threshold: [0, 0.6, 1] });
    track.querySelectorAll('.reels-slide').forEach(s => REELS_IO.observe(s));

    track.querySelectorAll('video').forEach(v => {
      v.addEventListener('timeupdate', () => {
        if (!v.duration) return;
        const slide = v.closest('.reels-slide');
        const fill = slide && slide.querySelector('.reels-progress-fill');
        if (fill) fill.style.width = ((v.currentTime / v.duration) * 100) + '%';
      });
    });

    // Scrubbable progress bar — click anywhere on the bar to seek,
    // drag to scrub. stopPropagation prevents the slide's play/pause
    // click handler from firing on the same gesture.
    track.querySelectorAll('.reels-progress').forEach(bar => {
      const slide = bar.closest('.reels-slide');
      const video = slide && slide.querySelector('video');
      if (!video) return;
      let dragging = false;
      function seekFromEvent(e) {
        const rect = bar.getBoundingClientRect();
        const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
        const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        if (video.duration && isFinite(video.duration)) {
          video.currentTime = frac * video.duration;
          const fill = bar.querySelector('.reels-progress-fill');
          if (fill) fill.style.width = (frac * 100) + '%';
        }
      }
      bar.addEventListener('pointerdown', e => {
        e.stopPropagation();
        e.preventDefault();
        dragging = true;
        try { bar.setPointerCapture && bar.setPointerCapture(e.pointerId); } catch (_) {}
        seekFromEvent(e);
      });
      bar.addEventListener('pointermove', e => {
        if (!dragging) return;
        e.stopPropagation();
        seekFromEvent(e);
      });
      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        e.stopPropagation();
        try { bar.releasePointerCapture && bar.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      bar.addEventListener('pointerup', endDrag);
      bar.addEventListener('pointercancel', endDrag);
      bar.addEventListener('click', e => e.stopPropagation());
    });
  }

  function playWhenReady(v) {
    if (!v) return () => {};
    v.muted = REELS_GLOBAL_MUTED;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    let cancelled = false;
    const fallbackToMuted = () => {
      v.muted = true;
      REELS_GLOBAL_MUTED = true;
      const slide = v.closest('.reels-slide');
      if (slide) {
        const btn = slide.querySelector('.reels-top-btn[data-action="mute"]');
        if (btn) btn.innerHTML = window.JW.icon('volumeOff', { size: 18 });
      }
    };
    const tryPlay = () => {
      if (cancelled) return;
      const p = v.play();
      if (p && p.catch) p.catch(err => {
        if (err && err.name === 'NotAllowedError' && !v.muted) {
          fallbackToMuted();
          v.play().catch(() => {
            v.addEventListener('canplay', () => { if (!cancelled) v.play().catch(() => {}); }, { once: true });
          });
          return;
        }
        v.addEventListener('canplay', () => { if (!cancelled) v.play().catch(() => {}); }, { once: true });
      });
    };
    if (v.preload !== 'auto') v.preload = 'auto';
    if (v.readyState >= 2) tryPlay();
    else {
      try { v.load(); } catch (e) {}
      v.addEventListener('loadeddata', tryPlay, { once: true });
      v.addEventListener('canplay', tryPlay, { once: true });
    }
    return () => { cancelled = true; };
  }

  function activateSlide(idx, initial) {
    const track = document.getElementById('reelsTrack');
    track.querySelectorAll('video').forEach(v => {
      const slide = v.closest('.reels-slide');
      const isActive = slide.dataset.slideIndex === String(idx);
      if (isActive) {
        playWhenReady(v);
        const pausedOverlay = slide.querySelector('.reels-paused-overlay');
        pausedOverlay && pausedOverlay.classList.remove('show');
      } else {
        try { v.pause(); } catch (e) {}
        v.currentTime = 0;
      }
    });
    const slide = track.querySelector(`.reels-slide[data-slide-index="${idx}"]`);
    if (slide) {
      const muteBtn = slide.querySelector('.reels-top-btn[data-action="mute"]');
      if (muteBtn) muteBtn.innerHTML = window.JW.icon(REELS_GLOBAL_MUTED ? 'volumeOff' : 'volume', { size: 18 });
      const playBtn = slide.querySelector('.reels-top-btn[data-action="playpause"]');
      const v = slide.querySelector('video');
      if (playBtn && v) playBtn.innerHTML = window.JW.icon(v.paused ? 'play' : 'pause', { size: 18 });
    }
    updateReelsNavButtons();
  }

  function toggleReelsMute() {
    REELS_GLOBAL_MUTED = !REELS_GLOBAL_MUTED;
    const track = document.getElementById('reelsTrack');
    const active = track.querySelector(`.reels-slide[data-slide-index="${REELS_INDEX}"]`);
    if (!active) return;
    const v = active.querySelector('video');
    if (v) v.muted = REELS_GLOBAL_MUTED;
    const muteBtn = active.querySelector('.reels-top-btn[data-action="mute"]');
    if (muteBtn) muteBtn.innerHTML = window.JW.icon(REELS_GLOBAL_MUTED ? 'volumeOff' : 'volume', { size: 18 });
  }

  function updateReelsNavButtons() {
    const up = document.getElementById('reelsNavUp');
    const down = document.getElementById('reelsNavDown');
    if (!up || !down) return;
    const total = REELS_SLIDES.length;
    up.disabled = REELS_INDEX <= 0;
    down.disabled = REELS_INDEX >= total - 1;
  }

  function scrollReels(delta) {
    const track = document.getElementById('reelsTrack');
    const slides = Array.from(track.querySelectorAll('.reels-slide'));
    const next = Math.min(slides.length - 1, Math.max(0, REELS_INDEX + delta));
    if (slides[next]) slides[next].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function enterFullscreen() {
    const frame = document.querySelector('.reels-frame');
    if (!frame) return;
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} return; }
    const req = frame.requestFullscreen || frame.webkitRequestFullscreen || frame.msRequestFullscreen;
    if (req) { try { req.call(frame); } catch (e) {} }
  }

  // ---------- public entry points ----------
  function openReelsFeed(clips, startIndex) {
    if (!clips || !clips.length) return;
    REELS_OPEN = true;
    REELS_GLOBAL_MUTED = true; // shorts feed starts muted (TikTok pattern)
    const overlay = document.getElementById('reelsOverlay');
    applyFrameAspect(clips[startIndex || 0]);
    overlay.classList.remove('long-form');
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.body.style.overflow = 'hidden';
    mountReelsFeed(clips, startIndex || 0);
  }

  function openVideoOverlay(asset, pool) {
    if (!asset) return;
    REELS_OPEN = true;
    REELS_GLOBAL_MUTED = false;
    const overlay = document.getElementById('reelsOverlay');
    applyFrameAspect(asset);
    overlay.classList.remove('long-form');
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.body.style.overflow = 'hidden';

    let clips, startIndex;
    if (pool && pool.length) {
      const idx = pool.findIndex(a => a.id === asset.id);
      if (idx >= 0) { clips = pool; startIndex = idx; }
      else          { clips = [asset, ...pool]; startIndex = 0; }
    } else {
      clips = [asset];
      startIndex = 0;
    }
    mountReelsFeed(clips, startIndex);
  }

  function closeReelsFeed() {
    REELS_OPEN = false;
    const overlay = document.getElementById('reelsOverlay');
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
    overlay.classList.remove('open');
    setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove('long-form');
      const track = document.getElementById('reelsTrack');
      if (track) track.innerHTML = '';
    }, 240);
    document.body.style.overflow = '';
  }

  // ---------- overlay markup + global handlers ----------
  const OVERLAY_HTML = `
    <div class="reels-overlay" id="reelsOverlay" hidden>
      <div class="reels-backdrop"></div>
      <button class="reels-close" id="reelsClose" aria-label="Close" data-icon="close" data-icon-size="22"></button>
      <button class="reels-nav-up" id="reelsNavUp" aria-label="Previous" data-icon="chevronUp" data-icon-size="22"></button>
      <button class="reels-nav-down" id="reelsNavDown" aria-label="Next" data-icon="chevronDown" data-icon-size="22"></button>
      <div class="reels-stage">
        <div class="reels-frame">
          <div class="reels-track" id="reelsTrack"></div>
        </div>
      </div>
    </div>
  `;

  function install() {
    // Idempotent: if work.html already injected the overlay inline, reuse it.
    if (!document.getElementById('reelsOverlay')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = OVERLAY_HTML.trim();
      document.body.appendChild(wrap.firstElementChild);
    }

    // Skip rebinding if work.html (or a previous load of this script) already wired.
    if (document.body.dataset.jwPlayerBound === '1') return;
    document.body.dataset.jwPlayerBound = '1';

    const reelsClose = document.getElementById('reelsClose');
    const reelsNavUp = document.getElementById('reelsNavUp');
    const reelsNavDown = document.getElementById('reelsNavDown');
    const reelsOverlay = document.getElementById('reelsOverlay');
    if (reelsClose) reelsClose.addEventListener('click', closeReelsFeed);
    if (reelsNavUp) reelsNavUp.addEventListener('click', () => scrollReels(-1));
    if (reelsNavDown) reelsNavDown.addEventListener('click', () => scrollReels(1));

    if (reelsOverlay) {
      reelsOverlay.addEventListener('wheel', e => {
        if (!REELS_OPEN) return;
        e.preventDefault();
        const now = Date.now();
        if (now - REELS_WHEEL_LOCK < 360) return;
        if (Math.abs(e.deltaY) < 12) return;
        REELS_WHEEL_LOCK = now;
        scrollReels(e.deltaY > 0 ? 1 : -1);
      }, { passive: false });
    }

    document.addEventListener('keydown', e => {
      if (!REELS_OPEN) return;
      if (e.key === 'Escape') return closeReelsFeed();
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); scrollReels(1); return; }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); scrollReels(-1); return; }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }

  // ---------- exports ----------
  window.JW = window.JW || {};
  window.JW._playerExtracted = true;
  window.JW.openVideoOverlay = openVideoOverlay;
  window.JW.openReelsFeed    = openReelsFeed;
  window.JW.closeReelsFeed   = closeReelsFeed;
  window.JW.aspectClass      = aspectClass;
})();
