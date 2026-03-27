import React, { useState } from 'react'
import { useDemoStore } from '../stores/demoStore'
import { useUIStore } from '../stores/uiStore'

export function Sidebar() {
  const { demos, currentDemo, fetchDemos, loadDemo, createDemo, deleteDemo } = useDemoStore()
  const { setView } = useUIStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPlatform, setNewPlatform] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createDemo(newName.trim(), newPlatform.trim())
    setNewName('')
    setNewPlatform('')
    setShowCreate(false)
    setView('editor')
  }

  return (
    <aside className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
      <div className="p-3 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Demos</span>
        <button
          onClick={() => setShowCreate(true)}
          className="text-indigo-400 hover:text-indigo-300 text-lg leading-none"
          title="New demo"
        >+</button>
      </div>

      {showCreate && (
        <div className="p-3 border-b border-slate-700 space-y-2">
          <input
            className="w-full px-2 py-1.5 rounded bg-slate-700 text-white text-xs border border-slate-600 outline-none focus:border-indigo-500"
            placeholder="Demo name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false) }}
          />
          <input
            className="w-full px-2 py-1.5 rounded bg-slate-700 text-white text-xs border border-slate-600 outline-none focus:border-indigo-500"
            placeholder="Platform (optional)"
            value={newPlatform}
            onChange={e => setNewPlatform(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 py-1 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500">
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="flex-1 py-1 rounded bg-slate-700 text-slate-300 text-xs hover:bg-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {demos.length === 0 && (
          <p className="text-slate-500 text-xs p-3">No demos yet. Create one above.</p>
        )}
        {demos.map(demo => (
          <button
            key={demo.id}
            onClick={() => { loadDemo(demo.id); setView('editor') }}
            className={`w-full text-left px-3 py-2.5 text-sm border-b border-slate-700 transition-colors ${
              currentDemo?.id === demo.id
                ? 'bg-indigo-600/20 text-white'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <div className="font-medium truncate">{demo.name}</div>
            {demo.platform && (
              <div className="text-xs text-slate-500 mt-0.5">{demo.platform}</div>
            )}
            <div className="text-xs text-slate-600 mt-0.5">{demo.steps.length} steps</div>
          </button>
        ))}
      </div>
    </aside>
  )
}
