import React, { useState, useRef } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useDemoStore } from '../stores/demoStore'
import { PlayIcon, DownloadIcon } from './Icons'

export function TopBar() {
  const { currentView, setView, captureServerRunning } = useUIStore()
  const { currentDemo, updateDemo } = useDemoStore()
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const inEditor = currentView === 'editor' || currentView === 'preview' || currentView === 'export'
  const viewTitle = ''

  function startEditName() {
    if (!currentDemo) return
    setDraftName(currentDemo.name)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 0)
  }

  function commitName() {
    if (draftName.trim()) updateDemo({ name: draftName.trim() })
    setEditingName(false)
  }

  return (
    <header
      className="relative flex items-center px-5"
      style={{
        height: 52,
        background: 'linear-gradient(180deg, rgba(50,50,55,0.97) 0%, rgba(40,40,44,0.97) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent pointer-events-none" />

      {/* Left zone — logo + nav tabs */}
      <div className="flex items-center gap-1">
        {/* Runthroo wordmark */}
        <button
          onClick={() => setView('library')}
          className="flex items-center gap-2 mr-3 cursor-pointer group"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)' }}
          >
            {/* Monitor with play button — demo/tech icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="9" rx="1.5" stroke="white" strokeWidth="1.4" fill="none" />
              <path d="M7 5.5v4l3-2-3-2z" fill="white" />
              <path d="M5.5 13.5h5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <span
            className="text-[16px] font-bold tracking-tight group-hover:opacity-80 transition-opacity"
            style={{
              background: 'linear-gradient(135deg, #e5e5ea, #8e8e93)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Runthroo
          </span>
        </button>

        <div className="w-px h-5 bg-white/8 mx-1" />
        <NavTab label="Library" view="library" current={currentView} onClick={setView} />
        <NavTab label="Editor" view="editor" current={currentView} onClick={setView} />
        <NavTab label="Demos" view="demos" current={currentView} onClick={setView} />
      </div>

      {/* Center zone — editable title or view label */}
      <div className="flex-1 flex items-center justify-center">
        {inEditor && currentDemo ? (
          editingName ? (
            <input
              ref={nameInputRef}
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
              className="bg-[#1c1c1e] border border-[#0A84FF] rounded-lg px-3 h-8 text-[15px] text-white outline-none w-64 text-center focus:ring-2 focus:ring-[#0A84FF]/20"
              autoFocus
            />
          ) : (
            <button
              onClick={startEditName}
              className="text-[15px] font-semibold tracking-tight text-white/90 hover:text-white transition-colors cursor-pointer"
              title="Click to rename"
            >
              {currentDemo.name}
            </button>
          )
        ) : (
          <span className="text-[14px] font-medium text-white/25">{viewTitle}</span>
        )}
      </div>

      {/* Right zone */}
      <div className="flex items-center gap-2.5">
        {/* Server status */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            className="w-[7px] h-[7px] rounded-full shrink-0"
            style={{
              background: captureServerRunning ? '#30d158' : '#ff453a',
              boxShadow: captureServerRunning ? '0 0 8px rgba(48,209,88,0.5)' : '0 0 8px rgba(255,69,58,0.4)',
            }}
          />
          <span className="text-[12px] text-white/35 font-mono tabular-nums">
            {captureServerRunning ? 'localhost:19876' : 'offline'}
          </span>
        </div>

        {inEditor && currentDemo && (
          <>
            <div className="w-px h-5 bg-white/8" />
            <button
              onClick={() => setView('preview')}
              className="h-9 px-4 flex items-center gap-2 text-white text-[13px] font-semibold rounded-lg transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #30d158, #28a745)', boxShadow: '0 2px 8px rgba(48,209,88,0.25)' }}
            >
              <PlayIcon size={13} />
              Present
            </button>
            <button
              onClick={() => setView('export')}
              className="h-9 px-4 flex items-center gap-2 text-white text-[13px] font-semibold rounded-lg transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0A84FF, #0066cc)', boxShadow: '0 2px 8px rgba(10,132,255,0.25)' }}
            >
              <DownloadIcon size={13} />
              Export
            </button>
          </>
        )}
      </div>
    </header>
  )
}

function NavTab({
  label, view, current, onClick,
}: {
  label: string
  view: 'library' | 'editor' | 'demos' | 'preview' | 'export'
  current: string
  onClick: (v: 'library' | 'editor' | 'demos' | 'preview' | 'export') => void
}) {
  const active = current === view || (view === 'editor' && current === 'export')
  return (
    <button
      onClick={() => onClick(view)}
      className="relative px-3.5 py-1.5 text-[14px] font-medium rounded-lg transition-all duration-200 cursor-pointer"
      style={{
        color: active ? '#fff' : 'rgba(255,255,255,0.4)',
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'
            ; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'
            ; (e.currentTarget as HTMLElement).style.background = 'transparent'
        }
      }}
    >
      {label}
      {active && (
        <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-[#0A84FF]" />
      )}
    </button>
  )
}
