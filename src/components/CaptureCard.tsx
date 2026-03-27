import React, { useState } from 'react'
import type { Capture } from '../types/index'
import { TrashIcon } from './Icons'

interface Props {
  capture: Capture
  onClick: () => void
  onDelete: () => void
  onAddToDemo?: () => void
  compact?: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const PLATFORM_COLORS = [
  { bg: 'bg-[#0A84FF]/10', text: 'text-[#0A84FF]' },
  { bg: 'bg-[#f97316]/10', text: 'text-[#f97316]' },
  { bg: 'bg-[#eab308]/10', text: 'text-[#eab308]' },
  { bg: 'bg-[#a855f7]/10', text: 'text-[#a855f7]' },
  { bg: 'bg-[#ec4899]/10', text: 'text-[#ec4899]' },
  { bg: 'bg-[#14ae5c]/10', text: 'text-[#14ae5c]' },
]

function getPlatformColor(platform: string) {
  const hash = platform.toLowerCase().split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PLATFORM_COLORS[hash % PLATFORM_COLORS.length]
}

export function CaptureCard({ capture, onClick, onDelete, onAddToDemo, compact = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const platformColor = getPlatformColor(capture.platform)

  return (
    <div
      className="group bg-[#2c2c2c] rounded-lg overflow-hidden cursor-pointer relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); setMenuOpen(true) }}
    >
      {/* Thumbnail */}
      <div className="aspect-[16/10] bg-[#1e1e1e] relative overflow-hidden">
        {capture.thumbnailPath ? (
          <img
            src={`file://${capture.thumbnailPath}`}
            alt={capture.pageLabel}
            className="object-cover object-top w-full h-full"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(110deg, #1e1e1e 30%, #2a2a2a 50%, #1e1e1e 70%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.8s infinite',
              }}
            />
            <span className="relative text-[#4a4a4a] text-[10px]">Generating…</span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
          <span className="text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity font-medium">
            Preview
          </span>
        </div>
      </div>

      {/* Info */}
      {!compact ? (
        <div className="px-2.5 py-2 space-y-1">
          <div className="text-[12px] font-medium text-white truncate">{capture.pageLabel}</div>
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center h-4 px-1.5 rounded-sm text-[10px] font-medium ${platformColor.bg} ${platformColor.text}`}>
              {capture.platform}
            </span>
            <span className="text-[10px] text-[#6e6e6e] tabular-nums">{timeAgo(capture.capturedAt)}</span>
          </div>
        </div>
      ) : (
        <div className="px-2 py-1.5">
          <div className="text-[11px] font-medium text-white truncate">{capture.pageLabel}</div>
          <div className={`text-[10px] truncate mt-0.5 ${platformColor.text}`}>{capture.platform}</div>
        </div>
      )}

      {/* Context menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setMenuOpen(false) }} />
          <div className="absolute top-2 right-2 z-50 bg-[#2c2c2c] border border-[#4a4a4a] rounded-lg shadow-2xl py-1 min-w-[140px]">
            {onAddToDemo && (
              <button
                className="w-full text-left px-3 py-1.5 text-[12px] text-white hover:bg-[#404040] transition-colors cursor-pointer"
                onClick={e => { e.stopPropagation(); onAddToDemo(); setMenuOpen(false) }}
              >
                Add to Demo
              </button>
            )}
            <button
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#f24822] hover:bg-[#404040] transition-colors flex items-center gap-2 cursor-pointer"
              onClick={e => { e.stopPropagation(); onDelete(); setMenuOpen(false) }}
            >
              <TrashIcon size={12} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
