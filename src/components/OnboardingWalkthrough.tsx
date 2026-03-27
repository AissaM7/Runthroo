import React, { useState, useEffect, useRef } from 'react'
import { X, ArrowRight, Sparkles, Crosshair, Zap } from 'lucide-react'

interface Props {
  onClose: () => void
}

// ─── CSS keyframe animations injected via <style> tag ─────────────────────────
const STYLES = `
  @keyframes ob-slide-in-right {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes ob-slide-in-left {
    from { opacity: 0; transform: translateX(-24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes ob-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes ob-scan-down {
    0%   { top:  6%; opacity: 0.25; }
    45%  {           opacity: 0.9;  }
    100% { top: 90%; opacity: 0.25; }
  }
  @keyframes ob-scan-up {
    0%   { top: 90%; opacity: 0.25; }
    45%  {           opacity: 0.9;  }
    100% { top:  6%; opacity: 0.25; }
  }
  @keyframes ob-flash {
    0%   { opacity: 0;    }
    4%   { opacity: 0.07; }
    22%  { opacity: 0;    }
    100% { opacity: 0;    }
  }
  @keyframes ob-dot-travel {
    0%   { left: 2px;              opacity: 0; }
    8%   {                         opacity: 1; }
    92%  {                         opacity: 1; }
    100% { left: calc(100% - 10px); opacity: 0; }
  }
  @keyframes ob-pill-float {
    0%, 100% { transform: translateY(0px);  }
    50%       { transform: translateY(-5px); }
  }
  @keyframes ob-zap-pulse {
    0%, 100% { filter: drop-shadow(0 0 4px rgba(10,132,255,0.4)); }
    50%       { filter: drop-shadow(0 0 10px rgba(10,132,255,0.9)); }
  }
  .ob-in-right  { animation: ob-slide-in-right 0.28s ease-out forwards; }
  .ob-in-left   { animation: ob-slide-in-left  0.28s ease-out forwards; }
  .ob-fade-in   { animation: ob-fade-in        0.32s ease-out forwards; }
  .ob-scan-down { animation: ob-scan-down 2.8s ease-in-out infinite; }
  .ob-scan-up   { animation: ob-scan-up   2.8s ease-in-out infinite; animation-delay: 1.4s; }
  .ob-flash     { animation: ob-flash     3.4s ease-out    infinite; }
  .ob-travel    { animation: ob-dot-travel 1.9s ease-in-out infinite; }
  .ob-float     { animation: ob-pill-float 2.4s ease-in-out infinite; }
  .ob-zap       { animation: ob-zap-pulse  2s ease-in-out  infinite; }
`

