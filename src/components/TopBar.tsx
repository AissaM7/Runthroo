import React, { useState, useRef, useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useDemoStore } from '../stores/demoStore'
import { useUndoStore, type StepSnapshot } from '../stores/undoStore'
import { PlayIcon, DownloadIcon } from './Icons'

export function TopBar() {
  const { currentView, setView, captureServerRunning } = useUIStore()
  const { currentDemo, updateDemo } = useDemoStore()
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const { selectedStepId, updateStep } = useDemoStore()
  const { canUndo, undo, stacks } = useUndoStore()

  const inEditor = currentView === 'editor' || currentView === 'preview' || currentView === 'export'
  const viewTitle = ''

  // Derive undo availability from the stacks state (reactive)
  const hasUndo = selectedStepId ? canUndo(selectedStepId) : false

  function handleUndo() {
    if (!selectedStepId) return
    const snapshot = undo(selectedStepId)
    if (snapshot) {
      updateStep(selectedStepId, {
        blurZones: snapshot.blurZones,
        textEdits: snapshot.textEdits,
        hiddenElements: snapshot.hiddenElements,
        clickZones: snapshot.clickZones,
      })
    }
  }

  // Keyboard shortcut: Cmd/Ctrl+Z for undo
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [selectedStepId, stacks])

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
      className="relative flex items-center pr-5 pl-[80px] [&_button]:[-webkit-app-region:no-drag] [&_input]:[-webkit-app-region:no-drag]"
      style={{
        height: 52,
        background: 'linear-gradient(180deg, rgba(50,50,55,0.97) 0%, rgba(40,40,44,0.97) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(20px)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
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
            {/* Cursor icon — Runthroo brand */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 2L3 12L6 9L9.5 13L11 12L7.5 8L11 7L3 2Z" fill="white" />
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

            {/* Undo button */}
            <button
              onClick={handleUndo}
              disabled={!hasUndo}
              className="h-9 px-3 flex items-center gap-1.5 text-[13px] font-medium rounded-lg transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: hasUndo ? 'rgba(10,132,255,0.1)' : 'rgba(255,255,255,0.04)',
                color: hasUndo ? '#4DA3FF' : 'rgba(255,255,255,0.3)',
                border: hasUndo ? '1px solid rgba(10,132,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
              }}
              title="Undo (Cmd+Z)"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                <path d="M3 5l-2-2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1 3h6.5a3.5 3.5 0 010 7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Undo
            </button>

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
