import React, { useState } from 'react'
import { useDemoStore } from '../stores/demoStore'
import { useUIStore } from '../stores/uiStore'
import { Toggle } from '../components/Toggle'
import { CloseIcon, DownloadIcon } from '../components/Icons'

function toKebab(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function ExportView() {
  const { currentDemo, exportDemo } = useDemoStore()
  const { setView } = useUIStore()
  const [filename, setFilename] = useState(() => toKebab(currentDemo?.name ?? 'demo'))
  const [keyboardNav, setKeyboardNav] = useState(true)
  const [showStepCounter, setShowStepCounter] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)
  const [imageQuality, setImageQuality] = useState(70)
  const [exporting, setExporting] = useState(false)
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!currentDemo) return null

  const estimatedSize = currentDemo.steps.reduce((sum, _s) => sum + 2_000_000, 0) * (imageQuality / 100)

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
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)' }}
      onClick={() => setView('editor')}
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: 480,
          background: 'linear-gradient(180deg, rgba(50,50,55,0.98) 0%, rgba(38,38,42,0.98) 100%)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Subtle top highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)' }}
            >
              <DownloadIcon size={18} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-white tracking-tight">Export Demo</h2>
              <p className="text-[12px] text-[#8e8e93]">{currentDemo.steps.length} step{currentDemo.steps.length !== 1 ? 's' : ''} · self-contained HTML</p>
            </div>
          </div>
          <button
            onClick={() => setView('editor')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 text-[#8e8e93] hover:text-white transition-all duration-200 cursor-pointer"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="h-px bg-white/[0.06] mx-6" />

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Filename */}
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[#e5e5ea] block">Filename</label>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 h-10 bg-[#1c1c1e] border border-white/[0.08] hover:border-white/[0.14] focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/20 rounded-lg px-3 text-[14px] text-white outline-none transition-all duration-200 font-mono"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                placeholder="demo-name"
              />
              <span className="text-[14px] text-[#636366] font-mono">.html</span>
            </div>
          </div>

          {/* Image quality */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-[#e5e5ea]">Image quality</label>
              <span className="text-[14px] font-mono text-[#0A84FF] font-semibold tabular-nums">{imageQuality}%</span>
            </div>
            <div className="relative">
              <input
                type="range" min={10} max={100} value={imageQuality}
                onChange={e => setImageQuality(parseInt(e.target.value))}
                className="w-full accent-[#0A84FF] h-1.5"
                style={{ accentColor: '#0A84FF' }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-[#48484a] font-medium">
              <span>Smaller file</span>
              <span>Higher quality</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06]" />

          {/* Toggles */}
          <div className="space-y-4">
            <ToggleRow
              label="Keyboard navigation"
              desc="Use arrow keys and spacebar"
              checked={keyboardNav}
              onChange={setKeyboardNav}
            />
            <ToggleRow
              label="Step counter"
              desc="Show current step number"
              checked={showStepCounter}
              onChange={setShowStepCounter}
            />
            <ToggleRow
              label="Presentation mode"
              desc="Dark border around viewport"
              checked={presentationMode}
              onChange={setPresentationMode}
            />
          </div>

          {/* Info pill */}
          <div
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#636366" strokeWidth="1.2" />
              <path d="M7 6v4M7 4.5v.01" stroke="#636366" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="text-[12px] text-[#8e8e93] tabular-nums">
              ~{(estimatedSize / 1024 / 1024).toFixed(1)} MB estimated · opens anywhere offline
            </span>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-[13px]"
              style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#ff453a' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
                <circle cx="8" cy="8" r="7" stroke="#ff453a" strokeWidth="1.5" />
                <path d="M8 5v4M8 11v.01" stroke="#ff453a" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          {/* Success */}
          {outputPath && (
            <div
              className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-[13px]"
              style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', color: '#30d158' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
                <circle cx="8" cy="8" r="7" stroke="#30d158" strokeWidth="1.5" />
                <path d="M5.5 8l2 2 3.5-3.5" stroke="#30d158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="break-all font-mono text-[12px]">{outputPath}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {outputPath ? (
            <button
              onClick={() => setView('editor')}
              className="h-10 px-5 rounded-xl text-[14px] font-semibold text-white cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #30d158, #28a745)' }}
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={() => setView('editor')}
                className="h-10 px-5 rounded-xl text-[14px] font-medium text-[#8e8e93] hover:text-white hover:bg-white/8 cursor-pointer transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || !filename.trim()}
                className="h-10 px-6 rounded-xl text-[14px] font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)', boxShadow: '0 2px 12px rgba(10,132,255,0.3)' }}
              >
                <DownloadIcon size={14} />
                {exporting ? 'Exporting…' : 'Export to HTML'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-[#e5e5ea]">{label}</div>
        <div className="text-[12px] text-[#636366] mt-0.5">{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}
