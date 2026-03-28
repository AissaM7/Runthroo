import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { ClickZone } from '../types/index'
import { useUIStore } from '../stores/uiStore'

interface Props {
  clickZone: ClickZone | null
  viewportWidth: number
  viewportHeight: number
  containerWidth: number
  containerHeight: number
  scale: number
  onChange: (zone: ClickZone | null) => void
}

// ─── SCROLL CONTAINER DETECTION ──────────────────────────────────────
// SPA dashboards (Embrace, etc.) scroll inside a nested <div>, not
// the window. window.scrollY returns 0 in these cases. This helper
// finds the ACTUAL element that scrolls by scanning for elements with
// overflow:auto/scroll and scrollable content.
function findScrollInfo(iframe: HTMLIFrameElement): {
  scrollX: number
  scrollY: number
  scrollWidth: number
  scrollHeight: number
} {
  const fallback = {
    scrollX: 0,
    scrollY: 0,
    scrollWidth: iframe.clientWidth || 1440,
    scrollHeight: iframe.clientHeight || 900,
  }

  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) return fallback

  // ── Method 1: Standard window/document scroll ──
  const winScrollY = win.scrollY || win.pageYOffset || 0
  const winScrollX = win.scrollX || win.pageXOffset || 0
  const docScrollH = Math.max(
    doc.documentElement?.scrollHeight || 0,
    doc.body?.scrollHeight || 0
  )

  if (winScrollY > 0 || docScrollH > iframe.clientHeight + 50) {
    return {
      scrollX: winScrollX,
      scrollY: winScrollY,
      scrollWidth: doc.documentElement?.scrollWidth || iframe.clientWidth,
      scrollHeight: docScrollH || iframe.clientHeight,
    }
  }

  // ── Method 2: Find nested scroll container (SPA) ──
  // Scan for the element with the most scrollable content that has
  // overflow: auto or scroll. This catches SPAs like Embrace.
  let bestEl: HTMLElement | null = null
  let maxScrollable = 50 // minimum threshold

  try {
    const all = doc.querySelectorAll('*')
    for (let i = 0; i < all.length; i++) {
      const el = all[i] as HTMLElement
      const scrollable = el.scrollHeight - el.clientHeight
      if (scrollable > maxScrollable) {
        const style = getComputedStyle(el)
        if (
          style.overflowY === 'auto' || style.overflowY === 'scroll' ||
          style.overflow === 'auto' || style.overflow === 'scroll'
        ) {
          maxScrollable = scrollable
          bestEl = el
        }
      }
    }
  } catch { /* cross-origin or not ready */ }

  if (bestEl) {
    return {
      scrollX: bestEl.scrollLeft || 0,
      scrollY: bestEl.scrollTop || 0,
      scrollWidth: bestEl.scrollWidth || iframe.clientWidth,
      scrollHeight: bestEl.scrollHeight || iframe.clientHeight,
    }
  }

  // ── Fallback: document dimensions ──
  return {
    scrollX: winScrollX,
    scrollY: winScrollY,
    scrollWidth: doc.documentElement?.scrollWidth || iframe.clientWidth,
    scrollHeight: docScrollH || iframe.clientHeight,
  }
}

