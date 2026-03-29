import React, { useRef, useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { BlurZone } from '../types/index'
import { useUIStore } from '../stores/uiStore'

interface Props {
  blurZones: BlurZone[]
  viewportWidth: number
  viewportHeight: number
  scale: number
  onChange: (zones: BlurZone[]) => void
}

export function BlurZoneOverlay({
  blurZones,
  viewportWidth,
  viewportHeight,
  scale,
  onChange,
}: Props) {
  const { drawMode } = useUIStore()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [startPt, setStartPt] = useState({ x: 0, y: 0 })
  const [currentPt, setCurrentPt] = useState({ x: 0, y: 0 })
  const [blurMode] = useState<'blur' | 'redact'>('blur')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [iframeScrollY, setIframeScrollY] = useState(0)

  const isDrawMode = drawMode === 'blur-draw'

  // Poll iframe scroll position so blur zones move with the page content
  useEffect(() => {
    let animFrame: number | null = null
    function pollScroll() {
      try {
        const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null
        const win = iframe?.contentWindow
        if (win) {
          const sy = win.scrollY || win.pageYOffset || 0
          setIframeScrollY(prev => prev !== sy ? sy : prev)
        }
      } catch {}
      animFrame = requestAnimationFrame(pollScroll)
    }
    pollScroll()
    return () => { if (animFrame !== null) cancelAnimationFrame(animFrame) }
  }, [])

  function getRelativePos(e: React.MouseEvent) {
    const rect = overlayRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!isDrawMode) return
    e.preventDefault()
    const pos = getRelativePos(e)
    setStartPt(pos)
    setCurrentPt(pos)
    setDrawing(true)
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawing) return
    setCurrentPt(getRelativePos(e))
  }

  function onMouseUp() {
    if (!drawing) return
    setDrawing(false)

    const minX = Math.min(startPt.x, currentPt.x)
    const minY = Math.min(startPt.y, currentPt.y)
    const w = Math.abs(currentPt.x - startPt.x)
    const h = Math.abs(currentPt.y - startPt.y)

    if (w < 10 || h < 10) return

    // Convert overlay pixels → document-percentage coordinates
    // Add iframe scroll offset so the zone anchors to content, not viewport
    const xPct = (minX / scale / viewportWidth) * 100
    const yPct = ((minY / scale + iframeScrollY) / viewportHeight) * 100
    const wPct = (w / scale / viewportWidth) * 100
    const hPct = (h / scale / viewportHeight) * 100

    const newZone: BlurZone = {
      id: uuidv4(),
      x: xPct,
      y: yPct,
      width: wPct,
      height: hPct,
      mode: blurMode,
      intensity: 8,
      color: '#333333',
    }

    onChange([...blurZones, newZone])
  }

  function removeZone(id: string) {
    onChange(blurZones.filter(z => z.id !== id))
  }

  const previewRect = drawing ? {
    left: Math.min(startPt.x, currentPt.x),
    top: Math.min(startPt.y, currentPt.y),
    width: Math.abs(currentPt.x - startPt.x),
    height: Math.abs(currentPt.y - startPt.y),
  } : null

  // Scroll offset in scaled overlay pixels
  const scrollOffsetPx = iframeScrollY * scale

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
      {/* Blur zones shifted by scroll offset so they stay anchored to content */}
      {blurZones.map(zone => {
        const left = (zone.x / 100) * viewportWidth * scale
        const top = (zone.y / 100) * viewportHeight * scale - scrollOffsetPx
        const w = (zone.width / 100) * viewportWidth * scale
        const h = (zone.height / 100) * viewportHeight * scale

        return (
          <div
            key={zone.id}
            className="absolute group"
            style={{
              left, top, width: w, height: h,
              background: zone.mode === 'redact' ? zone.color : 'rgba(128,128,128,0.15)',
              backdropFilter: zone.mode === 'blur' ? `blur(${zone.intensity}px)` : undefined,
              WebkitBackdropFilter: zone.mode === 'blur' ? `blur(${zone.intensity}px)` : undefined,
              border: hoveredId === zone.id ? '2px solid #ff3b30' : '1px dashed rgba(255,59,48,0.4)',
              borderRadius: 4,
              pointerEvents: 'auto',
              zIndex: 10,
            }}
            onMouseEnter={() => setHoveredId(zone.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {hoveredId === zone.id && (
              <button
                className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold cursor-pointer shadow-lg"
                style={{ zIndex: 20 }}
                onClick={(e) => { e.stopPropagation(); removeZone(zone.id) }}
              >
                ×
              </button>
            )}
            {hoveredId === zone.id && (
              <span
                className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{
                  background: zone.mode === 'blur' ? 'rgba(10,132,255,0.8)' : 'rgba(255,59,48,0.8)',
                  color: '#fff',
                }}
              >
                {zone.mode === 'blur' ? `Blur ${zone.intensity}px` : 'Redacted'}
              </span>
            )}
          </div>
        )
      })}

      {previewRect && previewRect.width > 5 && previewRect.height > 5 && (
        <div
          className="absolute"
          style={{
            ...previewRect,
            border: '2px dashed #ff3b30',
            background: blurMode === 'redact' ? 'rgba(51,51,51,0.6)' : 'rgba(128,128,128,0.2)',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
