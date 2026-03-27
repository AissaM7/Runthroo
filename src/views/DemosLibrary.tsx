import React, { useEffect, useState } from 'react'
import { useDemoStore } from '../stores/demoStore'
import { useCaptureStore } from '../stores/captureStore'
import { useUIStore } from '../stores/uiStore'
import { PageRenderer } from '../components/PageRenderer'
import { SearchIcon, CloseIcon, PlayIcon, FileIcon, TrashIcon, DownloadIcon } from '../components/Icons'
import type { Demo, Capture } from '../types/index'

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

const COLOR_PALETTE = [
    { bg: 'rgba(10,132,255,0.12)', text: '#0A84FF', accent: '#0A84FF' },
    { bg: 'rgba(249,115,22,0.12)', text: '#f97316', accent: '#f97316' },
    { bg: 'rgba(234,179,8,0.12)', text: '#eab308', accent: '#eab308' },
    { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', accent: '#a855f7' },
    { bg: 'rgba(236,72,153,0.12)', text: '#ec4899', accent: '#ec4899' },
    { bg: 'rgba(20,174,92,0.12)', text: '#14ae5c', accent: '#14ae5c' },
]

const platformColorCache: Record<string, { bg: string; text: string; accent: string }> = {}
function getPlatformColor(platform: string) {
    if (!platform || platform === 'unknown' || platform === '') return { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', accent: '#6b7280' }
    const key = platform.toLowerCase()
    if (!platformColorCache[key]) {
        const hash = key.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
        platformColorCache[key] = COLOR_PALETTE[hash % COLOR_PALETTE.length]
    }
    return platformColorCache[key]
}

// ─── Demo Card ────────────────────────────────────────────────────────────────
function DemoCard({ demo, captures, onOpen, onDelete }: {
    demo: Demo
    captures: Capture[]
    onOpen: () => void
    onDelete: () => void
}) {
    const color = getPlatformColor(demo.platform)
    const stepCaptures = demo.steps
        .map(s => captures.find(c => c.id === s.captureId))
        .filter(Boolean) as Capture[]
    const previewCapture = stepCaptures[0]

    return (
        <div
            className="group bg-[#2c2c2c] rounded-lg overflow-hidden cursor-pointer relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] border border-[#3a3a3a] hover:border-[#505050]"
            onClick={onOpen}
        >
            {/* Preview thumbnail — show first step's page */}
            <div className="aspect-[16/10] bg-[#151515] relative overflow-hidden">
                {previewCapture ? (
                    <PageRenderer
                        captureId={previewCapture.id}
                        viewportWidth={previewCapture.viewportWidth || 1440}
                        viewportHeight={previewCapture.viewportHeight || 900}
                        containerWidth={320}
                        containerHeight={200}
                        interactive={false}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#404040]">
                        <FileIcon size={24} />
                    </div>
                )}

                {/* Step count badge */}
                <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums">
                    {demo.steps.length} step{demo.steps.length !== 1 ? 's' : ''}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center gap-2">
                    <span className="text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-[#0A84FF]/80 px-2.5 py-1 rounded flex items-center gap-1">
                        <PlayIcon size={10} />
                        Open
                    </span>
                </div>
            </div>

            {/* Info */}
            <div className="px-2.5 py-2 space-y-1">
                <div className="text-[12px] font-medium text-white truncate">{demo.name}</div>
                <div className="flex items-center justify-between">
                    <span
                        className="inline-flex items-center h-4 px-1.5 rounded-sm text-[10px] font-medium"
                        style={{ background: color.bg, color: color.text }}
                    >
                        {demo.platform || 'unsorted'}
                    </span>
                    <span className="text-[10px] text-[#6e6e6e] tabular-nums">{timeAgo(demo.updatedAt)}</span>
                </div>
                {demo.description && (
                    <div className="text-[10px] text-[#505050] truncate">{demo.description}</div>
                )}
            </div>

            {/* Delete button on hover */}
            <button
                className="absolute top-2 left-2 z-10 w-6 h-6 rounded flex items-center justify-center bg-black/60 text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer hover:bg-red-500/30"
                onClick={e => { e.stopPropagation(); onDelete() }}
                title="Delete demo"
            >
                <TrashIcon size={12} />
            </button>
        </div>
    )
}

// ─── Platform Folder ──────────────────────────────────────────────────────────
function DemoFolder({ platform, demos, captures, onClick }: {
    platform: string
    demos: Demo[]
    captures: Capture[]
    onClick: () => void
}) {
    const color = getPlatformColor(platform)
    // Get up to 3 first-step captures for stack previews
    const previewCaptures = demos.slice(0, 3).map(d => {
        const firstStep = d.steps[0]
        return firstStep ? captures.find(c => c.id === firstStep.captureId) : null
    }).filter(Boolean) as Capture[]

    return (
        <div
            className="group bg-[#2c2c2c] rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] border border-[#3a3a3a] hover:border-[#505050]"
            onClick={onClick}
        >
            {/* Stacked preview */}
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
                {previewCaptures.length === 0 && (
                    <div className="w-full h-full flex items-center justify-center text-[#404040]">
                        <FileIcon size={24} />
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#2c2c2c] to-transparent" />
            </div>

            {/* Folder info */}
            <div className="px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: color.bg }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                        </svg>
                    </div>
                    <span className="text-[14px] font-semibold text-white capitalize">{platform}</span>
                </div>
                <span className="text-[11px] text-[#6e6e6e]">
                    {demos.length} demo{demos.length !== 1 ? 's' : ''}
                </span>
            </div>
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN DEMOS LIBRARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function DemosLibrary() {
    const { demos, fetchDemos, loadDemo, deleteDemo } = useDemoStore()
    const { captures, fetchCaptures } = useCaptureStore()
    const { setView } = useUIStore()
    const [search, setSearch] = useState('')
    const [openFolder, setOpenFolder] = useState<string | null>(null)

    useEffect(() => { fetchDemos(); fetchCaptures() }, [])

    // Group demos by platform
    const knownPlatforms = [...new Set(demos.map(d => d.platform).filter(p => p && p !== '' && p !== 'unknown'))]
    const platformGroups = knownPlatforms.reduce<Record<string, Demo[]>>((acc, p) => {
        acc[p] = demos.filter(d => d.platform === p)
        return acc
    }, {})
    const unsorted = demos.filter(d => !d.platform || d.platform === '' || d.platform === 'unknown')

    function handleOpenDemo(demo: Demo) {
        loadDemo(demo.id)
        setView('editor')
    }

    function handleDeleteDemo(id: string) {
        deleteDemo(id)
    }

    // ─── Inside a folder ────────────────────────────────────────────────────
    if (openFolder) {
        const color = getPlatformColor(openFolder)
        const folderDemos = (platformGroups[openFolder] || []).filter(d =>
            !search || d.name.toLowerCase().includes(search.toLowerCase())
        )

        return (
            <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
                <div className="bg-[#2c2c2c] px-4 py-2.5 flex items-center gap-3 border-b border-[#3a3a3a] shrink-0">
                    <button
                        onClick={() => { setOpenFolder(null); setSearch('') }}
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
                        <span className="text-[11px] text-[#6e6e6e]">{folderDemos.length} demo{folderDemos.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="relative ml-4">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e6e6e] pointer-events-none"><SearchIcon size={13} /></span>
                        <input
                            className="w-56 h-7 bg-[#1e1e1e] border border-[#3a3a3a] rounded-md pl-7 pr-3 text-[12px] text-white placeholder-[#6e6e6e] outline-none transition-all duration-150 hover:border-[#505050] focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]/30"
                            placeholder="Search demos…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                        {folderDemos.map(demo => (
                            <DemoCard
                                key={demo.id}
                                demo={demo}
                                captures={captures}
                                onOpen={() => handleOpenDemo(demo)}
                                onDelete={() => handleDeleteDemo(demo.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // ─── Main view ──────────────────────────────────────────────────────────
    const searchedDemos = demos.filter(d =>
        !search || d.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
            {/* Filter bar */}
            <div className="bg-[#2c2c2c] px-4 py-2.5 flex items-center gap-3 border-b border-[#3a3a3a] shrink-0">
                <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e6e6e] pointer-events-none"><SearchIcon size={13} /></span>
                    <input
                        className="w-64 h-7 bg-[#1e1e1e] border border-[#3a3a3a] rounded-md pl-7 pr-3 text-[12px] text-white placeholder-[#6e6e6e] outline-none transition-all duration-150 hover:border-[#505050] focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]/30"
                        placeholder="Search demos…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <span className="text-[11px] text-[#6e6e6e] whitespace-nowrap tabular-nums">
                        {demos.length} demo{demos.length !== 1 ? 's' : ''}
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
                {demos.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[320px]">
                        <div
                            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                            style={{ background: 'linear-gradient(135deg, rgba(10,132,255,0.15), rgba(10,132,255,0.05))' }}
                        >
                            <PlayIcon size={36} />
                        </div>
                        <p className="text-[17px] font-semibold text-white mb-1">No demos yet</p>
                        <p className="text-[12px] text-[#6e6e6e] mb-6 text-center max-w-xs">
                            Create a demo from the Editor tab by adding captured pages and stringing them together.
                        </p>
                        <button
                            onClick={() => setView('editor')}
                            className="h-8 px-4 text-white text-[12px] font-medium rounded transition-all duration-150 cursor-pointer"
                            style={{ background: 'linear-gradient(to right, #0A84FF, #0066cc)' }}
                        >
                            Go to Editor
                        </button>
                    </div>
                ) : (
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
                                        <DemoFolder
                                            key={platform}
                                            platform={platform}
                                            demos={platformGroups[platform]}
                                            captures={captures}
                                            onClick={() => { setOpenFolder(platform); setSearch('') }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Unsorted demos */}
                        {unsorted.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[12px] font-semibold text-[#ababab] uppercase tracking-[0.08em]">Unsorted</span>
                                    <span className="text-[10px] text-[#505050]">{unsorted.length} demo{unsorted.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                                    {unsorted.map(demo => (
                                        <DemoCard
                                            key={demo.id}
                                            demo={demo}
                                            captures={captures}
                                            onOpen={() => handleOpenDemo(demo)}
                                            onDelete={() => handleDeleteDemo(demo.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* All demos flat list */}
                        {knownPlatforms.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[12px] font-semibold text-[#ababab] uppercase tracking-[0.08em]">All Demos</span>
                                    <span className="text-[10px] text-[#505050]">{searchedDemos.length} total</span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                                    {searchedDemos.map(demo => (
                                        <DemoCard
                                            key={demo.id}
                                            demo={demo}
                                            captures={captures}
                                            onOpen={() => handleOpenDemo(demo)}
                                            onDelete={() => handleDeleteDemo(demo.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
