import { create } from 'zustand'

type View = 'library' | 'editor' | 'demos' | 'preview' | 'export'
type DrawMode = 'none' | 'click-zone' | 'cursor-start' | 'cursor-end' | 'blur-draw' | 'text-edit' | 'element-picker' | 'branch-zone'

interface UIStoreState {
  currentView: View
  drawMode: DrawMode
  captureServerRunning: boolean
  setView: (view: View) => void
  setDrawMode: (mode: DrawMode) => void
  setCaptureServerRunning: (running: boolean) => void
}

export const useUIStore = create<UIStoreState>((set) => ({
  currentView: 'library',
  drawMode: 'none',
  captureServerRunning: false,
  setView: (view) => set({ currentView: view }),
  setDrawMode: (mode) => set({ drawMode: mode }),
  setCaptureServerRunning: (running) => set({ captureServerRunning: running }),
}))
