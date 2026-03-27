import React, { useEffect, useState, useRef } from 'react'
import { useCaptureStore } from '../stores/captureStore'
import { useDemoStore } from '../stores/demoStore'
import { useUIStore } from '../stores/uiStore'
import { PageRenderer } from '../components/PageRenderer'
import { SearchIcon, CameraIcon, CloseIcon, FileIcon } from '../components/Icons'
import { OnboardingWalkthrough } from '../components/OnboardingWalkthrough'
import type { Capture } from '../types/index'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string; accent: string }> = {}
const COLOR_PALETTE = [
  { bg: 'rgba(10,132,255,0.12)', text: '#0A84FF', accent: '#0A84FF' },
  { bg: 'rgba(249,115,22,0.12)', text: '#f97316', accent: '#f97316' },
  { bg: 'rgba(234,179,8,0.12)', text: '#eab308', accent: '#eab308' },
  { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', accent: '#a855f7' },
  { bg: 'rgba(236,72,153,0.12)', text: '#ec4899', accent: '#ec4899' },
  { bg: 'rgba(20,174,92,0.12)', text: '#14ae5c', accent: '#14ae5c' },
]

function getPlatformColor(platform: string) {
  if (!platform || platform === 'unknown') return { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', accent: '#6b7280' }
  const key = platform.toLowerCase()
  if (!PLATFORM_COLORS[key]) {
    const hash = key.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    PLATFORM_COLORS[key] = COLOR_PALETTE[hash % COLOR_PALETTE.length]
  }
  return PLATFORM_COLORS[key]
}

// ─── Mini capture card with live preview ──────────────────────────────────────
function CapturePreviewCard({ capture, onClick, isSelected, onToggleSelect, onDelete }: {
  capture: Capture
  onClick: () => void
  isSelected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const color = getPlatformColor(capture.platform)

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    onDelete()
  }

  return (
    <div
      className={`group bg-[#2c2c2c] rounded-lg overflow-hidden cursor-pointer relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${isSelected ? 'ring-2 ring-[#0A84FF]' : ''
        }`}
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); setMenuOpen(true) }}
    >
      {/* Selection checkbox */}
      <button
        className={`absolute top-2 left-2 z-10 w-5 h-5 rounded flex items-center justify-center transition-all duration-150 cursor-pointer ${isSelected ? 'bg-[#0A84FF] opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100'
          }`}
        style={{ opacity: isSelected ? 1 : undefined }}
        onClick={onToggleSelect}
        title="Select for demo"
      >
        {isSelected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Delete button on hover */}
      <button
        className="absolute top-2 right-2 z-10 w-6 h-6 rounded flex items-center justify-center bg-black/60 text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer hover:bg-red-500/30"
        onClick={handleDelete}
        title="Delete capture"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      </button>

      {/* Live Preview — mini iframe of the actual captured page */}
      <div className="aspect-[16/10] bg-[#151515] relative overflow-hidden">
        <PageRenderer
          captureId={capture.id}
          viewportWidth={capture.viewportWidth || 1440}
          viewportHeight={capture.viewportHeight || 900}
          containerWidth={320}
          containerHeight={200}
          interactive={false}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
          <span className="text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity font-medium bg-black/60 px-2.5 py-1 rounded">
            Preview
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="px-2.5 py-2 space-y-1">
        <div className="text-[12px] font-medium text-white truncate">{capture.pageLabel}</div>
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center h-4 px-1.5 rounded-sm text-[10px] font-medium"
            style={{ background: color.bg, color: color.text }}
          >
            {capture.platform || 'unknown'}
          </span>
          <span className="text-[10px] text-[#6e6e6e] tabular-nums">{timeAgo(capture.capturedAt)}</span>
        </div>
      </div>

      {/* Context menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setMenuOpen(false) }} />
          <div className="absolute top-2 right-2 z-50 bg-[#2c2c2c] border border-[#4a4a4a] rounded-lg shadow-2xl py-1 min-w-[140px]">
            <button
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#f24822] hover:bg-[#404040] transition-colors flex items-center gap-2 cursor-pointer"
              onClick={handleDelete}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Platform Folder ──────────────────────────────────────────────────────────
function PlatformFolder({ platform, captures, count, onClick }: {
  platform: string
  captures: Capture[]
  count: number
  onClick: () => void
}) {
  const color = getPlatformColor(platform)
  // Show up to 3 mini-preview thumbnails stacked
  const previewCaptures = captures.slice(0, 3)

  return (
    <div
      className="group bg-[#2c2c2c] rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] border border-[#3a3a3a] hover:border-[#505050]"
      onClick={onClick}
    >
      {/* Stacked preview thumbnails */}
      <div className="h-32 bg-[#1a1a1a] relative overflow-hidden">
        {previewCaptures.map((cap, i) => (
          <div
            key={cap.id}
            className="absolute rounded-md overflow-hidden shadow-lg border border-[#3a3a3a]"
            style={{
              width: '80%',
              height: '75%',
              top: `${10 + i * 6}%`,
              left: `${10 + i * 4}%`,
              zIndex: previewCaptures.length - i,
              transform: `rotate(${(i - 1) * 2}deg)`,
            }}
          >
            <PageRenderer
              captureId={cap.id}
              viewportWidth={cap.viewportWidth || 1440}
              viewportHeight={cap.viewportHeight || 900}
              containerWidth={250}
              containerHeight={120}
              interactive={false}
            />
          </div>
        ))}
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#2c2c2c] to-transparent" />
      </div>

      {/* Folder info */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: color.bg }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          </div>
          <span className="text-[14px] font-semibold text-white capitalize">{platform}</span>
        </div>
        <span className="text-[11px] text-[#6e6e6e]">
          {count} capture{count !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN CAPTURE LIBRARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function CaptureLibrary() {
  const { captures, filters, loading, fetchCaptures, setFilters, deleteCapture } = useCaptureStore()
  const { createDemo, addStep, fetchDemos } = useDemoStore()
  const { setView } = useUIStore()
  const [previewCapture, setPreviewCapture] = useState<Capture | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Auto-pop walkthrough after 1 second on first launch
  useEffect(() => {
    if (!localStorage.getItem('runthroo_onboarding_seen')) {
      const timer = setTimeout(() => setShowOnboarding(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  function closeOnboarding() {
    localStorage.setItem('runthroo_onboarding_seen', '1')
    setShowOnboarding(false)
  }
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [creatingDemo, setCreatingDemo] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [openFolder, setOpenFolder] = useState<string | null>(null)

  useEffect(() => { fetchCaptures() }, [])

  // Group captures by platform
  const knownPlatforms = [...new Set(captures.map(c => c.platform).filter(p => p && p !== 'unknown'))]
  const platformGroups = knownPlatforms.reduce<Record<string, Capture[]>>((acc, p) => {
    acc[p] = captures.filter(c => c.platform === p)
    return acc
  }, {})
  const unsorted = captures.filter(c => !c.platform || c.platform === 'unknown')

  // Filter captures when inside a folder view
  const filteredCaptures = openFolder
    ? (platformGroups[openFolder] || []).filter(c =>
      !filters.search || c.pageLabel.toLowerCase().includes(filters.search.toLowerCase()) ||
      c.sourceUrl.toLowerCase().includes(filters.search.toLowerCase())
    )
    : []

  async function openPreview(capture: Capture) {
    setPreviewCapture(capture)
    const html = await window.api.readCaptureHtml(capture.id)
    setPreviewHtml(html)
  }

  function closePreview() {
    setPreviewCapture(null)
    setPreviewHtml('')
  }

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function createDemoFromSelection() {
    if (selectedIds.size === 0 || creatingDemo) return
    setCreatingDemo(true)
    try {
      const firstCapture = captures.find(c => selectedIds.has(c.id))
      await createDemo('Untitled Demo', firstCapture?.platform ?? '')
      for (const id of selectedIds) {
        await addStep(id)
      }
      const count = selectedIds.size
      setSelectedIds(new Set())
      setToast(`Demo created with ${count} step${count > 1 ? 's' : ''} — opening Editor…`)
      setTimeout(() => setToast(null), 2500)
      setView('editor')
    } finally {
      setCreatingDemo(false)
    }
  }

  // ─── Inside a folder ────────────────────────────────────────────────────────
  if (openFolder) {
    const color = getPlatformColor(openFolder)
    return (
      <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
        {/* Header bar */}
        <div className="bg-[#2c2c2c] px-4 py-2.5 flex items-center gap-3 border-b border-[#3a3a3a] shrink-0">
          <button
            onClick={() => setOpenFolder(null)}
            className="h-7 px-2.5 flex items-center gap-1.5 text-[12px] text-[#ababab] hover:text-white rounded hover:bg-[#404040] transition-all duration-150 cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: color.bg }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-white capitalize">{openFolder}</span>
            <span className="text-[11px] text-[#6e6e6e]">
              {filteredCaptures.length} capture{filteredCaptures.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Search */}
          <div className="relative ml-4">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e6e6e] pointer-events-none">
              <SearchIcon size={13} />
            </span>
            <input
              className="w-56 h-7 bg-[#1e1e1e] border border-[#3a3a3a] rounded-md pl-7 pr-3 text-[12px] text-white placeholder-[#6e6e6e] outline-none transition-all duration-150 hover:border-[#505050] focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]/30"
              placeholder="Search in folder…"
              value={filters.search}
              onChange={e => setFilters({ search: e.target.value })}
            />
          </div>

          <div className="ml-auto">
            <button
              onClick={() => setView('editor')}
              className="h-9 px-4 flex items-center gap-2 text-[13px] font-semibold rounded-lg transition-all duration-200 cursor-pointer text-white hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)', boxShadow: '0 2px 10px rgba(10,132,255,0.3)' }}
            >
              + New Demo
            </button>
          </div>
        </div>

        {/* Grid of captures */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {filteredCaptures.map(capture => (
              <CapturePreviewCard
                key={capture.id}
                capture={capture}
                onClick={() => selectedIds.size > 0
                  ? toggleSelect({ stopPropagation: () => { } } as React.MouseEvent, capture.id)
                  : openPreview(capture)}
                isSelected={selectedIds.has(capture.id)}
                onToggleSelect={e => toggleSelect(e, capture.id)}
                onDelete={() => { deleteCapture(capture.id); fetchDemos() }}
              />
            ))}
          </div>
        </div>

        {/* Selection bar / Toast / Preview modal — shared */}
        {renderOverlays()}
      </div>
    )
  }

  // ─── Main view: folders + unsorted ──────────────────────────────────────────
  function renderOverlays() {
    return (
      <>
        {/* Selection action bar */}
        {selectedIds.size > 0 && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#4a4a4a] shadow-2xl"
            style={{ background: '#2c2c2c', backdropFilter: 'blur(12px)' }}
          >
            <span className="text-[12px] text-[#ababab]">
              {selectedIds.size} capture{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="w-px h-4 bg-[#3a3a3a]" />
            <button
              onClick={createDemoFromSelection}
              disabled={creatingDemo}
              className="h-7 px-3 flex items-center gap-1.5 text-white text-[12px] font-medium rounded transition-all duration-150 cursor-pointer disabled:opacity-50"
              style={{ background: 'linear-gradient(to right, #0A84FF, #0066cc)' }}
            >
              {creatingDemo ? 'Creating…' : '+ Create Demo'}
            </button>
            <button
              onClick={() => {
                for (const id of selectedIds) {
                  deleteCapture(id)
                }
                fetchDemos()
                setSelectedIds(new Set())
                fetchCaptures()
              }}
              className="h-7 px-3 flex items-center gap-1.5 text-red-400 text-[12px] font-medium rounded transition-all duration-150 cursor-pointer hover:bg-red-500/15"
              style={{ border: '1px solid rgba(255,59,48,0.3)' }}
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-[#404040] text-[#6e6e6e] hover:text-white transition-all duration-150 cursor-pointer"
            >
              <CloseIcon size={13} />
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#14ae5c]/30 shadow-2xl"
            style={{ background: 'rgba(20,174,92,0.12)', backdropFilter: 'blur(12px)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#14ae5c" strokeWidth="1.5" />
              <path d="M4 7l2 2 4-4" stroke="#14ae5c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[12px] text-[#14ae5c] font-medium">{toast}</span>
          </div>
        )}

        {/* Onboarding */}
        {showOnboarding && (
          <OnboardingWalkthrough onClose={closeOnboarding} />
        )}

        {/* Preview modal */}
        {previewCapture && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={closePreview}
          >
            <div
              className="relative bg-[#1e1e1e] rounded overflow-hidden shadow-2xl"
              style={{ width: '90vw', height: '85vh' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="h-10 flex items-center justify-between px-3 bg-[#2c2c2c] border-b border-[#3a3a3a]">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center h-4 px-1.5 rounded-sm text-[10px] font-medium"
                    style={{ background: getPlatformColor(previewCapture.platform).bg, color: getPlatformColor(previewCapture.platform).text }}
                  >
                    {previewCapture.platform}
                  </span>
                  <span className="text-[12px] text-white font-medium truncate max-w-[400px]">
                    {previewCapture.pageLabel}
                  </span>
                </div>
                <button
                  onClick={closePreview}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#404040] text-[#ababab] hover:text-white transition-colors cursor-pointer"
                >
                  <CloseIcon size={14} />
                </button>
              </div>

              {previewHtml && (() => {
                const vw = previewCapture.viewportWidth ?? 1440
                const vh = previewCapture.viewportHeight ?? 900
                const containerW = window.innerWidth * 0.9
                const containerH = window.innerHeight * 0.85 - 40
                const scale = Math.min(containerW / vw, containerH / vh, 1)
                return (
                  <div style={{ width: containerW, height: containerH, overflow: 'hidden', position: 'relative', background: 'white' }}>
                    <iframe
                      sandbox="allow-same-origin allow-scripts"
                      style={{
                        width: vw,
                        height: vh,
                        border: 'none',
                        transformOrigin: 'top left',
                        transform: `scale(${scale})`,
                      }}
                      ref={el => { if (el) el.srcdoc = previewHtml }}
                    />
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
      {/* Filter bar */}
      <div className="bg-[#2c2c2c] px-4 py-2.5 flex items-center gap-3 border-b border-[#3a3a3a] shrink-0">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e6e6e] pointer-events-none">
            <SearchIcon size={13} />
          </span>
          <input
            className="w-64 h-7 bg-[#1e1e1e] border border-[#3a3a3a] rounded-md pl-7 pr-3 text-[12px] text-white placeholder-[#6e6e6e] outline-none transition-all duration-150 hover:border-[#505050] focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]/30"
            placeholder="Search captures…"
            value={filters.search}
            onChange={e => setFilters({ search: e.target.value })}
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-[#6e6e6e] whitespace-nowrap tabular-nums">
            {captures.length} capture{captures.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setView('editor')}
            className="h-9 px-4 flex items-center gap-2 text-[13px] font-semibold rounded-lg transition-all duration-200 cursor-pointer text-white hover:scale-[1.03] active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)', boxShadow: '0 2px 10px rgba(10,132,255,0.3)' }}
          >
            + New Demo
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <span className="text-[11px] text-[#6e6e6e]">Loading…</span>
          </div>
        )}

        {!loading && captures.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[420px]" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
            {/* Hero icon with glow */}
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 relative"
              style={{
                background: 'linear-gradient(135deg, rgba(10,132,255,0.2), rgba(94,92,230,0.12))',
                boxShadow: '0 0 60px rgba(10,132,255,0.15), 0 0 120px rgba(94,92,230,0.08)',
              }}
            >
              <span className="text-[#0A84FF]"><CameraIcon size={40} /></span>
              <div className="absolute inset-0 rounded-3xl" style={{
                background: 'linear-gradient(135deg, transparent, rgba(255,255,255,0.05))',
                pointerEvents: 'none',
              }} />
            </div>

            {/* Heading */}
            <h2
              className="text-[28px] font-bold text-white mb-2 tracking-[-0.02em]"
              style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
            >
              No captures yet
            </h2>
            <p className="text-[15px] mb-10 text-center max-w-md leading-relaxed" style={{ color: '#8e8e93' }}>
              Capture any web page with the Chrome extension and
              turn it into an interactive product demo.
            </p>

            {/* Steps — glassmorphism cards */}
            <div className="w-full max-w-md space-y-3 mb-10">
              {[
                {
                  step: '1', title: 'Install the Extension', desc: 'Load from chrome://extensions with Developer Mode on', icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                    </svg>
                  )
                },
                {
                  step: '2', title: 'Navigate to Any Web App', desc: 'Open the page you want to capture in Chrome', icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  )
                },
                {
                  step: '3', title: 'Click "Capture This Page"', desc: 'The page will appear here in your library instantly', icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                    </svg>
                  )
                },
              ].map((item, idx) => (
                <div
                  key={item.step}
                  className="group flex items-center gap-4 rounded-xl px-5 py-4 transition-all duration-300 cursor-default"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(12px)',
                    animation: `fadeInUp 0.5s ease-out ${0.1 + idx * 0.1}s both`,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(10,132,255,0.08)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(10,132,255,0.2)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(10,132,255,0.15), rgba(94,92,230,0.1))',
                      border: '1px solid rgba(10,132,255,0.15)',
                    }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-white tracking-[-0.01em]">{item.title}</div>
                    <div className="text-[13px] mt-0.5" style={{ color: '#6e6e73' }}>{item.desc}</div>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums" style={{ color: 'rgba(10,132,255,0.4)' }}>
                    {item.step}
                  </span>
                </div>
              ))}
            </div>

            {/* Walkthrough button — prominent gradient */}
            <button
              onClick={() => setShowOnboarding(true)}
              className="group relative h-12 px-8 text-white text-[15px] font-semibold rounded-xl transition-all duration-300 cursor-pointer overflow-hidden hover:scale-[1.03] active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
                boxShadow: '0 4px 24px rgba(10,132,255,0.3), 0 1px 3px rgba(0,0,0,0.2)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(10,132,255,0.45), 0 1px 3px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(10,132,255,0.3), 0 1px 3px rgba(0,0,0,0.2)';
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-90"><polygon points="5,3 19,12 5,21" /></svg> Watch Walkthrough
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {/* Shimmer effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
              />
            </button>
          </div>
        )}

        {!loading && captures.length > 0 && (
          <div className="space-y-6">
            {/* Platform folders */}
            {knownPlatforms.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[12px] font-semibold text-[#ababab] uppercase tracking-[0.08em]">Platforms</span>
                  <span className="text-[10px] text-[#505050]">{knownPlatforms.length} folder{knownPlatforms.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {knownPlatforms.map(platform => (
                    <PlatformFolder
                      key={platform}
                      platform={platform}
                      captures={platformGroups[platform]}
                      count={platformGroups[platform].length}
                      onClick={() => { setOpenFolder(platform); setFilters({ search: '' }) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Unsorted captures */}
            {unsorted.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[12px] font-semibold text-[#ababab] uppercase tracking-[0.08em]">Unsorted</span>
                  <span className="text-[10px] text-[#505050]">{unsorted.length} capture{unsorted.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {unsorted.map(capture => (
                    <CapturePreviewCard
                      key={capture.id}
                      capture={capture}
                      onClick={() => selectedIds.size > 0
                        ? toggleSelect({ stopPropagation: () => { } } as React.MouseEvent, capture.id)
                        : openPreview(capture)}
                      isSelected={selectedIds.has(capture.id)}
                      onToggleSelect={e => toggleSelect(e, capture.id)}
                      onDelete={() => { deleteCapture(capture.id); fetchDemos() }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All captures section when there are platforms (for searchability) */}
            {knownPlatforms.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[12px] font-semibold text-[#ababab] uppercase tracking-[0.08em]">All Captures</span>
                  <span className="text-[10px] text-[#505050]">{captures.length} total</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {captures
                    .filter(c => !filters.search || c.pageLabel.toLowerCase().includes(filters.search.toLowerCase()) || c.sourceUrl.toLowerCase().includes(filters.search.toLowerCase()))
                    .map(capture => (
                      <CapturePreviewCard
                        key={capture.id}
                        capture={capture}
                        onClick={() => selectedIds.size > 0
                          ? toggleSelect({ stopPropagation: () => { } } as React.MouseEvent, capture.id)
                          : openPreview(capture)}
                        isSelected={selectedIds.has(capture.id)}
                        onToggleSelect={e => toggleSelect(e, capture.id)}
                        onDelete={() => { deleteCapture(capture.id); fetchDemos() }}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlays */}
      {renderOverlays()}
    </div>
  )
}
