import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useDemoStore } from '../stores/demoStore'
import { useCaptureStore } from '../stores/captureStore'
import { useUIStore } from '../stores/uiStore'
import { PageRenderer } from '../components/PageRenderer'
import { ClickZoneOverlay } from '../components/ClickZoneOverlay'
import { Toggle } from '../components/Toggle'
import { Timeline } from '../components/Timeline'
import {
  PlusIcon, FileIcon, CloseIcon, SearchIcon, PlayIcon,
  DownloadIcon, TrashIcon, CursorIcon, GridIcon,
} from '../components/Icons'
import type { ClickZone, CursorConfig, DemoStep, Capture } from '../types/index'

// ─── Design tokens ────────────────────────────────────────────────────────────
const inputCls = 'h-9 w-full bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.14] focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/20 rounded-lg px-3 text-[13px] text-white placeholder-[#636366] outline-none transition-all duration-200'
const btnPrimary = 'h-9 px-4 rounded-lg text-white text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed'

function toKebab(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-1">
      <span className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.12em]">{title}</span>
      {action}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEFT PANEL — Demo list + details
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function LeftPanel({ onRequestAddStep }: { onRequestAddStep: () => void }) {
  const { demos, currentDemo, loadDemo, createDemo, deleteDemo, updateDemo } = useDemoStore()
  const { setView } = useUIStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  async function handleCreate() {
    if (!newName.trim()) return
    await createDemo(newName.trim(), '')
    setNewName('')
    setShowCreate(false)
    setTimeout(() => onRequestAddStep(), 100)
  }

  return (
    <div
      className="w-60 flex flex-col h-full shrink-0 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(44,44,48,0.97) 0%, rgba(38,38,42,0.97) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Demos header */}
      <SectionHeader
        title="Demos"
        action={
          <button
            onClick={() => setShowCreate(s => !s)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <PlusIcon size={16} />
          </button>
        }
      />

      {/* Create form */}
      {showCreate && (
        <div className="px-4 pb-4 space-y-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            className={inputCls}
            placeholder="Demo name…"
            value={newName}
            autoFocus
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setShowCreate(false)
            }}
          />
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={handleCreate}
              className={btnPrimary + ' flex-1'}
              style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)' }}
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 h-9 rounded-lg text-[13px] text-white/50 hover:text-white hover:bg-white/8 transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Demo list */}
      <div className="flex-1 overflow-y-auto py-1">
        {demos.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] text-white/30">No demos yet</p>
            <p className="text-[12px] text-white/20 mt-1">Click + to create your first demo</p>
          </div>
        )}
        {demos.map(demo => {
          const isActive = currentDemo?.id === demo.id
          return (
            <button
              key={demo.id}
              onClick={() => loadDemo(demo.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all duration-200 text-left relative"
              style={{
                background: isActive ? 'rgba(10,132,255,0.08)' : 'transparent',
                borderLeft: isActive ? '2px solid #0A84FF' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span style={{ color: isActive ? '#0A84FF' : 'rgba(255,255,255,0.3)' }}>
                <FileIcon size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <span
                  className="text-[14px] truncate block font-medium"
                  style={{ color: isActive ? '#0A84FF' : '#e5e5ea' }}
                >
                  {demo.name}
                </span>
                <span className="text-[12px] text-white/30">{demo.steps.length} step{demo.steps.length !== 1 ? 's' : ''}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Demo details when selected */}
      {currentDemo && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <SectionHeader title="Details" />
          <div className="px-4 pb-4 space-y-3">
            <div>
              <span className="text-[12px] text-white/40 block mb-1.5">Name</span>
              <input
                className={inputCls}
                value={currentDemo.name}
                onChange={e => updateDemo({ name: e.target.value })}
              />
            </div>
            <div>
              <span className="text-[12px] text-white/40 block mb-1.5">Description</span>
              <textarea
                className={`${inputCls} min-h-[56px] resize-none h-auto py-2`}
                value={currentDemo.description}
                placeholder="Optional…"
                onChange={e => updateDemo({ description: e.target.value })}
              />
            </div>
            <button
              onClick={() => {
                deleteDemo(currentDemo.id)
                setView('demos')
              }}
              className="w-full h-9 text-[13px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200 cursor-pointer mt-1"
            >
              Delete Demo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RIGHT INSPECTOR — Step properties, click zone
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RightInspector({ step, onUpdate, onRemove }: {
  step: DemoStep
  onUpdate: (updates: Partial<DemoStep>) => void
  onRemove: () => void
}) {
  const { drawMode, setDrawMode } = useUIStore()

  return (
    <div
      className="w-48 flex flex-col h-full shrink-0 overflow-y-auto"
      style={{
        background: '#222226',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Step Label */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[13px] text-white/40 block mb-2">Label</span>
        <input
          className={inputCls}
          value={step.label}
          placeholder={`Step ${step.stepOrder + 1}`}
          onChange={e => onUpdate({ label: e.target.value })}
        />
      </div>

      {/* Transition */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[13px] text-white/40 block mb-3">Transition</span>
        <div className="flex flex-col gap-2">
          {(['instant', 'slide-left', 'fade'] as DemoStep['transition'][]).map(t => {
            const active = step.transition === t
            return (
              <button
                key={t}
                onClick={() => onUpdate({ transition: t })}
                className="w-full h-9 text-[13px] font-medium rounded-lg capitalize transition-all duration-200 cursor-pointer"
                style={{
                  background: active ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#4DA3FF' : 'rgba(255,255,255,0.4)',
                  border: active ? '1px solid rgba(10,132,255,0.25)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {t === 'slide-left' ? 'Slide' : t}
              </button>
            )
          })}
        </div>
      </div>

      {/* Click Zone */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[13px] text-white/40 block mb-1.5">Click Zone</span>
        <p className="text-[12px] text-white/20 leading-relaxed mb-3">
          Draw an area viewers click to advance.
        </p>

        <button
          onClick={() => setDrawMode(drawMode === 'click-zone' ? 'none' : 'click-zone')}
          className="w-full h-10 text-[13px] font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
          style={{
            background: drawMode === 'click-zone' ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.04)',
            color: drawMode === 'click-zone' ? '#4DA3FF' : 'rgba(255,255,255,0.55)',
            border: drawMode === 'click-zone' ? '1px solid rgba(10,132,255,0.25)' : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <CursorIcon size={14} />
          {drawMode === 'click-zone' ? 'Drawing…' : step.clickZone ? 'Redraw Zone' : 'Draw Zone'}
        </button>

        {step.clickZone && (
          <div className="mt-3 space-y-2">
            <div
              className="rounded-lg px-3 py-2.5 text-[12px] font-mono tabular-nums space-y-1"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="flex justify-between">
                <span className="text-white/25">Center</span>
                <span className="text-white/50">{(step.clickZone.x + step.clickZone.width / 2).toFixed(1)}%, {(step.clickZone.y + step.clickZone.height / 2).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/25">Radius</span>
                <span className="text-white/50">{(step.clickZone.width / 2).toFixed(1)}%</span>
              </div>
            </div>
            <button
              onClick={() => onUpdate({ clickZone: null })}
              className="w-full h-8 text-[12px] text-red-400/70 hover:text-red-400 rounded-lg transition-all duration-200 cursor-pointer"
            >
              Remove Zone
            </button>
          </div>
        )}
      </div>

      {/* Remove Step */}
      <div className="mt-auto px-4 py-5">
        <button
          onClick={onRemove}
          className="w-full h-10 text-[13px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
          style={{ border: '1px solid rgba(255,59,48,0.25)' }}
        >
          <TrashIcon size={14} />
          Remove Step
        </button>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT PANEL — shown in right panel when no step is selected
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ExportPanel() {
  const { currentDemo, exportDemo } = useDemoStore()
  const [filename, setFilename] = useState('')
  const [keyboardNav, setKeyboardNav] = useState(true)
  const [showStepCounter, setShowStepCounter] = useState(true)
  const [presentationMode, setPresentationMode] = useState(false)
  const [imageQuality, setImageQuality] = useState(85)
  const [exporting, setExporting] = useState(false)
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (currentDemo) setFilename(toKebab(currentDemo.name))
  }, [currentDemo?.id])

  if (!currentDemo || currentDemo.steps.length === 0) return null

  async function handleExport() {
    setError(null)
    try {
      const savePath = await window.api.showSaveDialog(`${filename}.html`)
      if (!savePath) return
      setExporting(true)
      const path = await exportDemo({ filename, keyboardNav, showStepCounter, imageQuality, outputPath: savePath, presentationMode })
      setOutputPath(path)
    } catch (err) {
      setError(String(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="w-44 flex flex-col h-full shrink-0 overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, rgba(44,44,48,0.97) 0%, rgba(38,38,42,0.97) 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <SectionHeader title="Export" />
      <div className="px-4 pb-4 space-y-4 flex-1">
        {/* Filename */}
        <div className="space-y-1.5">
          <span className="text-[12px] text-white/40 block">Filename</span>
          <div className="flex items-center gap-2">
            <input
              className={inputCls}
              value={filename}
              onChange={e => setFilename(e.target.value)}
              placeholder="demo-name"
            />
            <span className="text-[13px] text-white/30 font-mono">.html</span>
          </div>
        </div>

        {/* Image quality */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-white/40">Image quality</span>
            <span className="text-[13px] font-mono text-[#0A84FF] font-semibold tabular-nums">{imageQuality}%</span>
          </div>
          <input
            type="range" min={10} max={100} value={imageQuality}
            onChange={e => setImageQuality(parseInt(e.target.value))}
            className="w-full accent-[#0A84FF]"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3.5">
          <ToggleRow label="Keyboard nav" checked={keyboardNav} onChange={setKeyboardNav} />
          <ToggleRow label="Step counter" checked={showStepCounter} onChange={setShowStepCounter} />
          <ToggleRow label="Presentation mode" desc="Dark border" checked={presentationMode} onChange={setPresentationMode} />
        </div>

        {/* Meta */}
        <p className="text-[12px] text-white/20 tabular-nums">
          {currentDemo.steps.length} step{currentDemo.steps.length !== 1 ? 's' : ''} · self-contained HTML
        </p>

        {/* Error */}
        {error && (
          <div
            className="text-[12px] px-3 py-2 rounded-lg"
            style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#ff453a' }}
          >
            {error}
          </div>
        )}

        {/* Success */}
        {outputPath && (
          <div
            className="text-[12px] px-3 py-2 rounded-lg"
            style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', color: '#30d158' }}
          >
            ✓ Exported to {outputPath.split('/').pop()}
          </div>
        )}
      </div>

      {/* Export button */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleExport}
          disabled={exporting || !filename.trim()}
          className={btnPrimary + ' w-full flex items-center justify-center gap-2'}
          style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)', boxShadow: '0 2px 8px rgba(10,132,255,0.2)' }}
        >
          <DownloadIcon size={14} />
          {exporting ? 'Exporting…' : 'Export to HTML'}
        </button>
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string
  desc?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-white/70">{label}</div>
        {desc && <div className="text-[11px] text-white/25 mt-0.5">{desc}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} size="sm" />
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADD STEP MODAL — Pick from captured pages
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AddStepModal({ onClose, onAdd }: { onClose: () => void; onAdd: (captureId: string) => void }) {
  const { captures, fetchCaptures } = useCaptureStore()
  const [search, setSearch] = useState('')

  useEffect(() => { fetchCaptures() }, [])

  const filtered = captures.filter(c =>
    !search || c.pageLabel.toLowerCase().includes(search.toLowerCase()) ||
    c.sourceUrl.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <div
        className="overflow-hidden flex flex-col"
        style={{
          width: 720,
          maxHeight: 560,
          background: 'linear-gradient(180deg, rgba(50,50,55,0.98) 0%, rgba(38,38,42,0.98) 100%)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)' }}
            >
              <PlusIcon size={16} />
            </div>
            <span className="text-[15px] font-semibold text-white">Add Captured Page</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
              <SearchIcon size={14} />
            </span>
            <input
              className={inputCls + ' pl-8'}
              placeholder="Search captures…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Captures grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[14px] text-white/30">
                {captures.length === 0
                  ? 'No captures yet — use the Chrome extension to capture pages'
                  : 'No captures match your search'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map(cap => (
                <button
                  key={cap.id}
                  onClick={() => { onAdd(cap.id); onClose() }}
                  className="group overflow-hidden cursor-pointer text-left transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(10,132,255,0.4)'
                    el.style.boxShadow = '0 4px 16px rgba(10,132,255,0.15)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(255,255,255,0.06)'
                    el.style.boxShadow = 'none'
                  }}
                >
                  <div className="aspect-[16/10] bg-[#151515] overflow-hidden relative rounded-t-[11px]">
                    <PageRenderer
                      captureId={cap.id}
                      viewportWidth={cap.viewportWidth || 1440}
                      viewportHeight={cap.viewportHeight || 900}
                      containerWidth={240}
                      containerHeight={150}
                      interactive={false}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-[#0A84FF]/0 group-hover:bg-[#0A84FF]/10 transition-all duration-200 flex items-center justify-center">
                      <span className="text-white text-[13px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity bg-[#0A84FF]/80 px-3 py-1 rounded-lg">
                        + Add
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[13px] text-white/80 truncate font-medium">{cap.pageLabel}</p>
                    <p className="text-[11px] text-white/25 truncate mt-0.5">{cap.sourceUrl}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Timeline component — extracted to src/components/Timeline.tsx



// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CURSOR PATH PREVIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CursorPathPreview({ config, scale, vw, vh }: { config: CursorConfig; scale: number; vw: number; vh: number }) {
  const sx = (config.startX / 100) * vw * scale
  const sy = (config.startY / 100) * vh * scale
  const ex = (config.endX / 100) * vw * scale
  const ey = (config.endY / 100) * vh * scale

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ width: vw * scale, height: vh * scale }}>
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#0A84FF" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
      <circle cx={sx} cy={sy} r={4} fill="#0A84FF" />
      <circle cx={ex} cy={ey} r={4} fill="#0A84FF" />
      <circle cx={ex} cy={ey} r={7} fill="none" stroke="#0A84FF" strokeWidth={1} opacity={0.4} />
    </svg>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN FLOW EDITOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function FlowEditor() {
  const { currentDemo, selectedStepId, selectStep, updateStep, addStep, removeStep } = useDemoStore()
  const { captures, fetchCaptures } = useCaptureStore()
  const { drawMode, setDrawMode, setView } = useUIStore()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [showAddCapture, setShowAddCapture] = useState(false)
  const [docHeight, setDocHeight] = useState(900)

  useEffect(() => { fetchCaptures() }, [])

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setCanvasSize({ width: e.contentRect.width, height: e.contentRect.height })
      }
    })
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [])

  const selectedStep = currentDemo?.steps.find(s => s.id === selectedStepId) ?? null
  const selectedCapture = selectedStep ? captures.find(c => c.id === selectedStep.captureId) : null

  const vw = selectedCapture?.viewportWidth ?? 1440
  const vh = selectedCapture?.viewportHeight ?? 900
  const scale = Math.min(canvasSize.width / vw, canvasSize.height / vh, 1) * 0.98

  function handleCanvasClick(e: React.MouseEvent) {
    if (drawMode !== 'cursor-start' && drawMode !== 'cursor-end') return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const xPct = (px / (vw * scale)) * 100
    const yPct = (py / (vh * scale)) * 100
    if (!selectedStep) return
    const cur = selectedStep.cursorConfig
    if (drawMode === 'cursor-start') {
      updateStep(selectedStep.id, { cursorConfig: cur ? { ...cur, startX: xPct, startY: yPct } : null })
    } else {
      updateStep(selectedStep.id, { cursorConfig: cur ? { ...cur, endX: xPct, endY: yPct } : null })
    }
    setDrawMode('none')
  }

  async function handleAddStep(captureId: string) {
    await addStep(captureId)
  }

  return (
    <div className="flex-1 flex flex-col bg-[#1a1a1e] overflow-hidden">
      {/* Main three-panel area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <LeftPanel onRequestAddStep={() => setShowAddCapture(true)} />

        {/* Center canvas */}
        <div
          ref={canvasRef}
          className="flex-1 flex items-center justify-center relative overflow-hidden"
          onClick={handleCanvasClick}
          style={{
            cursor: (drawMode === 'cursor-start' || drawMode === 'cursor-end') ? 'crosshair' : 'default',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {!currentDemo ? (
            /* No demo selected */
            <div className="flex flex-col items-center gap-5">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(10,132,255,0.1), rgba(10,132,255,0.03))' }}
              >
                <GridIcon size={32} />
              </div>
              <div className="text-center">
                <p className="text-[16px] font-semibold text-white/40 mb-1.5">No demo selected</p>
                <p className="text-[13px] text-white/25 max-w-[280px] leading-relaxed">
                  Create a new demo from the left panel, or select an existing one to start building
                </p>
              </div>
            </div>
          ) : selectedStep && selectedCapture ? (
            /* Step is selected — show page preview */
            <>
              <div
                className="relative"
                style={{
                  width: vw * scale,
                  height: vh * scale,
                  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                  borderRadius: 8,
                }}
              >
                <PageRenderer
                  captureId={selectedStep.captureId}
                  viewportWidth={vw}
                  viewportHeight={vh}
                  containerWidth={canvasSize.width}
                  containerHeight={canvasSize.height}
                />
                <ClickZoneOverlay
                  clickZone={selectedStep.clickZone}
                  viewportWidth={vw}
                  viewportHeight={vh}
                  containerWidth={canvasSize.width}
                  containerHeight={canvasSize.height}
                  scale={scale}
                  onChange={zone => updateStep(selectedStep.id, { clickZone: zone })}
                />
                {selectedStep.cursorConfig?.enabled && (
                  <CursorPathPreview config={selectedStep.cursorConfig} scale={scale} vw={vw} vh={vh} />
                )}
              </div>



            </>
          ) : (
            /* Demo selected but no step selected */
            <div className="flex flex-col items-center gap-5">
              <div
                className="w-18 h-18 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.03)', width: 72, height: 72 }}
              >
                <PlusIcon size={28} />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-semibold text-white/40 mb-1.5">
                  {currentDemo.steps.length === 0 ? 'No steps yet' : 'Select a step'}
                </p>
                <p className="text-[13px] text-white/25 max-w-[300px] leading-relaxed">
                  {currentDemo.steps.length === 0
                    ? 'Click "Add Page" in the timeline below to add captured pages'
                    : 'Click on a step in the timeline below to edit it'}
                </p>
              </div>
              {currentDemo.steps.length === 0 && (
                <button
                  onClick={() => setShowAddCapture(true)}
                  className={btnPrimary + ' flex items-center gap-2 mt-2'}
                  style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)', boxShadow: '0 2px 12px rgba(10,132,255,0.25)' }}
                >
                  <PlusIcon size={14} />
                  Add Captured Page
                </button>
              )}
            </div>
          )}

          {/* Draw mode hint banner */}
          {drawMode !== 'none' && (
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 text-[13px] text-white font-semibold flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(13,153,255,0.9), rgba(0,102,204,0.9))',
                borderRadius: 12,
                boxShadow: '0 4px 16px rgba(13,153,255,0.3)',
                zIndex: 20,
              }}
            >
              {drawMode === 'click-zone'
                ? '🎯 Click and drag to draw a click zone'
                : `Click to set ${drawMode === 'cursor-start' ? 'start' : 'end'} point`}
              <button
                className="text-white/70 hover:text-white text-[12px] underline cursor-pointer"
                onClick={e => { e.stopPropagation(); setDrawMode('none') }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Right panel — step inspector or export panel */}
        {selectedStep ? (
          <RightInspector
            step={selectedStep}
            onUpdate={updates => updateStep(selectedStep.id, updates)}
            onRemove={() => removeStep(selectedStep.id)}
          />
        ) : currentDemo && currentDemo.steps.length > 0 ? (
          <ExportPanel />
        ) : (
          <div
            className="w-48 flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(180deg, rgba(44,44,48,0.97) 0%, rgba(38,38,42,0.97) 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="text-center">
              <p className="text-[13px] text-white/25">
                {currentDemo ? 'Add steps to get started' : 'No demo selected'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom timeline */}
      {currentDemo && (
        <Timeline
          steps={currentDemo.steps}
          selectedStepId={selectedStepId}
          onSelectStep={selectStep}
          onAddStep={() => setShowAddCapture(true)}
        />
      )}

      {/* Add Step modal */}
      {showAddCapture && (
        <AddStepModal
          onClose={() => setShowAddCapture(false)}
          onAdd={handleAddStep}
        />
      )}
    </div>
  )
}
