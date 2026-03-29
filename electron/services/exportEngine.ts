import { readCaptureFile, writeExportFile } from './fileManager'
import { reencodeImages } from './htmlProcessor'
import { dbGetCapture } from './database'
import type { Demo, ExportOptions } from '../../src/types/index'

const RUNTIME_CSS_RAW = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100vw; height: 100vh; overflow: hidden; background: #fff; }
#demo-root { width: 100%; height: 100%; position: relative; }
#viewport-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; background: #fff; }
#step-frame { width: 100%; height: 100%; border: none; }
`.trim()

// Presentation background themes
const PRESENTATION_BACKGROUNDS: Record<string, string> = {
  midnight: 'background: #0f0f1a; background-image: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,50,140,0.7) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 0% 100%, rgba(40,35,100,0.5) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 100% 70%, rgba(30,50,120,0.4) 0%, transparent 50%);',
  aurora: 'background: #0a0a18; background-image: radial-gradient(ellipse 70% 50% at 25% -5%, rgba(20,100,180,0.7) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 85% 20%, rgba(100,40,160,0.55) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 50% 100%, rgba(20,80,160,0.4) 0%, transparent 50%);',
  ember: 'background: #10080a; background-image: radial-gradient(ellipse 65% 50% at 75% -5%, rgba(160,50,30,0.6) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 10% 85%, rgba(180,60,20,0.4) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 50% 40%, rgba(120,30,15,0.3) 0%, transparent 50%);',
  ocean: 'background: #060d18; background-image: radial-gradient(ellipse 70% 50% at 35% -5%, rgba(10,100,170,0.7) 0%, transparent 55%), radial-gradient(ellipse 55% 50% at 90% 80%, rgba(0,130,180,0.45) 0%, transparent 50%), radial-gradient(ellipse 45% 40% at 5% 50%, rgba(10,80,140,0.35) 0%, transparent 50%);',
}

function getPresentationCSS(bgId: string): string {
  const bg = PRESENTATION_BACKGROUNDS[bgId] || PRESENTATION_BACKGROUNDS.midnight
  return [
    '* { margin: 0; padding: 0; box-sizing: border-box; }',
    'html, body { width: 100vw; height: 100vh; overflow: hidden; ' + bg + ' }',
    '#demo-root { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }',
    '#viewport-container { position: relative; overflow: hidden; background: #fff; box-shadow: 0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06); border-radius: 8px; }',
    '#step-frame { width: 100%; height: 100%; border: none; }',
  ].join('\n')
}

const RUNTIME_CSS_SHARED = `
#cursor-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000; }
#animated-cursor { position: absolute; opacity: 0; transition: none; will-change: transform; }
#animated-cursor.visible { opacity: 1; }
#animated-cursor.animating { transition: left var(--cursor-duration) var(--cursor-easing), top var(--cursor-duration) var(--cursor-easing); }
#click-ripple { position: absolute; width: 40px; height: 40px; border-radius: 50%; background: rgba(59,130,246,0.3); transform: translate(-50%, -50%) scale(0); pointer-events: none; }
#click-ripple.active { animation: ripple 0.6s ease-out forwards; }
@keyframes ripple { 0% { transform: translate(-50%,-50%) scale(0); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(2.5); opacity: 0; } }
#click-zone-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999; }
.click-zone { position: absolute; cursor: pointer; border-radius: 50%; pointer-events: auto; background: transparent; }
.click-zone:hover { background: transparent; }
.wrong-click-hint { position: absolute; pointer-events: none; z-index: 1000; width: 0; height: 0; }
.wrong-click-hint .hint-core { position: absolute; width: 10px; height: 10px; border-radius: 50%; top: 0; left: 0; transform: translate(-50%,-50%) scale(0); opacity: 0; background: #0A84FF; }
.wrong-click-hint .hint-halo { position: absolute; width: 28px; height: 28px; border-radius: 50%; top: 0; left: 0; transform: translate(-50%,-50%) scale(0); opacity: 0; background: rgba(10,132,255,0.15); }
.wrong-click-hint .hint-glow { position: absolute; width: 80px; height: 80px; border-radius: 50%; top: 0; left: 0; transform: translate(-50%,-50%) scale(0.4); opacity: 0; background: radial-gradient(circle, rgba(10,132,255,0.10) 0%, rgba(10,132,255,0) 70%); }
.wrong-click-hint .hint-ring1 { position: absolute; width: 40px; height: 40px; border-radius: 50%; top: 0; left: 0; transform: translate(-50%,-50%) scale(0); opacity: 0; border: 1.5px solid rgba(10,132,255,0.45); }
.wrong-click-hint .hint-ring2 { position: absolute; width: 40px; height: 40px; border-radius: 50%; top: 0; left: 0; transform: translate(-50%,-50%) scale(0); opacity: 0; border: 1px solid rgba(10,132,255,0.25); }
.wrong-click-hint .hint-ring3 { position: absolute; width: 40px; height: 40px; border-radius: 50%; top: 0; left: 0; transform: translate(-50%,-50%) scale(0); opacity: 0; border: 0.5px solid rgba(10,132,255,0.12); }
.wrong-click-hint .hint-field { position: absolute; width: 120px; height: 120px; border-radius: 50%; top: 0; left: 0; transform: translate(-50%,-50%) scale(0.3); opacity: 0; background: radial-gradient(circle, rgba(10,132,255,0.06) 0%, rgba(10,132,255,0.02) 40%, rgba(10,132,255,0) 70%); }
.wrong-click-hint.active .hint-core { animation: hCore 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
.wrong-click-hint.active .hint-halo { animation: hHalo 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
.wrong-click-hint.active .hint-glow { animation: hGlow 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
.wrong-click-hint.active .hint-field { animation: hField 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
.wrong-click-hint.active .hint-ring1 { animation: hRing1 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
.wrong-click-hint.active .hint-ring2 { animation: hRing2 2s cubic-bezier(0.25,0.46,0.45,0.94) 0.08s forwards; }
.wrong-click-hint.active .hint-ring3 { animation: hRing3 2s cubic-bezier(0.25,0.46,0.45,0.94) 0.16s forwards; }
@keyframes hCore { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 1; } 45% { transform: translate(-50%,-50%) scale(1); opacity: 0.9; } 100% { transform: translate(-50%,-50%) scale(0); opacity: 0; } }
@keyframes hHalo { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 0.8; } 50% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; } 100% { transform: translate(-50%,-50%) scale(1.4); opacity: 0; } }
@keyframes hGlow { 0% { transform: translate(-50%,-50%) scale(0.4); opacity: 0; } 12% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; } 55% { transform: translate(-50%,-50%) scale(1); opacity: 0.3; } 100% { transform: translate(-50%,-50%) scale(1.1); opacity: 0; } }
@keyframes hRing1 { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 0.55; } 100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; } }
@keyframes hRing2 { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 0.35; } 100% { transform: translate(-50%,-50%) scale(3); opacity: 0; } }
@keyframes hRing3 { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 0.2; } 100% { transform: translate(-50%,-50%) scale(3.4); opacity: 0; } }
@keyframes hField { 0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0; } 15% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; } 55% { transform: translate(-50%,-50%) scale(1); opacity: 0.25; } 100% { transform: translate(-50%,-50%) scale(1.05); opacity: 0; } }
#step-counter { position: fixed; bottom: 16px; right: 16px; background: rgba(0,0,0,0.5); color: #fff; padding: 6px 14px; border-radius: 20px; font: 13px/1 -apple-system, sans-serif; z-index: 1001; opacity: 0.6; transition: opacity 0.2s; }
#step-counter:hover { opacity: 1; }
#blur-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 998; }
.blur-zone { position: absolute; border-radius: 4px; pointer-events: none; }
.blur-zone-blur { backdrop-filter: blur(var(--blur-intensity, 8px)); -webkit-backdrop-filter: blur(var(--blur-intensity, 8px)); background: rgba(128,128,128,0.1); }
.blur-zone-redact { background: var(--redact-color, #333); }
#autoplay-controls { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); backdrop-filter: blur(12px); color: #fff; padding: 8px 16px; border-radius: 24px; font: 13px/1 -apple-system, sans-serif; z-index: 1002; display: flex; align-items: center; gap: 12px; }
#autoplay-controls button { background: none; border: none; color: #fff; cursor: pointer; font-size: 16px; padding: 4px 8px; border-radius: 8px; }
#autoplay-controls button:hover { background: rgba(255,255,255,0.15); }
`.trim()

const RUNTIME_JS = `
(function() {
  var config = JSON.parse(document.getElementById('demo-config').textContent);
  var steps = config.steps;
  var currentStep = 0;
  var animationTimer = null;
  var autoPlayTimer = null;
  var autoPlayPaused = false;
  var navigationHistory = [];
  var currentWrongClickHandler = null;

  var viewport = document.getElementById('viewport-container');
  var frame = document.getElementById('step-frame');
  var cursorEl = document.getElementById('animated-cursor');
  var rippleEl = document.getElementById('click-ripple');
  var zoneOverlay = document.getElementById('click-zone-overlay');
  var counterEl = document.getElementById('step-counter');
  var blurOverlay = document.getElementById('blur-overlay');
  var autoplayControls = document.getElementById('autoplay-controls');

  // ── Viewport scaling ─────────────────────────────────────────────
  function scaleViewport() {
    if (config.presentationMode) {
      var step = steps[currentStep];
      var vw = step.viewportWidth;
      var vh = step.viewportHeight;
      var scaleX = window.innerWidth / vw;
      var scaleY = window.innerHeight / vh;
      var scale = Math.min(scaleX, scaleY, 1) * 0.92;
      viewport.style.width = vw + 'px';
      viewport.style.height = vh + 'px';
      viewport.style.transform = 'scale(' + scale + ')';
      viewport.style.transformOrigin = 'center center';
    } else {
      viewport.style.width = '100%';
      viewport.style.height = '100%';
      viewport.style.transform = 'none';
    }
  }

  // ── Blur zones ───────────────────────────────────────────────────
  function renderBlurZones(step) {
    if (!blurOverlay) return;
    blurOverlay.innerHTML = '';
    var zones = step.blurZones || [];
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      var el = document.createElement('div');
      el.className = 'blur-zone ' + (z.mode === 'redact' ? 'blur-zone-redact' : 'blur-zone-blur');
      el.style.left = z.x + '%';
      el.style.top = z.y + '%';
      el.style.width = z.width + '%';
      el.style.height = z.height + '%';
      if (z.mode === 'blur') {
        el.style.setProperty('--blur-intensity', (z.intensity || 8) + 'px');
      } else {
        el.style.setProperty('--redact-color', z.color || '#333');
      }
      blurOverlay.appendChild(el);
    }
  }

  // Sync blur overlay with iframe scroll so zones stay anchored to content
  function syncBlurOverlayScroll() {
    if (!blurOverlay) return;
    try {
      var win = frame.contentWindow;
      if (win) {
        var sy = win.scrollY || win.pageYOffset || 0;
        var sx = win.scrollX || win.pageXOffset || 0;
        blurOverlay.style.transform = 'translate(' + (-sx) + 'px, ' + (-sy) + 'px)';
      }
    } catch(e) {}
  }

  // ── Text edits & hidden elements ─────────────────────────────────
  // Robust version: retries if contentDocument isn't ready yet
  function applyTextEditsAndHidden(step, retryCount) {
    retryCount = retryCount || 0;
    var doc;
    try { doc = frame.contentDocument; } catch(e) { doc = null; }
    if (!doc || !doc.body) {
      if (retryCount < 10) {
        setTimeout(function() { applyTextEditsAndHidden(step, retryCount + 1); }, 100);
      }
      return;
    }

    // Apply text edits
    var edits = step.textEdits || [];
    for (var i = 0; i < edits.length; i++) {
      var edit = edits[i];
      try {
        var el = doc.querySelector(edit.selector);
        if (el) {
          el.innerText = edit.newText;
        }
      } catch(e) {}
    }

    // Apply hidden elements
    var hidden = step.hiddenElements || [];
    if (hidden.length > 0) {
      var styleEl = doc.createElement('style');
      styleEl.textContent = hidden.map(function(sel) { return sel + ' { display: none !important; }'; }).join('\\n');
      doc.head.appendChild(styleEl);
    }

    // ── Block all navigation inside the iframe ──
    // Prevent links, buttons, and forms from navigating away from the captured page
    try {
      // 1. Inject CSS to remove interactive cursor hints from all clickable elements
      var navBlockStyle = doc.createElement('style');
      navBlockStyle.textContent = 'a, a *, button, [role="button"], input[type="submit"] { cursor: default !important; }';
      doc.head.appendChild(navBlockStyle);

      // 2. Capture-phase listener blocks ALL click navigation attempts
      doc.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target !== doc.documentElement) {
          var tag = target.tagName;
          if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || target.getAttribute('role') === 'button' || target.getAttribute('onclick')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
          target = target.parentElement;
        }
      }, true);

      // 3. Neutralize all anchors — strip href, remove target
      var allLinks = doc.querySelectorAll('a[href]');
      for (var li = 0; li < allLinks.length; li++) {
        allLinks[li].setAttribute('href', 'javascript:void(0)');
        allLinks[li].removeAttribute('target');
      }

      // 4. Block form submissions
      doc.addEventListener('submit', function(e) { e.preventDefault(); e.stopImmediatePropagation(); }, true);

      // 5. Disable window.open and meta refresh
      var iframeWin = frame.contentWindow;
      if (iframeWin) {
        iframeWin.open = function() { return null; };
      }
      var metaRefresh = doc.querySelector('meta[http-equiv="refresh"]');
      if (metaRefresh) metaRefresh.remove();
    } catch(navBlockErr) {
      console.log('[Runthroo] Could not block iframe navigation:', navBlockErr);
    }

  }

  // Wrapper: set up frame.onload with fallback timeout
  function onFrameReady(step, callback) {
    var called = false;
    function run() {
      if (called) return;
      called = true;
      applyTextEditsAndHidden(step);
      if (callback) callback();
    }
    frame.onload = run;
    // Fallback: if onload doesn't fire within 500ms, try anyway
    setTimeout(run, 500);
  }

  // ── Render step ──────────────────────────────────────────────────
  function renderStep(index) {
    if (index < 0 || index >= steps.length) return;
    currentStep = index;
    var step = steps[index];

    clearTimeout(animationTimer);
    cursorEl.classList.remove('visible', 'animating');
    rippleEl.classList.remove('active');
    zoneOverlay.innerHTML = '';
    zoneOverlay.style.transform = '';
    // Remove previous wrong-click handler to prevent duplicates
    if (currentWrongClickHandler) {
      viewport.removeEventListener('click', currentWrongClickHandler);
      currentWrongClickHandler = null;
    }

    var template = document.getElementById('step-' + index);
    frame.srcdoc = template.textContent;

    scaleViewport();
    renderBlurZones(step);

    if (counterEl) {
      counterEl.textContent = (index + 1) + ' / ' + steps.length;
    }

    // ── Click zones: legacy (advances to next) + branch (navigates to specific step) ──
    // Both can coexist on the same step!
    var branchZones = step.clickZones || [];
    var hasLegacyZone = !!step.clickZone && index < steps.length - 1;
    console.log('[Runthroo] Step ' + index + ': clickZone=' + !!step.clickZone + ' (notLast=' + (index < steps.length - 1) + '), branchZones=' + branchZones.length + ', rendering: legacy=' + hasLegacyZone + ' branch=' + (branchZones.length > 0));
    var hasBranchZones = branchZones.length > 0;
    var hasAnyZone = hasLegacyZone || hasBranchZones;
    var allClickableElements = [];

    // ── Legacy click zone (blue — advances to next step) ──
    if (hasLegacyZone) {
      var cz = step.clickZone;
      var vw = step.viewportWidth;
      var totalH = cz.scrollY || step.viewportHeight;
      var cxPx = (cz.x / 100) * vw;
      var cyPx = (cz.y / 100) * totalH;
      var rPx = (cz.width / 100) * vw;

      var legacyZone = document.createElement('div');
      legacyZone.className = 'click-zone';
      legacyZone.style.left = (cxPx - rPx) + 'px';
      legacyZone.style.top = (cyPx - rPx) + 'px';
      legacyZone.style.width = (rPx * 2) + 'px';
      legacyZone.style.height = (rPx * 2) + 'px';
      legacyZone.addEventListener('click', function(e) { e.stopPropagation(); goToStep(index + 1); });
      zoneOverlay.appendChild(legacyZone);
      allClickableElements.push(legacyZone);
      console.log('[Runthroo] Legacy zone rendered at px: left=' + legacyZone.style.left + ' top=' + legacyZone.style.top + ' size=' + legacyZone.style.width);
    }

    // ── Branch click zones (navigate to specific steps) ──
    // Branch zones use viewportHeight as Y denominator (not scrollHeight like legacy zones)
    if (hasBranchZones) {
      for (var b = 0; b < branchZones.length; b++) {
        (function(bz) {
          var vw = step.viewportWidth;
          var vh = step.viewportHeight;
          var cxPx = (bz.x / 100) * vw;
          var cyPx = (bz.y / 100) * vh;
          var rPx = (bz.width / 100) * vw;

          var zone = document.createElement('div');
          zone.className = 'click-zone branch-zone';
          zone.style.left = (cxPx - rPx) + 'px';
          zone.style.top = (cyPx - rPx) + 'px';
          zone.style.width = (rPx * 2) + 'px';
          zone.style.height = (rPx * 2) + 'px';
          zone.addEventListener('click', function(e) {
            e.stopPropagation();
            navigationHistory.push(currentStep);
            if (bz.targetStepId === 'next') {
              goToStep(index + 1);
            } else {
              var targetIdx = steps.findIndex(function(s) { return s.id === bz.targetStepId; });
              if (targetIdx >= 0) goToStep(targetIdx);
              else goToStep(index + 1);
            }
          });
          zoneOverlay.appendChild(zone);
          allClickableElements.push(zone);
          console.log('[Runthroo] Branch zone rendered at px: left=' + zone.style.left + ' top=' + zone.style.top + ' size=' + zone.style.width + ' target=' + bz.targetStepId);
        })(branchZones[b]);
      }
    }

    // ── Frame ready: scroll sync + wrong-click handlers ──
    if (hasAnyZone) {
      onFrameReady(step, function() {
        var win = frame.contentWindow;
        if (!win) return;

        function getScrollY() {
          var sy = win.scrollY || win.pageYOffset || 0;
          if (sy > 0) return sy;
          try {
            var all = win.document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
              var el = all[i];
              if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight + 50) {
                return el.scrollTop;
              }
            }
          } catch(e) {}
          return 0;
        }

        function syncOverlay() {
          var sy = getScrollY();
          var sx = win.scrollX || win.pageXOffset || 0;
          zoneOverlay.style.transform = 'translate(' + (-sx) + 'px, ' + (-sy) + 'px)';
          syncBlurOverlayScroll();
        }
        syncOverlay();
        win.addEventListener('scroll', syncOverlay, true);

        // Wrong click inside iframe: show ALL targets
        win.document.addEventListener('click', function(e) {
          showAllClickHints(step, index);
        });
      });

      // Wrong click on viewport: show all targets (skip if clicking a zone)
      currentWrongClickHandler = function(e) {
        for (var i = 0; i < allClickableElements.length; i++) {
          if (e.target === allClickableElements[i] || allClickableElements[i].contains(e.target)) return;
        }
        showAllClickHints(step, index);
      };
      viewport.addEventListener('click', currentWrongClickHandler);
    } else {
      // No click zones at all — still apply text edits, hidden elements, scroll sync
      onFrameReady(step, function() {
        try {
          var win = frame.contentWindow;
          if (win) {
            win.addEventListener('scroll', syncBlurOverlayScroll, true);
          }
        } catch(e) {}
      });
    }

    if (step.cursor && step.cursor.enabled) {
      animationTimer = setTimeout(function() {
        animateCursor(step.cursor);
      }, step.cursor.delayMs || 500);
    }

    // Auto-play: schedule next step
    if (config.autoPlay && !autoPlayPaused) {
      clearTimeout(autoPlayTimer);
      if (index < steps.length - 1 || config.autoPlayLoop) {
        var delay = step.autoPlayDelay || config.autoPlayDefaultDelay || 4000;
        var cursorDuration = (step.cursor && step.cursor.enabled) ? (step.cursor.durationMs + (step.cursor.delayMs || 500) + 800) : 0;
        autoPlayTimer = setTimeout(function() {
          var nextIdx = (index + 1) % steps.length;
          goToStep(nextIdx);
        }, Math.max(delay, cursorDuration));
      }
    }
  }

  function animateCursor(cfg) {
    cursorEl.style.left = cfg.startX + '%';
    cursorEl.style.top = cfg.startY + '%';
    cursorEl.style.setProperty('--cursor-duration', cfg.durationMs + 'ms');
    cursorEl.style.setProperty('--cursor-easing', cfg.easing || 'ease-in-out');
    cursorEl.classList.add('visible');
    cursorEl.classList.remove('animating');

    void cursorEl.offsetWidth;
    cursorEl.classList.add('animating');
    cursorEl.style.left = cfg.endX + '%';
    cursorEl.style.top = cfg.endY + '%';

    setTimeout(function() {
      if (cfg.showClickEffect) {
        rippleEl.style.left = cfg.endX + '%';
        rippleEl.style.top = cfg.endY + '%';
        rippleEl.classList.remove('active');
        void rippleEl.offsetWidth;
        rippleEl.classList.add('active');
      }
      if (cfg.loop) {
        setTimeout(function() {
          animateCursor(cfg);
        }, 800);
      }
    }, cfg.durationMs);
  }

  // Show hints for ALL clickable targets on wrong click — all at once
  function showAllClickHints(step, index) {
    // Remove all existing hints first
    var existing = zoneOverlay.querySelectorAll('.wrong-click-hint');
    for (var i = 0; i < existing.length; i++) existing[i].remove();

    var vw = step.viewportWidth;
    var vh = step.viewportHeight;
    var targets = [];

    // Collect ALL hint positions
    if (step.clickZone && index < steps.length - 1) {
      var cz = step.clickZone;
      var czTotalH = cz.scrollY || vh;
      targets.push({ x: (cz.x / 100) * vw, y: (cz.y / 100) * czTotalH });
    }
    var branchZones = step.clickZones || [];
    for (var b = 0; b < branchZones.length; b++) {
      var bz = branchZones[b];
      targets.push({ x: (bz.x / 100) * vw, y: (bz.y / 100) * vh });
    }

    console.log('[Runthroo] showAllClickHints: ' + targets.length + ' hint(s) for step ' + index);

    // Create ALL hint elements first, then trigger animations in one batch
    var elements = [];
    var layers = ['hint-field','hint-glow','hint-ring3','hint-ring2','hint-ring1','hint-halo','hint-core'];
    for (var t = 0; t < targets.length; t++) {
      var info = targets[t];
      var el = document.createElement('div');
      el.className = 'wrong-click-hint';
      el.style.left = info.x + 'px';
      el.style.top = info.y + 'px';
      for (var l = 0; l < layers.length; l++) {
        var layer = document.createElement('div');
        layer.className = layers[l];
        el.appendChild(layer);
      }
      zoneOverlay.appendChild(el);
      elements.push(el);
    }

    // Single reflow then trigger ALL simultaneously
    void zoneOverlay.offsetWidth;
    for (var a = 0; a < elements.length; a++) {
      elements[a].classList.add('active');
    }

    // Clean up after animation
    setTimeout(function() {
      for (var r = 0; r < elements.length; r++) {
        if (elements[r].parentNode) elements[r].remove();
      }
    }, 2000);
  }

  function goToStep(index) {
    if (index < 0 || index >= steps.length) return;
    var step = steps[currentStep];
    var transition = step.transition || 'fade';

    if (transition === 'instant') {
      renderStep(index);
    } else if (transition === 'fade') {
      viewport.style.transition = 'opacity 0.3s';
      viewport.style.opacity = '0';
      setTimeout(function() {
        renderStep(index);
        viewport.style.opacity = '1';
      }, 300);
    } else if (transition === 'slide-left') {
      viewport.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s';
      viewport.style.transform += ' translateX(-30px)';
      viewport.style.opacity = '0';
      setTimeout(function() {
        viewport.style.transition = 'none';
        viewport.style.transform = '';
        viewport.style.opacity = '';
        renderStep(index);
      }, 300);
    }
  }

  // ── Keyboard navigation ──────────────────────────────────────────
  if (config.keyboardNav !== false) {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToStep(currentStep + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (navigationHistory.length > 0) {
          goToStep(navigationHistory.pop());
        } else {
          goToStep(currentStep - 1);
        }
      }
    });
  }

  // ── Auto-play controls ───────────────────────────────────────────
  if (config.autoPlay && autoplayControls) {
    autoplayControls.style.display = 'flex';
    var playPauseBtn = autoplayControls.querySelector('#autoplay-toggle');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', function() {
        autoPlayPaused = !autoPlayPaused;
        playPauseBtn.textContent = autoPlayPaused ? '▶' : '⏸';
        if (!autoPlayPaused) {
          renderStep(currentStep); // re-trigger auto-advance
        } else {
          clearTimeout(autoPlayTimer);
        }
      });
    }
  }

  window.addEventListener('resize', scaleViewport);
  renderStep(0);
})();
`.trim()

export async function exportDemo(demo: Demo, options: ExportOptions): Promise<string> {
  // 1. Build step HTML content + config
  const stepTemplates: string[] = []
  const stepConfigs: object[] = []

  for (let i = 0; i < demo.steps.length; i++) {
    const step = demo.steps[i]
    let html = readCaptureFile(step.captureId)

    // 2. Re-encode images at target quality
    if (options.imageQuality < 100) {
      html = await reencodeImages(html, options.imageQuality)
    }

    // Use <script type="text/html"> instead of <template> to avoid DOM parsing issues.
    // Captured pages (e.g. GitHub) contain their own <template> tags which nest inside
    // our container and break the DOM. <script type="text/html"> treats content as raw text.
    // We only need to escape </script sequences in the captured HTML.
    const safeHtml = html.replace(/<\/script/gi, '\\x3c/script')
    stepTemplates.push('<script type="text/html" id="step-' + i + '">' + safeHtml + '<' + '/script>')

    const capture = dbGetCapture(step.captureId)

    // ── Server-side export logging ──
    console.log(`[ExportEngine] Step ${i} "${step.label}":`)
    console.log(`  clickZone (legacy):`, step.clickZone ? JSON.stringify(step.clickZone) : 'NULL')
    console.log(`  clickZones (branch): ${(step.clickZones || []).length} zones`, step.clickZones ? JSON.stringify(step.clickZones) : '[]')

    stepConfigs.push({
      id: step.id,
      label: step.label,
      clickZone: step.clickZone,
      cursor: step.cursorConfig,
      transition: step.transition,
      viewportWidth: capture?.viewportWidth || 1440,
      viewportHeight: capture?.viewportHeight || 900,
      // V2 fields
      blurZones: step.blurZones || [],
      textEdits: step.textEdits || [],
      hiddenElements: step.hiddenElements || [],
      clickZones: step.clickZones || [],
      autoPlayDelay: step.autoPlayDelay || 0,
    })
  }

  // 3. Build demo config JSON
  const demoConfig = JSON.stringify({
    demoName: demo.name,
    keyboardNav: options.keyboardNav,
    showStepCounter: options.showStepCounter,
    presentationMode: !!options.presentationMode,
    autoPlay: !!options.autoPlay,
    autoPlayDefaultDelay: options.autoPlayDefaultDelay || 4000,
    autoPlayLoop: !!options.autoPlayLoop,
    steps: stepConfigs,
  })

  // 4. Assemble final HTML
  const stepCounterHtml = options.showStepCounter ? '<div id="step-counter"></div>' : ''
  const autoPlayHtml = options.autoPlay ? '<div id="autoplay-controls" style="display:none"><button id="autoplay-toggle" title="Pause/Play">⏸</button><span style="font-size:12px;opacity:0.7">Auto-playing</span></div>' : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Demo: ${escapeHtml(demo.name)}</title>
<style>
${options.presentationMode ? getPresentationCSS(options.presentationBg || 'midnight') : RUNTIME_CSS_RAW}
${RUNTIME_CSS_SHARED}
</style>
</head>
<body>
<div id="demo-root">
  <div id="viewport-container">
    <iframe id="step-frame" sandbox="allow-same-origin allow-scripts"></iframe>
    <div id="blur-overlay"></div>
    <div id="click-zone-overlay"></div>
  </div>
  <div id="cursor-layer">
    <div id="animated-cursor">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M5 3l14 8-6.5 2.5L10 20z" fill="#000" stroke="#fff" stroke-width="1.5"/>
      </svg>
    </div>
    <div id="click-ripple"></div>
  </div>
  ${stepCounterHtml}
  ${autoPlayHtml}
</div>

${stepTemplates.join('\n')}

<script id="demo-config" type="application/json">
${demoConfig}
</script>

<script>
${RUNTIME_JS}
</script>
</body>
</html>`

  // 5. Write to disk — use user-chosen path if provided, otherwise default
  if (options.outputPath) {
    const { writeFileSync } = require('fs')
    writeFileSync(options.outputPath, html, 'utf-8')
    return options.outputPath
  }
  return writeExportFile(options.filename, html)
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