// ═════════════════════════════════════════════════════════════════════════
// ClickZoneOverlay — "Document-Percentage Anchoring"
//
// SAVING:
//   centerY% = (localY + scrollTop) / scrollHeight × 100
//   centerX% = localX / viewportWidth × 100
//
// RENDERING:
//   topPx = (centerY% / 100 × scrollHeight) − currentScrollY
//   overlay = topPx × scale
// ═════════════════════════════════════════════════════════════════════════
export function ClickZoneOverlay({
  clickZone,
  viewportWidth,
  viewportHeight,
  scale,
  onChange,
}: Props) {
  const { drawMode, setDrawMode } = useUIStore()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [center, setCenter] = useState({ x: 0, y: 0 })
  const [radius, setRadius] = useState(0)

  // Live scroll state from the iframe's actual scroll container
  const [scrollState, setScrollState] = useState({
    scrollX: 0,
    scrollY: 0,
    scrollWidth: viewportWidth,
    scrollHeight: viewportHeight,
  })

  const isDrawMode = drawMode === 'click-zone'

  // ─── SCROLL POLLING (50ms) ───────────────────────────────────────
  // Polls the iframe's scroll container (window OR nested div).
  useEffect(() => {
    const poll = () => {
      const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null
      if (!iframe) return
      const info = findScrollInfo(iframe)
      setScrollState(prev => {
        if (
          prev.scrollX !== info.scrollX ||
          prev.scrollY !== info.scrollY ||
          prev.scrollHeight !== info.scrollHeight
        ) {
          return info
        }
        return prev
      })
    }
    poll() // immediate first read
    const interval = setInterval(poll, 50)
    return () => clearInterval(interval)
  }, [])

  // ─── DRAWING ─────────────────────────────────────────────────────
  // getRelativePos: overlay-relative mouse position (for live preview)
  function getRelativePos(e: React.MouseEvent) {
    const rect = overlayRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!isDrawMode) return
    e.preventDefault()
    setCenter(getRelativePos(e))
    setRadius(0)
    setDrawing(true)
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawing) return
    const pos = getRelativePos(e)
    const dx = pos.x - center.x
    const dy = pos.y - center.y
    setRadius(Math.sqrt(dx * dx + dy * dy))
  }

  function onMouseUp(e: React.MouseEvent) {
    if (!drawing) return
    setDrawing(false)
    if (radius < 10) return

    // ── COORDINATE NORMALIZATION ─────────────────────────────
    // Use iframe.getBoundingClientRect() to find the true (0,0) of the iframe.
    // This eliminates the "2cm jump" from the editor's top bar + sidebar.
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null
    if (!iframe) return
    const iframeRect = iframe.getBoundingClientRect()
    const info = findScrollInfo(iframe)

    // Convert mouse position to iframe-internal pixels (divide by scale)
    const localX = (e.clientX - iframeRect.left) / scale
    const localY = (e.clientY - iframeRect.top) / scale

    // Convert radius from overlay pixels to iframe-internal pixels
    const radiusPx = radius / scale

    // ── DOCUMENT-PERCENTAGE ANCHORING ────────────────────────
    // X: percentage of viewport width (no horizontal scroll)
    // Y: percentage of total scrollable height
    const centerXPct = (localX / viewportWidth) * 100
    const centerYPct = ((localY + info.scrollY) / info.scrollHeight) * 100
    const radiusPctW = (radiusPx / viewportWidth) * 100

    console.log('[ClickZone] SAVE doc-%:', {
      centerXPct: centerXPct.toFixed(1),
      centerYPct: centerYPct.toFixed(1),
      radiusPctW: radiusPctW.toFixed(1),
      scrollY: info.scrollY,
      scrollHeight: info.scrollHeight,
    })

    // Store as bounding box percentages + scrollHeight for export
    onChange({
      x: centerXPct,
      y: centerYPct,
      width: radiusPctW,
      height: radiusPctW, // same for circles
      scrollX: info.scrollWidth,  // store total width for export
      scrollY: info.scrollHeight, // store total height for export
      highlightOnHover: false,
    })
    setDrawMode('none')
  }

  // ─── RENDER SAVED CIRCLE ─────────────────────────────────────────
  // Convert document-percentage back to overlay pixels:
  //   iframeY = (savedY% / 100 × scrollHeight) − currentScrollY
  //   overlayPixel = iframeY × scale
  const savedCircle = clickZone
    ? (() => {
      const sh = scrollState.scrollHeight
      const currentScrollY = scrollState.scrollY

      // Reconstruct iframe-viewport position from percentages
      const centerXiframe = (clickZone.x / 100) * viewportWidth
      const centerYdoc = (clickZone.y / 100) * sh
      const centerYviewport = centerYdoc - currentScrollY
      const radiusIframe = (clickZone.width / 100) * viewportWidth

      // Scale to overlay pixels
      return {
        cx: centerXiframe * scale,
        cy: centerYviewport * scale,
        r: radiusIframe * scale,
      }
    })()
    : null

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0"
      style={{
        pointerEvents: isDrawMode ? 'auto' : 'none',
        cursor: isDrawMode ? 'crosshair' : 'default',
        overflow: 'hidden',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Saved zone */}
      {savedCircle && (
        <div
          className="absolute"
          style={{
            left: savedCircle.cx - savedCircle.r,
            top: savedCircle.cy - savedCircle.r,
            width: savedCircle.r * 2,
            height: savedCircle.r * 2,
            borderRadius: '50%',
            border: '2px dashed #0A84FF',
            background: 'rgba(10,132,255,0.04)',
            pointerEvents: 'none',
          }}
        >
          <div
            className="absolute"
            style={{
              left: '50%', top: '50%',
              width: 8, height: 8,
              marginLeft: -4, marginTop: -4,
              borderRadius: '50%',
              background: '#0A84FF',
            }}
          />
          <div
            className="absolute"
            style={{
              left: '50%', top: '50%',
              width: '60%', height: '60%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: '1px dashed rgba(10,132,255,0.3)',
            }}
          />
        </div>
      )}

      {/* Drawing preview */}
      {drawing && radius > 5 && (
        <div
          className="absolute"
          style={{
            left: center.x - radius,
            top: center.y - radius,
            width: radius * 2,
            height: radius * 2,
            borderRadius: '50%',
            border: '2px dashed #0A84FF',
            background: 'rgba(10,132,255,0.06)',
            pointerEvents: 'none',
          }}
        >
          <div
            className="absolute"
            style={{
              left: '50%', top: '50%',
              width: 6, height: 6,
              marginLeft: -3, marginTop: -3,
              borderRadius: '50%',
              background: '#0A84FF',
            }}
          />
        </div>
      )}
    </div>
  )
}
