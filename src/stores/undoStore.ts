import { create } from 'zustand'
import type { BlurZone, TextEdit, BranchClickZone } from '../types/index'

export interface StepSnapshot {
  blurZones: BlurZone[]
  textEdits: TextEdit[]
  hiddenElements: string[]
  clickZones: BranchClickZone[]
}

interface UndoStoreState {
  stacks: Record<string, StepSnapshot[]>
  pushState: (stepId: string, snapshot: StepSnapshot) => void
  undo: (stepId: string) => StepSnapshot | null
  canUndo: (stepId: string) => boolean
}

export const useUndoStore = create<UndoStoreState>((set, get) => ({
  stacks: {},

  pushState: (stepId, snapshot) => {
    set(state => {
      const stack = state.stacks[stepId] || []
      // Limit to 50 entries
      return { stacks: { ...state.stacks, [stepId]: [...stack.slice(-49), snapshot] } }
    })
  },

  undo: (stepId) => {
    const stack = get().stacks[stepId]
    if (!stack || stack.length === 0) return null
    const last = stack[stack.length - 1]
    set(state => ({
      stacks: { ...state.stacks, [stepId]: stack.slice(0, -1) }
    }))
    return last
  },

  canUndo: (stepId) => (get().stacks[stepId]?.length ?? 0) > 0,
}))