// ─── Shared browser chrome bar ────────────────────────────────────────────────
function BrowserBar({ url, showZap = false }: { url: string; showZap?: boolean }) {
  return (
    <div className="h-9 bg-[#252525] border-b border-[#2a2a2a] flex items-center px-3 gap-2 shrink-0">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-[#f24822]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#f2a20d]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#14ae5c]" />
      </div>
      <div className="flex-1 h-5 bg-[#1a1a1a] rounded flex items-center px-2 mx-1 overflow-hidden">
        <span className="text-[10px] font-mono text-[#6e6e6e] truncate">{url}</span>
      </div>
      {showZap && (
        <Zap className="ob-zap w-4 h-4 text-[#0A84FF] flex-shrink-0" strokeWidth={1.75} />
      )}
    </div>
  )
}

// ─── Slide 1: Install Extension ───────────────────────────────────────────────
function Hero1() {
  return (
    <div
      className="h-[260px] relative overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(to bottom, rgba(10,132,255,0.08) 0%, transparent 100%)' }}
    >
      <div
        className="bg-[#2c2c2c] rounded-xl border border-[#3a3a3a] overflow-hidden shadow-2xl"
        style={{ width: 400 }}
      >
        <BrowserBar url="chrome://extensions" showZap />
        <div className="h-[148px] bg-[#1a1a1a] flex flex-col items-center justify-center gap-4 px-6">
          {/* Extension row */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <div className="w-10 h-10 rounded-xl bg-[#0A84FF]/10 border border-[#0A84FF]/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-[#0A84FF]" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-white">Runthroo</div>
              <div className="text-[9px] text-[#6e6e6e] mt-0.5 truncate">Capture web pages for demos</div>
            </div>
            {/* Toggle — ON state */}
            <div className="w-9 h-5 rounded-full bg-[#0A84FF] flex items-center justify-end pr-0.5 flex-shrink-0 shadow-[0_0_8px_rgba(10,132,255,0.4)]">
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </div>
          </div>
          {/* Dev mode badge */}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#14ae5c]" />
            <span className="text-[9px] font-mono text-[#505050]">Developer mode enabled</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Slide 2: Navigate to Product ────────────────────────────────────────────
function Hero2() {
  return (
    <div
      className="h-[260px] relative overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(to bottom, rgba(20,174,92,0.08) 0%, transparent 100%)' }}
    >
      <div
        className="bg-[#2c2c2c] rounded-xl border border-[#3a3a3a] overflow-hidden shadow-2xl"
        style={{ width: 400 }}
      >
        <BrowserBar url="app.yoursaas.io/dashboard" />
        <div className="h-[148px] flex bg-[#1a1a1a]">
          {/* Left nav sidebar */}
          <div className="w-11 bg-[#222222] border-r border-[#2a2a2a] flex flex-col items-center gap-2 py-2.5 flex-shrink-0">
            {(['#f97316', '#a855f7', '#0A84FF', '#14ae5c', '#6e6e6e'] as string[]).map((c, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-md flex-shrink-0"
                style={{ background: c, opacity: i === 2 ? 1 : 0.55 }}
              />
            ))}
          </div>
          {/* Main content area */}
          <div className="flex-1 p-2.5 flex flex-col gap-2 min-w-0 overflow-hidden">
            {/* Metric cards */}
            <div className="flex gap-1.5">
              {([['#0A84FF', 48], ['#14ae5c', 72], ['#f97316', 58]] as [string, number][]).map(([color, pct], i) => (
                <div
                  key={i}
                  className="flex-1 bg-[#252525] rounded-md border border-[#2a2a2a] p-1.5 flex flex-col justify-between"
                  style={{ height: 42 }}
                >
                  <div className="text-[8px] font-medium text-[#505050]">Metric {i + 1}</div>
                  <div className="w-full bg-[#2a2a2a] rounded-sm overflow-hidden" style={{ height: 8 }}>
                    <div
                      className="h-full rounded-sm"
                      style={{ width: `${pct}%`, background: color, opacity: 0.7 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* Line chart */}
            <div className="flex-1 bg-[#252525] rounded-md border border-[#2a2a2a] overflow-hidden">
              <svg width="100%" height="100%" viewBox="0 0 240 48" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="ob-chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,36 C35,30 65,22 95,19 C125,16 148,26 175,16 C200,6 220,18 240,13 L240,48 L0,48 Z"
                  fill="url(#ob-chart-grad)"
                />
                <path
                  d="M0,36 C35,30 65,22 95,19 C125,16 148,26 175,16 C200,6 220,18 240,13"
                  stroke="#0A84FF"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Data point dot */}
                <circle cx="175" cy="16" r="3" fill="#0A84FF" />
                <circle cx="175" cy="16" r="5" fill="none" stroke="#0A84FF" strokeWidth="1" opacity="0.4" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Slide 3: Capture the Page ────────────────────────────────────────────────
function Hero3() {
  const pills = [
    { label: 'HTML ✓', pos: { top: '30%', left: '2.5%' }, delay: '0s' },
    { label: 'CSS ✓', pos: { top: '44%', right: '2.5%' }, delay: '0.5s' },
    { label: 'Images ✓', pos: { top: '66%', left: '1.5%' }, delay: '1s' },
    { label: 'Fonts ✓', pos: { top: '74%', right: '1.5%' }, delay: '1.5s' },
  ]

  return (
    <div
      className="h-[260px] relative overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(to bottom, rgba(168,85,247,0.08) 0%, transparent 100%)' }}
    >
      {/* Browser wrapper — positioned for crosshair overlay */}
      <div className="relative" style={{ width: 400 }}>
        <div className="bg-[#2c2c2c] rounded-xl border border-[#3a3a3a] overflow-hidden shadow-2xl">
          <BrowserBar url="app.yoursaas.io/dashboard" showZap />
          {/* Content area with scanning animations */}
          <div className="h-[148px] bg-[#1a1a1a] relative overflow-hidden">
            {/* Fake page content */}
            <div className="absolute inset-0 p-3 flex flex-col gap-2">
              {([78, 52, 90, 42, 70, 60] as number[]).map((w, i) => (
                <div
                  key={i}
                  className="h-2.5 rounded bg-[#252525]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
            {/* Flash overlay */}
            <div className="absolute inset-0 bg-white ob-flash pointer-events-none" />
            {/* Scan line 1 — purple, sweeping down */}
            <div
              className="absolute left-0 right-0 h-[1px] ob-scan-down pointer-events-none"
              style={{ background: 'linear-gradient(to right, transparent, rgba(168,85,247,0.9), transparent)' }}
            />
            {/* Scan line 2 — blue, sweeping up */}
            <div
              className="absolute left-0 right-0 h-[1px] ob-scan-up pointer-events-none"
              style={{ background: 'linear-gradient(to right, transparent, rgba(10,132,255,0.8), transparent)' }}
            />
          </div>
        </div>

        {/* Crosshair overlay — centered over content area only */}
        <div
          className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
          style={{ top: 36, height: 148 }}
        >
          <Crosshair
            className="w-14 h-14 text-[#a855f7]"
            strokeWidth={1}
            style={{ opacity: 0.55 }}
          />
        </div>
      </div>

      {/* Floating confirmation pills — positioned relative to hero zone */}
      {pills.map(({ label, pos, delay }) => (
        <div
          key={label}
          className="absolute bg-[#14ae5c]/10 border border-[#14ae5c]/25 text-[#14ae5c] text-[9px] font-mono px-2 py-1 rounded-full ob-float whitespace-nowrap pointer-events-none"
          style={{ ...pos, animationDelay: delay }}
        >
          {label}
        </div>
      ))}
    </div>
  )
}

// ─── Slide 4: Build & Export ──────────────────────────────────────────────────
function Hero4() {
  const pageColors = ['#0A84FF', '#a855f7', '#14ae5c'] as string[]

  return (
    <div
      className="h-[260px] relative overflow-hidden flex flex-col items-center justify-center gap-5"
      style={{ background: 'linear-gradient(to bottom, rgba(249,115,22,0.08) 0%, transparent 100%)' }}
    >
      {/* Pages + animated arrows */}
      <div className="flex items-center">
        {pageColors.map((color, i) => (
          <React.Fragment key={i}>
            {/* Page card */}
            <div className="relative">
              <div
                className="w-24 h-16 bg-[#2c2c2c] rounded-lg border border-[#3a3a3a] shadow-lg overflow-hidden"
                style={i === 1 ? { borderColor: '#0A84FF', boxShadow: '0 0 16px rgba(10,132,255,0.2)' } : {}}
              >
                <div className="h-3 w-full" style={{ background: color, opacity: 0.65 }} />
                <div className="p-1.5 flex flex-col gap-1">
                  <div className="h-1.5 bg-[#404040] rounded-sm" style={{ width: '75%' }} />
                  <div className="h-1.5 bg-[#383838] rounded-sm" style={{ width: '50%' }} />
                  <div className="h-1.5 bg-[#383838] rounded-sm" style={{ width: '85%' }} />
                </div>
              </div>

              {/* Bouncing cursor on the middle (active) page */}
              {i === 1 && (
                <div className="absolute -top-3 right-2 animate-bounce pointer-events-none">
                  <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                    <path
                      d="M1.5 1.5l11 6-4.5 1.8-1.8 5.7z"
                      fill="#0A84FF"
                      stroke="#0A84FF"
                      strokeWidth="0.75"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Animated arrow connector */}
            {i < pageColors.length - 1 && (
              <div className="relative flex items-center mx-1.5" style={{ width: 30 }}>
                {/* Line */}
                <div className="w-full h-px bg-[#3a3a3a]" />
                {/* Arrowhead */}
                <svg
                  className="absolute right-0"
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                  width="5"
                  height="7"
                  viewBox="0 0 5 7"
                  fill="none"
                >
                  <path d="M0.5 1L4.5 3.5L0.5 6" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {/* Traveling dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ob-travel"
                  style={{
                    background: '#0A84FF',
                    boxShadow: '0 0 6px rgba(10,132,255,0.8)',
                    animationDelay: `${i * 0.95}s`,
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mini timeline strip */}
      <div className="bg-[#252525] border border-[#3a3a3a] rounded-lg px-3 py-2 flex items-center gap-2">
        {pageColors.map((color, i) => (
          <div
            key={i}
            className="w-14 h-8 rounded overflow-hidden border"
            style={{
              borderColor: i === 1 ? '#0A84FF' : '#3a3a3a',
              boxShadow: i === 1 ? '0 0 8px rgba(10,132,255,0.3)' : 'none',
            }}
          >
            <div className="h-2.5 w-full" style={{ background: color, opacity: 0.65 }} />
            <div className="h-full bg-[#2c2c2c]" />
          </div>
        ))}
        {/* Add button */}
        <div className="w-14 h-8 rounded border border-dashed border-[#404040] flex items-center justify-center text-[#505050] text-[16px] leading-none">
          +
        </div>
      </div>
    </div>
  )
}

// ─── Slide data ───────────────────────────────────────────────────────────────
interface SlideData {
  Hero: React.FC
  step: string
  title: string
  body: string
}

const SLIDES: SlideData[] = [
  {
    Hero: Hero1,
    step: 'Step 1 of 4',
    title: 'Install the Chrome Extension',
    body: 'Open Chrome and go to chrome://extensions. Enable Developer Mode, click "Load unpacked", and select the extension folder from your Runthroo directory.',
  },
  {
    Hero: Hero2,
    step: 'Step 2 of 4',
    title: 'Navigate to Your Product',
    body: 'Log into the product you want to demo — Embrace, Honeycomb, Datadog, or any web app. Navigate to the exact page you want to capture for your demo.',
  },
  {
    Hero: Hero3,
    step: 'Step 3 of 4',
    title: 'Capture the Page',
    body: 'Click the Runthroo icon in your toolbar. Enter a platform name and label, then hit "Capture This Page". The extension captures the full DOM with all styles, images, and fonts inlined.',
  },
  {
    Hero: Hero4,
    step: 'Step 4 of 4',
    title: 'Build & Export Your Demo',
    body: 'Captured pages appear in your library. Switch to the Editor, arrange them into a flow, add click zones and animated cursors, then export as a single HTML file. Zero dependencies — just double-click and present.',
  },
]

// ─── Main component ───────────────────────────────────────────────────────────
export function OnboardingWalkthrough({ onClose }: Props) {
  const [current, setCurrent] = useState(0)
  const [slideKey, setSlideKey] = useState(0)
  const [animCls, setAnimCls] = useState<string>('ob-fade-in')
  const currentRef = useRef(current)
  currentRef.current = current

  function goTo(idx: number) {
    if (idx < 0 || idx >= SLIDES.length || idx === currentRef.current) return
    setAnimCls(idx > currentRef.current ? 'ob-in-right' : 'ob-in-left')
    setSlideKey(k => k + 1)
    setCurrent(idx)
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goTo(currentRef.current + 1)
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goTo(currentRef.current - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isFirst = current === 0
  const isLast = current === SLIDES.length - 1
  const slide = SLIDES[current]
  const { Hero } = slide

  return (
    <>
      <style>{STYLES}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(14px)' }}
        onClick={onClose}
      >
        <div
          className="relative bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl overflow-hidden"
          style={{ width: 560, boxShadow: '0 24px 80px rgba(0,0,0,0.65)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-[#808080] hover:text-white transition-all duration-150 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Animated slide — key triggers remount → CSS animation plays */}
          <div key={slideKey} className={animCls}>
            {/* Hero zone */}
            <Hero />

            {/* Content zone */}
            <div className="px-8 pb-8 pt-5">
              <p className="text-[11px] font-mono text-[#0A84FF] tracking-[0.12em] uppercase mb-2.5">
                {slide.step}
              </p>
              <h2 className="text-[22px] font-semibold text-white tracking-tight leading-tight">
                {slide.title}
              </h2>
              <p className="text-[13px] text-[#808080] mt-2.5 leading-relaxed" style={{ maxWidth: 430 }}>
                {slide.body}
              </p>

              {/* Navigation row */}
              <div className="flex items-center justify-between mt-7">
                {/* Dot indicators */}
                <div className="flex items-center gap-2">
                  {SLIDES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${i === current
                        ? 'w-5 bg-[#0A84FF]'
                        : 'w-2 bg-[#404040] hover:bg-[#505050]'
                        }`}
                    />
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {/* Skip / Back */}
                  {isFirst ? (
                    <button
                      onClick={onClose}
                      className="text-[12px] text-[#6e6e6e] hover:text-[#ababab] transition-colors cursor-pointer px-2 py-1"
                    >
                      Skip
                    </button>
                  ) : (
                    <button
                      onClick={() => goTo(current - 1)}
                      className="text-[12px] text-[#6e6e6e] hover:text-[#ababab] transition-colors cursor-pointer px-2 py-1"
                    >
                      Back
                    </button>
                  )}

                  {/* Next / Get Started */}
                  <button
                    onClick={isLast ? onClose : () => goTo(current + 1)}
                    className="px-5 py-2.5 bg-[#0A84FF] hover:bg-[#0066cc] hover:shadow-[0_0_20px_rgba(10,132,255,0.4)] text-white text-[12px] font-semibold rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-2"
                  >
                    {isLast ? (
                      <>Get Started <Sparkles className="w-3.5 h-3.5" /></>
                    ) : (
                      <>Next <ArrowRight className="w-3.5 h-3.5" /></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
