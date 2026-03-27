import React, { useRef, useState } from 'react'
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

  const isDrawMode = drawMode === 'click-zone'

  function pxToPercent(px: number, dim: number) {
    return (px / (dim * scale)) * 100
  }

  function getRelativePos(e: React.MouseEvent) {
    const rect = overlayRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!isDrawMode) return
    e.preventDefault()
    const pos = getRelativePos(e)
    setCenter(pos)
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

  function onMouseUp() {
    if (!drawing) return
    setDrawing(false)
    if (radius < 10) return // too small

    // Store as center + size (using width/height for the diameter)
    const cx = pxToPercent(center.x, viewportWidth)
    const cy = pxToPercent(center.y, viewportHeight)
    // Store radius as percentage of viewport width for consistency
    const rPctW = pxToPercent(radius, viewportWidth)
    const rPctH = pxToPercent(radius, viewportHeight)

    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null
    const scrollX = iframe?.contentWindow?.scrollX || 0
    const scrollY = iframe?.contentWindow?.scrollY || 0

    onChange({
      x: cx - rPctW,
      y: cy - rPctH,
      width: rPctW * 2,
      height: rPctH * 2,
      scrollX,
      scrollY,
      highlightOnHover: false,
    })
    setDrawMode('none')
  }

  // Compute saved circle from the stored rect data
  const savedCircle = clickZone
    ? (() => {
      const cx = (clickZone.x + clickZone.width / 2) / 100 * viewportWidth * scale
      const cy = (clickZone.y + clickZone.height / 2) / 100 * viewportHeight * scale
      const r = (clickZone.width / 2) / 100 * viewportWidth * scale
      return { cx, cy, r }
    })()
    : null

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0"
      style={{
        pointerEvents: isDrawMode ? 'auto' : 'none',
        cursor: isDrawMode ? 'crosshair' : 'default',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Saved zone — circular with dashed border, visible only in editor */}
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
          {/* Center crosshair */}
          <div
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              width: 8,
              height: 8,
              marginLeft: -4,
              marginTop: -4,
              borderRadius: '50%',
              background: '#0A84FF',
            }}
          />
          {/* Inner ring */}
          <div
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              width: '60%',
              height: '60%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: '1px dashed rgba(10,132,255,0.3)',
            }}
          />
        </div>
      )}

      {/* Drawing circle — live preview while dragging */}
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
              left: '50%',
              top: '50%',
              width: 6,
              height: 6,
              marginLeft: -3,
              marginTop: -3,
              borderRadius: '50%',
              background: '#0A84FF',
            }}
          />
        </div>
      )}
    </div>
  )
}
