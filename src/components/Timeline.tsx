import React, { useState, useRef } from 'react'
import { useDemoStore } from '../stores/demoStore'
import { useCaptureStore } from '../stores/captureStore'
import { PageRenderer } from './PageRenderer'
import { FileIcon, CursorIcon } from './Icons'
import type { DemoStep } from '../types/index'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP TIMELINE — Bottom filmstrip with visual drag-and-drop reorder
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STEP_W = 140
const STEP_H = 76

interface Props {
    steps: DemoStep[]
    selectedStepId: string | null
    onSelectStep: (id: string) => void
    onAddStep: () => void
}

export function Timeline({ steps, selectedStepId, onSelectStep, onAddStep }: Props) {
    const { reorderSteps } = useDemoStore()
    const { captures } = useCaptureStore()

    // Keep refs to avoid stale closures in document event listeners
    const stepsRef = useRef(steps)
    stepsRef.current = steps
    const reorderRef = useRef(reorderSteps)
    reorderRef.current = reorderSteps
    const onSelectRef = useRef(onSelectStep)
    onSelectRef.current = onSelectStep

    // Using useRef for drag state to avoid costly re-renders on every pointermove
    const dragRef = useRef<{
        active: boolean
        stepId: string
        startX: number
        startY: number
        originLeft: number
        originTop: number
        didMove: boolean
        insertIdx: number
        fromIdx: number
    } | null>(null)

    const [, forceRender] = useState(0)
    const cloneRef = useRef<HTMLDivElement>(null)
    const stepElsRef = useRef<Map<string, HTMLDivElement>>(new Map())

    function getCapture(captureId: string) {
        return captures.find(c => c.id === captureId)
    }

    // ── Pointer Down — initiate drag ─────────────────────────────────────────
    function handlePointerDown(e: React.PointerEvent, stepId: string, idx: number) {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()

        const el = stepElsRef.current.get(stepId)
        if (!el) return
        const rect = el.getBoundingClientRect()

        dragRef.current = {
            active: true,
            stepId,
            startX: e.clientX,
            startY: e.clientY,
            originLeft: rect.left,
            originTop: rect.top,
            didMove: false,
            insertIdx: idx,
            fromIdx: idx,
        }

        if (cloneRef.current) {
            cloneRef.current.style.display = 'none'
        }

        const onMove = (ev: PointerEvent) => handlePointerMove(ev)
        const onUp = () => {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            handlePointerUp()
        }
        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
    }

    // ── Pointer Move — move clone + compute insertion index ──────────────────
    function handlePointerMove(e: PointerEvent) {
        const d = dragRef.current
        if (!d) return

        const dx = e.clientX - d.startX
        const dy = e.clientY - d.startY

        // 5px threshold before activating drag
        if (!d.didMove && Math.abs(dx) < 5 && Math.abs(dy) < 5) return

        if (!d.didMove) {
            d.didMove = true
            // First move: show the clone and dim the original
            if (cloneRef.current) {
                cloneRef.current.style.display = 'block'
            }
            const origEl = stepElsRef.current.get(d.stepId)
            if (origEl) {
                origEl.style.opacity = '0.25'
                origEl.style.transition = 'opacity 0.15s ease'
            }
        }

        // Move the floating clone to follow cursor
        if (cloneRef.current) {
            cloneRef.current.style.left = `${d.originLeft + dx}px`
            cloneRef.current.style.top = `${d.originTop + dy}px`
        }

        // Compute insertion index by comparing cursor X to step midpoints
        const currentSteps = stepsRef.current
        let newInsertIdx = currentSteps.length - 1
        for (let i = 0; i < currentSteps.length; i++) {
            if (currentSteps[i].id === d.stepId) continue
            const el = stepElsRef.current.get(currentSteps[i].id)
            if (!el) continue
            const r = el.getBoundingClientRect()
            // Use the element's original center (before any transform shift)
            const midX = r.left + r.width / 2
            if (e.clientX < midX) {
                newInsertIdx = i > d.fromIdx ? i - 1 : i
                break
            }
        }
        d.insertIdx = Math.max(0, Math.min(currentSteps.length - 1, newInsertIdx))

        // Shift other cards to show the drop position
        for (let i = 0; i < currentSteps.length; i++) {
            const s = currentSteps[i]
            if (s.id === d.stepId) continue
            const el = stepElsRef.current.get(s.id)
            if (!el) continue

            let shift = 0
            if (d.fromIdx < d.insertIdx) {
                // Dragging right: items between (from+1)..insert shift left
                if (i > d.fromIdx && i <= d.insertIdx) shift = -(STEP_W + 28)
            } else if (d.fromIdx > d.insertIdx) {
                // Dragging left: items between insert..(from-1) shift right
                if (i >= d.insertIdx && i < d.fromIdx) shift = STEP_W + 28
            }
            el.style.transform = shift ? `translateX(${shift}px)` : 'translateX(0)'
            el.style.transition = 'transform 0.2s ease'
        }
    }

    // ── Pointer Up — commit reorder or treat as click ────────────────────────
    function handlePointerUp() {
        const d = dragRef.current
        if (!d) return
        dragRef.current = null

        // Hide clone
        if (cloneRef.current) {
            cloneRef.current.style.display = 'none'
        }

        // Reset all step transforms and opacity
        for (const [, el] of stepElsRef.current) {
            el.style.transform = ''
            el.style.transition = ''
            el.style.opacity = ''
        }

        if (d.didMove && d.fromIdx !== d.insertIdx) {
            const currentSteps = stepsRef.current
            const ids = currentSteps.map(s => s.id)
            const newIds = [...ids]
            const [moved] = newIds.splice(d.fromIdx, 1)
            newIds.splice(d.insertIdx, 0, moved)
            console.log('[Timeline] reorderSteps called:', { from: d.fromIdx, to: d.insertIdx, newIds })
            reorderRef.current(newIds)
        } else if (!d.didMove) {
            onSelectRef.current(d.stepId)
        }

        forceRender(n => n + 1)
    }

    // Figure out which step is being dragged (for the clone rendering)
    const activeStepId = dragRef.current?.didMove ? dragRef.current.stepId : null
    const activeStep = activeStepId ? steps.find(s => s.id === activeStepId) : null
    const activeCap = activeStep ? getCapture(activeStep.captureId) : null
    const activeIdx = activeStep ? steps.indexOf(activeStep) : -1

    return (
        <>
            <div
                className="h-[100px] flex items-center gap-3 px-4 overflow-x-auto shrink-0 relative"
                style={{
                    background: 'linear-gradient(180deg, rgba(38,38,42,0.97) 0%, rgba(32,32,36,0.97) 100%)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                {steps.length === 0 && (
                    <p className="text-[13px] text-white/25 mr-3">Add captured pages to build your demo →</p>
                )}

                {steps.map((step, i) => {
                    const cap = getCapture(step.captureId)
                    const isSelected = step.id === selectedStepId

                    return (
                        <React.Fragment key={step.id}>
                            <div
                                ref={el => { if (el) stepElsRef.current.set(step.id, el); else stepElsRef.current.delete(step.id) }}
                                onPointerDown={e => handlePointerDown(e, step.id, i)}
                                className="relative flex-shrink-0 select-none"
                                style={{
                                    width: STEP_W,
                                    height: STEP_H,
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    cursor: 'grab',
                                    border: isSelected ? '2px solid #0A84FF' : '2px solid transparent',
                                    boxShadow: isSelected
                                        ? '0 0 0 3px rgba(10,132,255,0.15), 0 4px 12px rgba(0,0,0,0.3)'
                                        : '0 2px 8px rgba(0,0,0,0.2)',
                                    opacity: isSelected ? 1 : 0.7,
                                    touchAction: 'none',
                                }}
                            >
                                {/* Live preview */}
                                {cap ? (
                                    <PageRenderer
                                        captureId={cap.id}
                                        viewportWidth={cap.viewportWidth || 1440}
                                        viewportHeight={cap.viewportHeight || 900}
                                        containerWidth={STEP_W}
                                        containerHeight={STEP_H}
                                        interactive={false}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-[#252525] flex items-center justify-center text-white/20">
                                        <FileIcon size={16} />
                                    </div>
                                )}

                                {/* Drag overlay — captures pointer events above the iframe */}
                                <div style={{ position: 'absolute', inset: 0, zIndex: 20, cursor: 'grab' }} />

                                {/* Step number badge */}
                                <div
                                    className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1.5 rounded-md flex items-center justify-center text-[10px] font-bold text-white tabular-nums"
                                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 21, pointerEvents: 'none' }}
                                >
                                    {i + 1}
                                </div>

                                {/* Click zone indicator */}
                                {step.clickZone && (
                                    <div
                                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center"
                                        style={{ background: 'rgba(10,132,255,0.8)', backdropFilter: 'blur(4px)', zIndex: 21, pointerEvents: 'none' }}
                                    >
                                        <CursorIcon size={10} />
                                    </div>
                                )}

                                {/* Label */}
                                {step.label && (
                                    <div
                                        className="absolute bottom-0 left-0 right-0 text-[10px] font-medium text-white px-2 py-1 truncate"
                                        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', zIndex: 21, pointerEvents: 'none' }}
                                    >
                                        {step.label}
                                    </div>
                                )}
                            </div>

                            {/* Arrow between steps */}
                            {i < steps.length - 1 && (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                                    <path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </React.Fragment>
                    )
                })}

                {/* Add step button */}
                <button
                    onClick={onAddStep}
                    className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer group"
                    style={{
                        width: STEP_W,
                        height: STEP_H,
                        borderRadius: 10,
                        border: '2px dashed rgba(255,255,255,0.12)',
                    }}
                    onMouseEnter={e => {
                        ; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(10,132,255,0.4)'
                            ; (e.currentTarget as HTMLElement).style.background = 'rgba(10,132,255,0.05)'
                    }}
                    onMouseLeave={e => {
                        ; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'
                            ; (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 4v12M4 10h12" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span className="text-[10px] text-white/25 group-hover:text-white/40 transition-colors">Add Page</span>
                </button>
            </div>

            {/* ── Floating clone — follows cursor during drag ───────────────── */}
            <div
                ref={cloneRef}
                style={{
                    display: 'none',
                    position: 'fixed',
                    width: STEP_W,
                    height: STEP_H,
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '2px solid #0A84FF',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 3px rgba(10,132,255,0.3)',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    cursor: 'grabbing',
                    transform: 'rotate(2deg) scale(1.05)',
                }}
            >
                {activeCap ? (
                    <PageRenderer
                        captureId={activeCap.id}
                        viewportWidth={activeCap.viewportWidth || 1440}
                        viewportHeight={activeCap.viewportHeight || 900}
                        containerWidth={STEP_W}
                        containerHeight={STEP_H}
                        interactive={false}
                    />
                ) : (
                    <div style={{ width: STEP_W, height: STEP_H, background: '#252525' }} />
                )}
                {/* Badge on clone */}
                <div
                    className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1.5 rounded-md flex items-center justify-center text-[10px] font-bold text-white tabular-nums"
                    style={{ background: 'rgba(10,132,255,0.9)', backdropFilter: 'blur(4px)' }}
                >
                    {activeIdx >= 0 ? activeIdx + 1 : '?'}
                </div>
            </div>
        </>
    )
}
