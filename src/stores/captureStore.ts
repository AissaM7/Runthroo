import { create } from 'zustand'
import type { Capture } from '../types/index'

interface CaptureStoreState {
  captures: Capture[]
  filters: { platform: string; search: string }
  loading: boolean
  fetchCaptures: () => Promise<void>
  setFilters: (filters: Partial<{ platform: string; search: string }>) => void
  deleteCapture: (id: string) => Promise<void>
  addCapture: (capture: Capture) => void
  updateCaptureThumbnail: (id: string, thumbnailPath: string) => void
}

export const useCaptureStore = create<CaptureStoreState>((set, get) => ({
  captures: [],
  filters: { platform: '', search: '' },
  loading: false,

  fetchCaptures: async () => {
    set({ loading: true })
    try {
      const { filters } = get()
      const captures = await window.api.getCaptures({
        platform: filters.platform || undefined,
        search: filters.search || undefined,
      })
      set({ captures, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  setFilters: (newFilters) => {
    set(state => ({ filters: { ...state.filters, ...newFilters } }))
    get().fetchCaptures()
  },

  deleteCapture: async (id) => {
    await window.api.deleteCapture(id)
    set(state => ({ captures: state.captures.filter(c => c.id !== id) }))
  },

  addCapture: (capture) => {
    set(state => ({ captures: [capture, ...state.captures] }))
  },

  updateCaptureThumbnail: (id, thumbnailPath) => {
    set(state => ({
      captures: state.captures.map(c => c.id === id ? { ...c, thumbnailPath } : c)
    }))
  },
}))
