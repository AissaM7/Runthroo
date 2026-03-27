import React, { useState } from 'react'
import type { DemoStep } from '../types/index'
import { useDemoStore } from '../stores/demoStore'
import { useCaptureStore } from '../stores/captureStore'
import { PlusIcon } from './Icons'

interface Props {
  steps: DemoStep[]
  selectedStepId: string | null
  onSelectStep: (id: string) => void
  onAddStep: () => void
}

export function StepTimeline({ steps, selectedStepId, onSelectStep, onAddStep }: Props) {
  const { reorderSteps } = useDemoStore()
  const { captures } = useCaptureStore()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  function getCaptureThumb(captureId: string) {
    const cap = captures.find(c => c.id === captureId)
    return cap?.thumbnailPath ? `file://${cap.thumbnailPath}` : null
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }

  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const ids = steps.map(s => s.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    const newIds = [...ids]
    newIds.splice(fromIdx, 1)
    newIds.splice(toIdx, 0, dragId)
    reorderSteps(newIds)
    setDragId(null)
    setDragOverId(null)
  }

  function onDragEnd() { setDragId(null); setDragOverId(null) }

  return (
    <div className="h-24 bg-[#2c2c2c] border-t border-[#3a3a3a] flex items-center gap-2 px-3 overflow-x-auto shrink-0">
      {/* Empty state hint */}
      {steps.length === 0 && (
        <p className="text-[11px] text-[#505050] mr-3">Add captures as steps to build your demo</p>
      )}

      {steps.map((step, i) => {
        const thumb = getCaptureThumb(step.captureId)
        const isSelected = step.id === selectedStepId
        const isDragging = step.id === dragId
        const isDragOver = step.id === dragOverId

        return (
          <div
            key={step.id}
            draggable
            onDragStart={e => onDragStart(e, step.id)}
            onDragOver={e => onDragOver(e, step.id)}
            onDrop={e => onDrop(e, step.id)}
            onDragEnd={onDragEnd}
            onClick={() => onSelectStep(step.id)}
            className={`relative w-28 h-16 flex-shrink-0 rounded overflow-hidden cursor-pointer border transition-all duration-150 select-none ${isSelected
              ? 'border-[#0A84FF] opacity-100 ring-2 ring-[#0A84FF] shadow-[0_0_12px_rgba(10,132,255,0.25)]'
              : 'border-transparent opacity-60 hover:opacity-90 hover:border-[#505050]'
              } ${isDragging ? 'opacity-30' : ''} ${isDragOver ? 'border-[#0A84FF]/60 scale-105' : ''}`}
          >
            {thumb ? (
              <img src={thumb} alt={`Step ${i + 1}`} className="object-cover object-top w-full h-full" draggable={false} />
            ) : (
              <div className="w-full h-full bg-[#383838] flex items-center justify-center text-[#505050] text-[10px]">
                No preview
              </div>
            )}
            {/* Step number badge */}
            <div className="absolute top-1 left-1 w-4 h-4 rounded-sm bg-[#2c2c2c]/90 flex items-center justify-center text-[9px] font-medium text-[#ababab] tabular-nums">
              {i + 1}
            </div>
            {/* Label on hover */}
            {step.label && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] text-white px-1 py-0.5 truncate">
                {step.label}
              </div>
            )}
          </div>
        )
      })}

      {/* Add step button */}
      <button
        onClick={onAddStep}
        className="w-28 h-16 flex-shrink-0 rounded border border-dashed border-[#505050] hover:border-[#0A84FF]/60 hover:bg-[#0A84FF]/5 flex items-center justify-center transition-all duration-150 cursor-pointer text-[#505050] hover:text-[#0A84FF]"
      >
        <PlusIcon size={20} />
      </button>
    </div>
  )
}
