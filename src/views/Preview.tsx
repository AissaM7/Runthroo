import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useDemoStore } from '../stores/demoStore'
import { useUIStore } from '../stores/uiStore'
import { useCaptureStore } from '../stores/captureStore'
import type { DemoStep, CursorConfig, BranchClickZone } from '../types/index'
import { CloseIcon } from '../components/Icons'

interface StepWithHtml {
  step: DemoStep
  html: string
  viewportWidth: number
  viewportHeight: number
}

export function Preview() {
  const { currentDemo } = useDemoStore()
  const { setView } = useUIStore()
  const { captures } = useCaptureStore()
  const [steps, setSteps] = useState<StepWithHtml[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const rippleRef = useRef<HTMLDivElement>(null)
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [vpRect, setVpRect] = useState<DOMRect | null>(null)
  const [hintTargets, setHintTargets] = useState<{ x: number; y: number }[]>([])
  const [hintKey, setHintKey] = useState(0)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep vpRect in sync with viewport position
  const updateVpRect = useCallback(() => {
    if (viewportRef.current) {
      setVpRect(viewportRef.current.getBoundingClientRect())
    }
  }, [])

  // Load all step HTML upfront
  useEffect(() => {
    if (!currentDemo) return
    Promise.all(
      currentDemo.steps.map(async (step) => {
        const html = await window.api.readCaptureHtml(step.captureId)
        const cap = captures.find(c => c.id === step.captureId)
        return { step, html, viewportWidth: cap?.viewportWidth ?? 1440, viewportHeight: cap?.viewportHeight ?? 900 }
      })
    ).then(loaded => { setSteps(loaded); setLoading(false) })
  }, [currentDemo])

  const scaleViewport = useCallback((idx: number, data: StepWithHtml[]) => {
    if (!viewportRef.current || !data[idx]) return
    const { viewportWidth: vw, viewportHeight: vh } = data[idx]
    const scaleX = window.innerWidth / vw
    const scaleY = window.innerHeight / vh
    const scale = Math.min(scaleX, scaleY, 1) * 0.95
    viewportRef.current.style.width = `${vw}px`
    viewportRef.current.style.height = `${vh}px`
    viewportRef.current.style.transform = `scale(${scale})`
    viewportRef.current.style.transformOrigin = 'center center'
    // Update vpRect after the scale change takes effect
    requestAnimationFrame(updateVpRect)
  }, [updateVpRect])

  function animateCursor(cfg: CursorConfig) {
    if (!cursorRef.current || !rippleRef.current) return
    const el = cursorRef.current
    el.style.left = `${cfg.startX}%`
    el.style.top = `${cfg.startY}%`
    el.style.setProperty('--cursor-duration', `${cfg.durationMs}ms`)
    el.style.setProperty('--cursor-easing', cfg.easing)
    el.classList.add('visible')
    el.classList.remove('animating')
    void el.offsetWidth
    el.classList.add('animating')
    el.style.left = `${cfg.endX}%`
    el.style.top = `${cfg.endY}%`

    setTimeout(() => {
      if (cfg.showClickEffect && rippleRef.current) {
        const r = rippleRef.current
        r.style.left = `${cfg.endX}%`
        r.style.top = `${cfg.endY}%`
        r.classList.remove('active')
        void r.offsetWidth
        r.classList.add('active')
      }
      if (cfg.loop) setTimeout(() => animateCursor(cfg), 800)
    }, cfg.durationMs)
  }

  // Apply text edits, hidden elements, and blur zones to the iframe document
  function applyEditorChangesToDoc(doc: Document, step: DemoStep) {
    // ── Text edits ──
    const edits = step.textEdits || []
    for (const edit of edits) {
      try {
        const el = doc.querySelector(edit.selector)
        if (el) (el as HTMLElement).innerText = edit.newText
      } catch { }
    }

    // ── Hidden elements ──
    const hidden = step.hiddenElements || []
    if (hidden.length > 0) {
      const styleEl = doc.createElement('style')
      styleEl.textContent = hidden.map(sel => `${sel} { display: none !important; }`).join('\n')
      doc.head.appendChild(styleEl)
    }

    // ── Blur zones (rendered as overlay divs inside the iframe) ──
    const blurZones = step.blurZones || []
    if (blurZones.length > 0) {
      const overlay = doc.createElement('div')
      overlay.id = 'runthroo-blur-overlay'
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999999;'
      for (const z of blurZones) {
        const zoneEl = doc.createElement('div')
        zoneEl.style.cssText = `position:absolute;left:${z.x}%;top:${z.y}%;width:${z.width}%;height:${z.height}%;border-radius:4px;pointer-events:none;`
        if (z.mode === 'redact') {
          zoneEl.style.background = z.color || '#333'
        } else {
          zoneEl.style.backdropFilter = `blur(${z.intensity || 8}px)`
            ; (zoneEl.style as any).webkitBackdropFilter = `blur(${z.intensity || 8}px)`
          zoneEl.style.background = 'rgba(128,128,128,0.1)'
        }
        overlay.appendChild(zoneEl)
      }
      doc.body.appendChild(overlay)
    }

    // ── Block navigation inside the iframe ──
    try {
      const navStyle = doc.createElement('style')
      navStyle.textContent = 'a, a *, button, [role="button"], input[type="submit"] { cursor: default !important; }'
      doc.head.appendChild(navStyle)

      doc.addEventListener('click', (e: Event) => {
        // Signal to parent that the user clicked inside the iframe (wrong-click hint)
        try { window.parent.postMessage('runthroo-wrong-click', '*') } catch { }

        let target = e.target as HTMLElement | null
        while (target && target !== doc.documentElement) {
          const tag = target.tagName
          if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || target.getAttribute('role') === 'button') {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            return false
          }
          target = target.parentElement
        }
      }, true)

      const allLinks = doc.querySelectorAll('a[href]')
      for (let i = 0; i < allLinks.length; i++) {
        allLinks[i].setAttribute('href', 'javascript:void(0)')
        allLinks[i].removeAttribute('target')
      }

      doc.addEventListener('submit', (e: Event) => { e.preventDefault(); e.stopImmediatePropagation() }, true)

      const iframeWin = iframeRef.current?.contentWindow
      if (iframeWin) {
        ; (iframeWin as any).open = () => null
      }
    } catch { }
  }

  // Show wrong-click animation hints at all click zone positions
  function showWrongClickHints(stepData: StepWithHtml) {
    if (!vpRect) return
    const { step, viewportWidth: vw, viewportHeight: vh } = stepData
    const targets: { x: number; y: number }[] = []

    // Legacy click zone — hint at center of zone
    if (step.clickZone) {
      const cz = step.clickZone
      targets.push({
        x: vpRect.left + ((cz.x + cz.width / 2) / 100) * vpRect.width,
        y: vpRect.top + ((cz.y + cz.height / 2) / 100) * vpRect.height,
      })
    }

    // Branch click zones
    const branchZones = step.clickZones || []
    for (const bz of branchZones) {
      targets.push({
        x: vpRect.left + (bz.x / 100) * vpRect.width,
        y: vpRect.top + (bz.y / 100) * vpRect.height,
      })
    }

    if (targets.length === 0) return

    // Clear any existing hints and increment key to force remount (restarts CSS animations)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    setHintTargets(targets)
    setHintKey(k => k + 1)
    // Remove hints after animation completes
    hintTimerRef.current = setTimeout(() => setHintTargets([]), 2200)
  }

  function renderStep(idx: number, data: StepWithHtml[]) {
    if (idx < 0 || idx >= data.length) return
    if (animTimerRef.current) clearTimeout(animTimerRef.current)
    if (cursorRef.current) cursorRef.current.classList.remove('visible', 'animating')
    if (rippleRef.current) rippleRef.current.classList.remove('active')

    const iframe = iframeRef.current
    if (!iframe) return

    const { step } = data[idx]

    // Set up onload handler BEFORE setting srcdoc to avoid race condition
    iframe.onload = () => {
      // Apply editor changes once the new document is loaded
      let attempts = 0
      function tryApply() {
        attempts++
        let doc: Document | null = null
        try { doc = iframe?.contentDocument ?? null } catch { doc = null }
        if (!doc?.body?.innerHTML) {
          if (attempts < 20) setTimeout(tryApply, 80)
          return
        }
        applyEditorChangesToDoc(doc, step)
      }
      tryApply()
    }

    // Now set srcdoc — the onload handler above will fire when it finishes loading
    iframe.srcdoc = data[idx].html
    scaleViewport(idx, data)
    setCurrentIdx(idx)

    if (step.cursorConfig?.enabled) {
      animTimerRef.current = setTimeout(() => animateCursor(step.cursorConfig!), step.cursorConfig.delayMs ?? 500)
    }
  }

  function goToStep(idx: number, data: StepWithHtml[]) {
    if (idx < 0 || idx >= data.length) return
    const cur = data[currentIdx]
    const transition = cur?.step.transition ?? 'fade'
    if (transition === 'instant') {
      renderStep(idx, data)
    } else if (transition === 'fade') {
      if (viewportRef.current) {
        viewportRef.current.style.transition = 'opacity 0.3s'
        viewportRef.current.style.opacity = '0'
        setTimeout(() => {
          renderStep(idx, data)
          if (viewportRef.current) viewportRef.current.style.opacity = '1'
          setTimeout(updateVpRect, 350)
        }, 300)
      }
    } else if (transition === 'slide-left') {
      if (viewportRef.current) {
        viewportRef.current.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s'
        viewportRef.current.style.transform += ' translateX(-30px)'
        viewportRef.current.style.opacity = '0'
        setTimeout(() => {
          if (viewportRef.current) {
            viewportRef.current.style.transition = 'none'
            viewportRef.current.style.transform = ''
            viewportRef.current.style.opacity = ''
          }
          renderStep(idx, data)
          setTimeout(updateVpRect, 50)
        }, 300)
      }
    } else if (transition === 'morph') {
      if (viewportRef.current) {
        // Circle clip-path reveal from center — morph transition
        viewportRef.current.style.transition = 'none'
        viewportRef.current.style.clipPath = 'circle(150% at 50% 50%)'
        void viewportRef.current.offsetWidth
        // Shrink circle to zero
        viewportRef.current.style.transition = 'clip-path 0.2s ease-in'
        viewportRef.current.style.clipPath = 'circle(0% at 50% 50%)'
        setTimeout(() => {
          // Swap content while hidden
          renderStep(idx, data)
          if (viewportRef.current) {
            viewportRef.current.style.transition = 'none'
            viewportRef.current.style.clipPath = 'circle(0% at 50% 50%)'
            void viewportRef.current.offsetWidth
            // Expand circle to reveal
            viewportRef.current.style.transition = 'clip-path 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
            viewportRef.current.style.clipPath = 'circle(150% at 50% 50%)'
          }
          setTimeout(() => {
            if (viewportRef.current) {
              viewportRef.current.style.clipPath = ''
              viewportRef.current.style.transition = ''
            }
            updateVpRect()
          }, 400)
        }, 220)
      }
    }
  }

  // Initial render when steps loaded
  useEffect(() => {
    if (steps.length > 0) renderStep(0, steps)
  }, [steps])

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setView('editor'); return }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goToStep(currentIdx + 1, steps) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToStep(currentIdx - 1, steps) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentIdx, steps])

  // Listen for wrong-click signals from the iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'runthroo-wrong-click') {
        const sd = steps[currentIdx]
        if (sd) showWrongClickHints(sd)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [currentIdx, steps, vpRect])

  // Resize — update both viewport scale and click zone rect
  useEffect(() => {
    const handler = () => {
      scaleViewport(currentIdx, steps)
      setTimeout(updateVpRect, 50)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [currentIdx, steps, updateVpRect])

  if (!currentDemo) return null

  const currentStepData = steps[currentIdx]

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1e1e1e] flex items-center justify-center"
    >
      {loading && (
        <div className="text-[#ababab] text-[11px]">Loading preview…</div>
      )}

      {/* Viewport */}
      <div ref={viewportRef} className="relative overflow-hidden" style={{ position: 'absolute', boxShadow: '0 8px 48px rgba(0,0,0,0.6)', background: 'transparent' }}>
        <iframe ref={iframeRef} sandbox="allow-same-origin allow-scripts" style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }} />
      </div>

      {/* Cursor layer */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
        <div
          ref={cursorRef}
          style={{
            position: 'absolute',
            opacity: 0,
            willChange: 'transform',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 3l14 8-6.5 2.5L10 20z" fill="#000" stroke="#fff" strokeWidth="1.5" />
          </svg>
        </div>
        <div
          ref={rippleRef}
          style={{
            position: 'absolute',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(13,153,255,0.35)',
            transform: 'translate(-50%, -50%) scale(0)',
          }}
        />
      </div>

      {/* Legacy click zone (blue — advances to next step) — always shown when present */}
      {currentStepData?.step.clickZone && currentIdx < steps.length - 1 && vpRect && (() => {
        const zone = currentStepData.step.clickZone
        return (
          <div
            style={{
              position: 'fixed',
              left: vpRect.left + (zone.x / 100) * vpRect.width,
              top: vpRect.top + (zone.y / 100) * vpRect.height,
              width: (zone.width / 100) * vpRect.width,
              height: (zone.height / 100) * vpRect.height,
              cursor: 'pointer',
              zIndex: 999,
              borderRadius: '50%',
              transition: 'background 0.2s',
            }}
            className="hover:bg-blue-500/10"
            onClick={(e) => { e.stopPropagation(); goToStep(currentIdx + 1, steps) }}
          />
        )
      })()}

      {/* Branch click zones — navigate to specific steps */}
      {currentStepData?.step.clickZones && currentStepData.step.clickZones.length > 0 && vpRect && (
        currentStepData.step.clickZones.map(bz => {
          const rPx = (bz.width / 100) * vpRect.width
          return (
            <div
              key={bz.id}
              style={{
                position: 'fixed',
                left: vpRect.left + (bz.x / 100) * vpRect.width - rPx,
                top: vpRect.top + (bz.y / 100) * vpRect.height - rPx,
                width: rPx * 2,
                height: rPx * 2,
                cursor: 'pointer',
                zIndex: 999,
                borderRadius: '50%',
                transition: 'background 0.2s',
              }}
              className="hover:bg-blue-500/10"
              onClick={(e) => {
                e.stopPropagation()
                if (bz.targetStepId === 'next') {
                  goToStep(currentIdx + 1, steps)
                } else {
                  const targetIdx = steps.findIndex(s => s.step.id === bz.targetStepId)
                  if (targetIdx >= 0) goToStep(targetIdx, steps)
                  else goToStep(currentIdx + 1, steps)
                }
              }}
            />
          )
        })
      )}

      {/* Wrong-click hint animations — hintKey forces remount so animations replay */}
      {hintTargets.length > 0 && (
        <React.Fragment key={hintKey}>
          <style>{`
            @keyframes prevHintCore { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 1; } 45% { transform: translate(-50%,-50%) scale(1); opacity: 0.9; } 100% { transform: translate(-50%,-50%) scale(0); opacity: 0; } }
            @keyframes prevHintHalo { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 0.8; } 50% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; } 100% { transform: translate(-50%,-50%) scale(1.4); opacity: 0; } }
            @keyframes prevHintGlow { 0% { transform: translate(-50%,-50%) scale(0.4); opacity: 0; } 12% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; } 55% { transform: translate(-50%,-50%) scale(1); opacity: 0.3; } 100% { transform: translate(-50%,-50%) scale(1.1); opacity: 0; } }
            @keyframes prevHintField { 0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0; } 15% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; } 55% { transform: translate(-50%,-50%) scale(1); opacity: 0.25; } 100% { transform: translate(-50%,-50%) scale(1.05); opacity: 0; } }
            @keyframes prevHintRing1 { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 0.55; } 100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; } }
            @keyframes prevHintRing2 { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 0.35; } 100% { transform: translate(-50%,-50%) scale(3); opacity: 0; } }
            @keyframes prevHintRing3 { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 10% { transform: translate(-50%,-50%) scale(1); opacity: 0.2; } 100% { transform: translate(-50%,-50%) scale(3.4); opacity: 0; } }
          `}</style>
          {hintTargets.map((t, i) => (
            <div key={i} style={{ position: 'fixed', left: t.x, top: t.y, width: 0, height: 0, zIndex: 1002, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', top: 0, left: 0, background: 'radial-gradient(circle, rgba(10,132,255,0.06) 0%, rgba(10,132,255,0.02) 40%, transparent 70%)', animation: 'prevHintField 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards' }} />
              <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', top: 0, left: 0, background: 'radial-gradient(circle, rgba(10,132,255,0.10) 0%, transparent 70%)', animation: 'prevHintGlow 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards' }} />
              <div style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', top: 0, left: 0, border: '0.5px solid rgba(10,132,255,0.12)', animation: 'prevHintRing3 2s cubic-bezier(0.25,0.46,0.45,0.94) 0.16s forwards', opacity: 0 }} />
              <div style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', top: 0, left: 0, border: '1px solid rgba(10,132,255,0.25)', animation: 'prevHintRing2 2s cubic-bezier(0.25,0.46,0.45,0.94) 0.08s forwards', opacity: 0 }} />
              <div style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', top: 0, left: 0, border: '1.5px solid rgba(10,132,255,0.45)', animation: 'prevHintRing1 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards', opacity: 0 }} />
              <div style={{ position: 'absolute', width: 28, height: 28, borderRadius: '50%', top: 0, left: 0, background: 'rgba(10,132,255,0.15)', animation: 'prevHintHalo 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards', opacity: 0 }} />
              <div style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', top: 0, left: 0, background: '#0A84FF', animation: 'prevHintCore 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards', opacity: 0 }} />
            </div>
          ))}
        </React.Fragment>
      )}

      {/* Floating control bar — top right */}
      <div
        data-control-bar
        className="fixed top-3 right-3 flex items-center gap-2 rounded-lg px-3 py-1.5 border border-[#3a3a3a]"
        style={{ zIndex: 1001, background: 'rgba(44,44,44,0.92)', backdropFilter: 'blur(8px)' }}
      >
        {/* Prev arrow */}
        <button
          onClick={() => goToStep(currentIdx - 1, steps)}
          disabled={currentIdx === 0}
          className="w-5 h-5 flex items-center justify-center text-[#ababab] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous step"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Step counter */}
        <span className="text-[11px] font-mono text-[#ababab] tabular-nums">
          {steps.length > 0 ? `${currentIdx + 1} / ${steps.length}` : '— / —'}
        </span>

        {/* Next arrow */}
        <button
          onClick={() => goToStep(currentIdx + 1, steps)}
          disabled={currentIdx >= steps.length - 1}
          className="w-5 h-5 flex items-center justify-center text-[#ababab] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next step"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Separator */}
        <div className="w-px h-3 bg-[#3a3a3a]" />

        {/* Close */}
        <button
          onClick={() => setView('editor')}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#404040] text-[#ababab] hover:text-white transition-colors"
          aria-label="Exit preview"
        >
          <CloseIcon size={12} />
        </button>
      </div>
    </div>
  )
}
