import React from 'react'
import type { CursorConfig } from '../types/index'
import { useUIStore } from '../stores/uiStore'
import { Toggle } from './Toggle'

interface Props {
  config: CursorConfig | null
  onChange: (cfg: CursorConfig | null) => void
}

const DEFAULT_CURSOR: CursorConfig = {
  enabled: true,
  startX: 10,
  startY: 10,
  endX: 50,
  endY: 50,
  durationMs: 1200,
  delayMs: 500,
  easing: 'ease-in-out',
  showClickEffect: true,
  loop: false,
}

function PropInput({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-[#6e6e6e]">{label}</span>
      <input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={value.toFixed(1)}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="h-7 w-full bg-[#1e1e1e] border border-transparent hover:border-[#4a4a4a] focus:border-[#0A84FF] rounded px-2 text-[11px] text-white outline-none transition-colors"
      />
    </div>
  )
}

export function CursorConfigurator({ config, onChange }: Props) {
  const { drawMode, setDrawMode } = useUIStore()
  const enabled = config?.enabled ?? false

  function update(updates: Partial<CursorConfig>) {
    if (!config) return
    onChange({ ...config, ...updates })
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold text-[#ababab] uppercase tracking-[0.08em]">
          Cursor Animation
        </span>
        <Toggle
          checked={enabled}
          onChange={on => on ? onChange(DEFAULT_CURSOR) : onChange(null)}
        />
      </div>

      {enabled && config && (
        <div className="px-3 pb-3 space-y-3">
          {/* Pick buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setDrawMode(drawMode === 'cursor-start' ? 'none' : 'cursor-start')}
              className={`flex-1 h-7 text-[11px] font-medium rounded transition-colors ${drawMode === 'cursor-start'
                ? 'bg-[#0A84FF]/15 text-[#0A84FF] ring-1 ring-[#0A84FF]/30'
                : 'bg-[#1e1e1e] text-[#ababab] hover:bg-[#404040]'
                }`}
            >
              Set Start
            </button>
            <button
              onClick={() => setDrawMode(drawMode === 'cursor-end' ? 'none' : 'cursor-end')}
              className={`flex-1 h-7 text-[11px] font-medium rounded transition-colors ${drawMode === 'cursor-end'
                ? 'bg-[#0A84FF]/15 text-[#0A84FF] ring-1 ring-[#0A84FF]/30'
                : 'bg-[#1e1e1e] text-[#ababab] hover:bg-[#404040]'
                }`}
            >
              Set End
            </button>
          </div>

          {/* Start / End coords */}
          <div className="grid grid-cols-4 gap-1.5">
            <PropInput label="Start X" value={config.startX} onChange={v => update({ startX: v })} />
            <PropInput label="Start Y" value={config.startY} onChange={v => update({ startY: v })} />
            <PropInput label="End X" value={config.endX} onChange={v => update({ endX: v })} />
            <PropInput label="End Y" value={config.endY} onChange={v => update({ endY: v })} />
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#6e6e6e]">Duration</span>
              <span className="text-[11px] font-mono text-[#ababab]">{config.durationMs}ms</span>
            </div>
            <input
              type="range" min={200} max={3000} step={100} value={config.durationMs}
              onChange={e => update({ durationMs: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Delay */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#6e6e6e]">Delay</span>
              <span className="text-[11px] font-mono text-[#ababab]">{config.delayMs}ms</span>
            </div>
            <input
              type="range" min={0} max={2000} step={100} value={config.delayMs}
              onChange={e => update({ delayMs: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Easing */}
          <div className="space-y-1">
            <span className="text-[11px] text-[#6e6e6e] block">Easing</span>
            <select
              value={config.easing}
              onChange={e => update({ easing: e.target.value as CursorConfig['easing'] })}
              className="w-full h-7 bg-[#1e1e1e] border border-transparent hover:border-[#4a4a4a] focus:border-[#0A84FF] rounded px-2 text-[11px] text-white outline-none transition-colors"
            >
              <option value="ease-in-out">ease-in-out</option>
              <option value="ease-out">ease-out</option>
              <option value="linear">linear</option>
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#ababab]">Loop animation</span>
              <Toggle checked={config.loop} onChange={v => update({ loop: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#ababab]">Click effect</span>
              <Toggle checked={config.showClickEffect} onChange={v => update({ showClickEffect: v })} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
