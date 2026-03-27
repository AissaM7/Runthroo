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

const RUNTIME_CSS_PRESENTATION = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100vw; height: 100vh; overflow: hidden; background: #1a1a2e; }
#demo-root { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
#viewport-container { position: relative; overflow: hidden; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,0.3); border-radius: 8px; }
#step-frame { width: 100%; height: 100%; border: none; }
`.trim()

const RUNTIME_CSS_SHARED = `
#cursor-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000; }
#animated-cursor { position: absolute; opacity: 0; transition: none; will-change: transform; }
#animated-cursor.visible { opacity: 1; }
#animated-cursor.animating { transition: left var(--cursor-duration) var(--cursor-easing), top var(--cursor-duration) var(--cursor-easing); }
#click-ripple { position: absolute; width: 40px; height: 40px; border-radius: 50%; background: rgba(59,130,246,0.3); transform: translate(-50%, -50%) scale(0); pointer-events: none; }
#click-ripple.active { animation: ripple 0.6s ease-out forwards; }
@keyframes ripple { 0% { transform: translate(-50%,-50%) scale(0); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(2.5); opacity: 0; } }
#click-zone-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999; }
.click-zone { position: absolute; cursor: default; border-radius: 50%; pointer-events: auto; background: transparent; }
.click-zone:hover { background: transparent; }
.wrong-click-target { position: absolute; pointer-events: none; z-index: 1000; }
.wrong-click-target .target-ring { position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(10,132,255,0.25); border: 2px solid rgba(10,132,255,0.6); top: 50%; left: 50%; transform: translate(-50%,-50%) scale(0); opacity: 0; }
.wrong-click-target.active .target-ring { animation: targetPulse 0.8s ease-out forwards; }
.wrong-click-target .target-dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: rgba(10,132,255,0.9); top: 50%; left: 50%; transform: translate(-50%,-50%) scale(0); opacity: 0; }
.wrong-click-target.active .target-dot { animation: dotPulse 0.8s ease-out forwards; }
@keyframes targetPulse { 0% { transform: translate(-50%,-50%) scale(0.3); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; } }
@keyframes dotPulse { 0% { transform: translate(-50%,-50%) scale(0); opacity: 1; } 50% { transform: translate(-50%,-50%) scale(1.2); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(0.5); opacity: 0; } }
#step-counter { position: fixed; bottom: 16px; right: 16px; background: rgba(0,0,0,0.5); color: #fff; padding: 6px 14px; border-radius: 20px; font: 13px/1 -apple-system, sans-serif; z-index: 1001; opacity: 0.6; transition: opacity 0.2s; }
#step-counter:hover { opacity: 1; }
`.trim()

const RUNTIME_JS = `
(function() {
  const config = JSON.parse(document.getElementById('demo-config').textContent);
  const steps = config.steps;
  let currentStep = 0;
  let animationTimer = null;

  const viewport = document.getElementById('viewport-container');
  const frame = document.getElementById('step-frame');
  const cursorEl = document.getElementById('animated-cursor');
  const rippleEl = document.getElementById('click-ripple');
  const zoneOverlay = document.getElementById('click-zone-overlay');
  const counterEl = document.getElementById('step-counter');

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

  function renderStep(index) {
    if (index < 0 || index >= steps.length) return;
    currentStep = index;
    const step = steps[index];

    clearTimeout(animationTimer);
    cursorEl.classList.remove('visible', 'animating');
    rippleEl.classList.remove('active');
    zoneOverlay.innerHTML = '';
    zoneOverlay.style.transform = '';

    const template = document.getElementById('step-' + index);
    frame.srcdoc = template.innerHTML;

    scaleViewport();

    if (counterEl) {
      counterEl.textContent = (index + 1) + ' / ' + steps.length;
    }

    if (step.clickZone && index < steps.length - 1) {
      var cz = step.clickZone;
      var cx = cz.x + cz.width / 2;
      var cy = cz.y + cz.height / 2;
      var r = cz.width / 2;
      var zone = document.createElement('div');
      zone.className = 'click-zone';
      zone.style.left = (cx - r) + '%';
      zone.style.top = (cy - r) + '%';
      zone.style.width = (r * 2) + '%';
      zone.style.height = (r * 2) + '%';
      zone.addEventListener('click', function(e) { e.stopPropagation(); goToStep(index + 1); });
      zoneOverlay.appendChild(zone);

      var sx = cz.scrollX || 0;
      var sy = cz.scrollY || 0;
      // Initial state: assume page loads at top (0,0) so offset is exactly sx, sy.
      zoneOverlay.style.transform = 'translate(' + sx + 'px, ' + sy + 'px)';

      frame.onload = function() {
        var win = frame.contentWindow;
        if (!win) return;
        
        // Remove automatic jump to click zone! Load at the top of the page.
        // Update overlay in case the viewport isn't exactly at 0,0 somehow.
        var dsx = win.scrollX - sx;
        var dsy = win.scrollY - sy;
        zoneOverlay.style.transform = 'translate(' + (-dsx) + 'px, ' + (-dsy) + 'px)';
        
        // Sync scroll to click zone overlay natively
        win.addEventListener('scroll', function() {
          dsx = win.scrollX - sx;
          dsy = win.scrollY - sy;
          zoneOverlay.style.transform = 'translate(' + (-dsx) + 'px, ' + (-dsy) + 'px)';
        });

        // Listen for wrong clicks inside the iframe
        win.document.addEventListener('click', function(e) {
          showWrongClickTarget(cx, cy);
        });
      };

      // Listen for wrong clicks on the outer container
      viewport.addEventListener('click', function wrongClickHandler(e) {
        if (e.target === zone || zone.contains(e.target)) return;
        showWrongClickTarget(cx, cy);
      }, { once: false });
    }

    if (step.cursor && step.cursor.enabled) {
      animationTimer = setTimeout(function() {
        animateCursor(step.cursor);
      }, step.cursor.delayMs || 500);
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

  function showWrongClickTarget(cx, cy) {
    var existing = document.querySelector('.wrong-click-target');
    if (existing) existing.remove();

    var target = document.createElement('div');
    target.className = 'wrong-click-target';
    target.style.left = cx + '%';
    target.style.top = cy + '%';

    var ring = document.createElement('div');
    ring.className = 'target-ring';
    target.appendChild(ring);

    var dot = document.createElement('div');
    dot.className = 'target-dot';
    target.appendChild(dot);

    zoneOverlay.appendChild(target);
    void target.offsetWidth;
    target.classList.add('active');

    setTimeout(function() {
      target.remove();
    }, 1200);
  }

  function goToStep(index) {
    if (index < 0 || index >= steps.length) return;
    const step = steps[currentStep];
    const transition = step.transition || 'fade';

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

  if (config.keyboardNav !== false) {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToStep(currentStep + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToStep(currentStep - 1);
      }
    });
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

    // Escape any </template> in captured html
    const safeHtml = html.replace(/<\/template>/gi, '<\\/template>')
    stepTemplates.push(`<template id="step-${i}">${safeHtml}</template>`)

    const capture = dbGetCapture(step.captureId)
    stepConfigs.push({
      id: step.id,
      label: step.label,
      clickZone: step.clickZone,
      cursor: step.cursorConfig,
      transition: step.transition,
      viewportWidth: capture?.viewportWidth || 1440,
      viewportHeight: capture?.viewportHeight || 900,
    })
  }

  // 3. Build demo config JSON
  const demoConfig = JSON.stringify({
    demoName: demo.name,
    keyboardNav: options.keyboardNav,
    showStepCounter: options.showStepCounter,
    presentationMode: !!options.presentationMode,
    steps: stepConfigs,
  })

  // 4. Assemble final HTML
  const stepCounterHtml = options.showStepCounter ? '<div id="step-counter"></div>' : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Demo: ${escapeHtml(demo.name)}</title>
<style>
${options.presentationMode ? RUNTIME_CSS_PRESENTATION : RUNTIME_CSS_RAW}
${RUNTIME_CSS_SHARED}
</style>
</head>
<body>
<div id="demo-root">
  <div id="viewport-container">
    <iframe id="step-frame" sandbox="allow-same-origin allow-scripts"></iframe>
  </div>
  <div id="cursor-layer">
    <div id="animated-cursor">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M5 3l14 8-6.5 2.5L10 20z" fill="#000" stroke="#fff" stroke-width="1.5"/>
      </svg>
    </div>
    <div id="click-ripple"></div>
  </div>
  <div id="click-zone-overlay"></div>
  ${stepCounterHtml}
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
