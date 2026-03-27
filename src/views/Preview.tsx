import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useDemoStore } from '../stores/demoStore'
import { useUIStore } from '../stores/uiStore'
import { useCaptureStore } from '../stores/captureStore'
import type { DemoStep, CursorConfig } from '../types/index'
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
  }, [])

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

  function renderStep(idx: number, data: StepWithHtml[]) {
    if (idx < 0 || idx >= data.length) return
    if (animTimerRef.current) clearTimeout(animTimerRef.current)
    if (cursorRef.current) cursorRef.current.classList.remove('visible', 'animating')
    if (rippleRef.current) rippleRef.current.classList.remove('active')

    if (iframeRef.current) iframeRef.current.srcdoc = data[idx].html
    scaleViewport(idx, data)
    setCurrentIdx(idx)

    const { step } = data[idx]
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
        }, 300)
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

  // Resize
  useEffect(() => {
    const handler = () => scaleViewport(currentIdx, steps)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [currentIdx, steps])

  if (!currentDemo) return null

  const currentStepData = steps[currentIdx]

  return (
    <div className="fixed inset-0 z-50 bg-[#1e1e1e] flex items-center justify-center">
      {loading && (
        <div className="text-[#ababab] text-[11px]">Loading preview…</div>
      )}

      {/* Viewport */}
      <div ref={viewportRef} className="relative bg-white overflow-hidden" style={{ position: 'absolute', boxShadow: '0 8px 48px rgba(0,0,0,0.6)' }}>
        <iframe ref={iframeRef} sandbox="allow-same-origin allow-scripts" style={{ width: '100%', height: '100%', border: 'none' }} />
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

      {/* Click zone overlay — only covers the specific zone area, rest of page stays interactive */}
      {currentStepData?.step.clickZone && currentIdx < steps.length - 1 && viewportRef.current && (() => {
        const vpRect = viewportRef.current.getBoundingClientRect()
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
              borderRadius: 4,
              transition: 'background 0.2s',
            }}
            className="hover:bg-blue-500/10"
            onClick={() => goToStep(currentIdx + 1, steps)}
          />
        )
      })()}

      {/* Floating control bar — top right */}
      <div
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
