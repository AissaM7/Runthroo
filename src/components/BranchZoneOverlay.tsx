import React, { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { v4 as uuidv4 } from 'uuid'
import type { BranchClickZone, DemoStep } from '../types/index'
import { useUIStore } from '../stores/uiStore'
import { findScrollInfo } from './ClickZoneOverlay'

interface Props {
  clickZones: BranchClickZone[]
  viewportWidth: number
  viewportHeight: number
  scale: number
  steps: DemoStep[]
  currentStepId: string
  onChange: (zones: BranchClickZone[]) => void
}

export function BranchZoneOverlay({
  clickZones,
  viewportWidth,
  viewportHeight,
  scale,
  steps,
  currentStepId,
  onChange,
}: Props) {
  const { drawMode } = useUIStore()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [center, setCenter] = useState({ x: 0, y: 0 })
  const [radius, setRadius] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [scrollState, setScrollState] = useState({
    scrollX: 0,
    scrollY: 0,
    scrollWidth: viewportWidth,
    scrollHeight: viewportHeight,
  })

  const isDrawMode = drawMode === 'branch-zone'

  // ── Poll iframe scroll position (SPA-aware) ───────────
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
    poll()
    const interval = setInterval(poll, 50)
    return () => clearInterval(interval)
  }, [])

  // Close popover when clicking outside
  useEffect(() => {
    if (!editingId) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-branch-popover]')) return
      if (target.closest('[data-branch-zone]')) return
      setEditingId(null)
      setPopoverPos(null)
    }
    window.addEventListener('mousedown', handleClick, true)
    return () => window.removeEventListener('mousedown', handleClick, true)
  }, [editingId])

  function getRelativePos(e: React.MouseEvent) {
    if (!overlayRef.current) return { x: 0, y: 0 }
    const rect = overlayRef.current.getBoundingClientRect()
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

  function onMouseUp() {
    if (!drawing) return
    setDrawing(false)
    if (radius < 10) return

    // ── DOCUMENT-PERCENTAGE ANCHORING ────────────────────────
    // Uses scrollHeight (total document height) as denominator,
    // not viewportHeight. This locks the zone to its position
    // in the full document, not just the visible viewport.
    const centerXPct = (center.x / scale / viewportWidth) * 100
    const centerYPct = ((center.y / scale + scrollState.scrollY) / scrollState.scrollHeight) * 100
    const radiusPctW = (radius / scale / viewportWidth) * 100

    const newZone: BranchClickZone = {
      id: uuidv4(),
      x: centerXPct,
      y: centerYPct,
      width: radiusPctW,
      height: radiusPctW,
      scrollY: scrollState.scrollHeight,  // store total height for export
      targetStepId: 'next',
      label: `Branch ${clickZones.length + 1}`,
    }

    const updated = [...clickZones, newZone]
    onChange(updated)

    // Open the edit popover for the new zone
    setEditingId(newZone.id)
    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect()
      setPopoverPos({
        top: rect.top + center.y,
        left: rect.left + center.x + radius + 16,
      })
    }
  }

  function removeZone(id: string) {
    onChange(clickZones.filter(z => z.id !== id))
    if (editingId === id) {
      setEditingId(null)
      setPopoverPos(null)
    }
  }

  function updateZone(id: string, updates: Partial<BranchClickZone>) {
    onChange(clickZones.map(z => z.id === id ? { ...z, ...updates } : z))
  }

  function openPopover(zoneId: string, screenX: number, screenY: number) {
    if (editingId === zoneId) {
      setEditingId(null)
      setPopoverPos(null)
    } else {
      setEditingId(zoneId)
      setPopoverPos({ top: screenY - 40, left: screenX + 16 })
    }
  }

  const currentStep = steps.find(s => s.id === currentStepId)
  const currentStepOrder = currentStep?.stepOrder ?? 0
  const otherSteps = steps.filter(s => s.id !== currentStepId)

  function getStepDisplayName(step: DemoStep | undefined): string {
    if (!step) return 'Unknown'
    if (step.label?.trim()) return step.label
    return `Step ${step.stepOrder + 1}`
  }

  function getTargetDisplayName(zone: BranchClickZone | undefined): string {
    if (!zone) return 'Unknown'
    if (zone.targetStepId === 'next') {
      const nextStep = steps.find(s => s.stepOrder === currentStepOrder + 1)
      return nextStep ? getStepDisplayName(nextStep) : 'Next Step'
    }
    const target = steps.find(s => s.id === zone.targetStepId)
    return target ? getStepDisplayName(target) : 'Unknown Step'
  }

  const scrollOffsetPx = scrollState.scrollY * scale
  const editingZone = editingId ? clickZones.find(z => z.id === editingId) : undefined

  const popover = editingId && popoverPos && editingZone ? createPortal(
    <div
      data-branch-popover
      className="fixed z-[9999]"
      style={{
        top: Math.max(8, Math.min(popoverPos.top, window.innerHeight - 320)),
        left: Math.min(popoverPos.left, window.innerWidth - 288),
        width: 272,
        animation: 'czPopIn 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <style>{`
        @keyframes czPopIn {
          from { opacity: 0; transform: scale(0.95) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .cz-input:focus { border-color: rgba(10,132,255,0.5) !important; box-shadow: 0 0 0 2px rgba(10,132,255,0.1) !important; }
        .cz-select:focus { border-color: rgba(10,132,255,0.5) !important; box-shadow: 0 0 0 2px rgba(10,132,255,0.1) !important; }
      `}</style>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(28,28,30,0.95)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.05) inset',
        }}
      >
        {/* Header — compact */}
        <div
          className="px-3.5 py-2.5 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-5.5 h-5.5 rounded-md flex items-center justify-center"
              style={{
                width: 22, height: 22,
                background: 'rgba(10,132,255,0.12)',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M4 8h8M12 5l3 3-3 3" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-white/90 tracking-[-0.01em]">Click Zone</span>
          </div>
          <button
            className="w-5 h-5 rounded flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/6 transition-colors cursor-pointer"
            onClick={() => { setEditingId(null); setPopoverPos(null) }}
          >
            <svg width="8" height="8" viewBox="0 0 10 10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-3.5 py-3 space-y-3">
          {/* Label */}
          <div>
            <label className="text-[10px] text-white/30 font-medium block mb-1 tracking-[0.04em]">Label</label>
            <input
              className="cz-input w-full h-8 px-2.5 rounded-lg text-[12px] text-white outline-none transition-all duration-150 placeholder-white/15"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              value={editingZone.label || ''}
              onChange={e => updateZone(editingId, { label: e.target.value })}
              placeholder="e.g. View Pricing"
            />
          </div>

          {/* Navigate to */}
          <div>
            <label className="text-[10px] text-white/30 font-medium block mb-1 tracking-[0.04em]">Navigate to</label>
            <select
              className="cz-select w-full h-8 px-2.5 rounded-lg text-[12px] text-white outline-none transition-all duration-150 appearance-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.07)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23555' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                paddingRight: 24,
              }}
              value={editingZone.targetStepId || 'next'}
              onChange={e => updateZone(editingId, { targetStepId: e.target.value })}
            >
              <option value="next">Next Step</option>
              {otherSteps.map(s => (
                <option key={s.id} value={s.id}>
                  Step {s.stepOrder + 1}: {s.label?.trim() || 'Untitled'}
                </option>
              ))}
            </select>
          </div>

          {/* Flow visualization — compact */}
          <div
            className="rounded-lg px-2.5 py-2 flex items-center justify-center gap-2"
            style={{ background: 'rgba(10,132,255,0.05)', border: '1px solid rgba(10,132,255,0.08)' }}
          >
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded truncate max-w-[75px]"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
              title={getStepDisplayName(currentStep)}
            >
              {getStepDisplayName(currentStep)}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <div style={{ width: 14, height: 1, background: 'rgba(10,132,255,0.35)' }} />
              <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                <path d="M1.5 0.5l3 2.5-3 2.5" fill="rgba(10,132,255,0.45)" />
              </svg>
            </div>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded truncate max-w-[75px]"
              style={{ background: 'rgba(10,132,255,0.12)', color: '#4DA3FF' }}
              title={getTargetDisplayName(editingZone)}
            >
              {getTargetDisplayName(editingZone)}
            </span>
          </div>
        </div>

        {/* Footer — compact */}
        <div
          className="px-3.5 py-2.5 flex items-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            className="h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors duration-150 cursor-pointer text-white/30 hover:text-red-400 hover:bg-red-500/8"
            onClick={() => removeZone(editingId)}
          >
            Delete
          </button>
          <div className="flex-1" />
          <button
            className="h-7 px-4 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer text-white hover:brightness-110 active:scale-[0.97]"
            style={{
              background: '#0A84FF',
              boxShadow: '0 2px 8px rgba(10,132,255,0.25)',
            }}
            onClick={() => { setEditingId(null); setPopoverPos(null) }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
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
        {/* Rendered branch zones */}
        {clickZones.map(zone => {
          const cx = (zone.x / 100) * viewportWidth * scale
          // Reconstruct position from document-percentage using scrollHeight
          const sh = scrollState.scrollHeight
          const centerYdoc = (zone.y / 100) * sh
          const cy = (centerYdoc - scrollState.scrollY) * scale
          const r = (zone.width / 100) * viewportWidth * scale
          const isEditing = editingId === zone.id
          const isHovered = hoveredId === zone.id

          return (
            <div key={zone.id} data-branch-zone>
              {/* Main zone circle */}
              <div
                className="absolute"
                style={{
                  left: cx - r,
                  top: cy - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: '50%',
                  border: isEditing
                    ? '2px solid #0A84FF'
                    : isHovered
                      ? '2px solid rgba(10,132,255,0.7)'
                      : '1.5px solid rgba(10,132,255,0.35)',
                  background: isEditing
                    ? 'radial-gradient(circle, rgba(10,132,255,0.12) 0%, transparent 70%)'
                    : isHovered
                      ? 'radial-gradient(circle, rgba(10,132,255,0.08) 0%, transparent 70%)'
                      : 'transparent',
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  zIndex: 10,
                  transition: 'all 0.15s ease',
                  boxShadow: isEditing
                    ? '0 0 20px rgba(10,132,255,0.15), inset 0 0 10px rgba(10,132,255,0.05)'
                    : isHovered
                      ? '0 0 12px rgba(10,132,255,0.1)'
                      : 'none',
                }}
                onMouseEnter={() => setHoveredId(zone.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  openPopover(zone.id, rect.right, rect.top + rect.height / 2)
                }}
              >
                {/* Center nav icon */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ opacity: isHovered || isEditing ? 1 : 0.5, transition: 'opacity 0.15s' }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(10,132,255,0.15)',
                      border: '1px solid rgba(10,132,255,0.25)',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {/* Label badge */}
                <div
                  className="absolute whitespace-nowrap pointer-events-none"
                  style={{
                    top: -22, left: '50%', transform: 'translateX(-50%)',
                    background: '#0A84FF',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}
                >
                  {zone.label}
                </div>

                {/* Target label — below */}
                <div
                  className="absolute whitespace-nowrap pointer-events-none"
                  style={{
                    bottom: -20, left: '50%', transform: 'translateX(-50%)',
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 9,
                    fontWeight: 500,
                  }}
                >
                  {getTargetDisplayName(zone)}
                </div>

                {/* Delete on hover */}
                {isHovered && (
                  <button
                    className="absolute flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                    style={{
                      top: -5, right: -5, width: 18, height: 18,
                      borderRadius: '50%',
                      background: '#ff453a',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 'bold',
                      zIndex: 20,
                      border: '2px solid rgba(0,0,0,0.4)',
                    }}
                    onClick={(e) => { e.stopPropagation(); removeZone(zone.id) }}
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Drawing preview */}
        {drawing && radius > 5 && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: center.x - radius,
              top: center.y - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: '50%',
              border: '2px dashed #0A84FF',
              background: 'radial-gradient(circle, rgba(10,132,255,0.1) 0%, transparent 70%)',
            }}
          />
        )}
      </div>

      {/* Popover via portal */}
      {popover}
    </>
  )
}
