import { create } from 'zustand'
import type { Demo, DemoStep, ExportOptions } from '../types/index'

interface DemoStoreState {
  demos: Demo[]
  currentDemo: Demo | null
  selectedStepId: string | null
  loading: boolean
  fetchDemos: () => Promise<void>
  loadDemo: (id: string) => Promise<void>
  createDemo: (name: string, platform: string) => Promise<void>
  updateDemo: (updates: Partial<Demo>) => Promise<void>
  deleteDemo: (id: string) => Promise<void>
  addStep: (captureId: string) => Promise<void>
  updateStep: (stepId: string, updates: Partial<DemoStep>) => Promise<void>
  removeStep: (stepId: string) => Promise<void>
  reorderSteps: (stepIds: string[]) => Promise<void>
  selectStep: (stepId: string | null) => void
  exportDemo: (options: ExportOptions) => Promise<string>
}

export const useDemoStore = create<DemoStoreState>((set, get) => ({
  demos: [],
  currentDemo: null,
  selectedStepId: null,
  loading: false,

  fetchDemos: async () => {
    set({ loading: true })
    try {
      const demos = await window.api.getDemos()
      set({ demos, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  loadDemo: async (id) => {
    const demo = await window.api.getDemo(id)
    set({ currentDemo: demo, selectedStepId: demo?.steps[0]?.id ?? null })
  },

  createDemo: async (name, platform) => {
    const demo = await window.api.createDemo(name, platform)
    set(state => ({ demos: [demo, ...state.demos], currentDemo: demo }))
  },

  updateDemo: async (updates) => {
    const { currentDemo } = get()
    if (!currentDemo) return
    await window.api.updateDemo(currentDemo.id, updates)
    const updated = { ...currentDemo, ...updates }
    set(state => ({
      currentDemo: updated,
      demos: state.demos.map(d => d.id === currentDemo.id ? updated : d),
    }))
  },

  deleteDemo: async (id) => {
    await window.api.deleteDemo(id)
    set(state => ({
      demos: state.demos.filter(d => d.id !== id),
      currentDemo: state.currentDemo?.id === id ? null : state.currentDemo,
    }))
  },

  addStep: async (captureId) => {
    const { currentDemo } = get()
    if (!currentDemo) return
    const stepOrder = currentDemo.steps.length
    const step = await window.api.addStep(currentDemo.id, captureId, stepOrder)
    const updated = { ...currentDemo, steps: [...currentDemo.steps, step] }
    set({ currentDemo: updated, selectedStepId: step.id })
  },

  updateStep: async (stepId, updates) => {
    await window.api.updateStep(stepId, updates)
    const { currentDemo } = get()
    if (!currentDemo) return
    const updatedSteps = currentDemo.steps.map(s => s.id === stepId ? { ...s, ...updates } : s)
    set({ currentDemo: { ...currentDemo, steps: updatedSteps } })
  },

  removeStep: async (stepId) => {
    await window.api.removeStep(stepId)
    const { currentDemo, selectedStepId } = get()
    if (!currentDemo) return
    const oldIndex = currentDemo.steps.findIndex(s => s.id === stepId)
    const updatedSteps = currentDemo.steps
      .filter(s => s.id !== stepId)
      .map((s, i) => ({ ...s, stepOrder: i }))
    // Select the previous step, or the first step, or null
    const newSelectedId = updatedSteps.length > 0
      ? updatedSteps[Math.max(0, oldIndex - 1)].id
      : null
    set({ currentDemo: { ...currentDemo, steps: updatedSteps }, selectedStepId: newSelectedId })
  },

  reorderSteps: async (stepIds) => {
    const { currentDemo } = get()
    if (!currentDemo) return
    await window.api.reorderSteps(currentDemo.id, stepIds)
    const stepMap = new Map(currentDemo.steps.map(s => [s.id, s]))
    const reordered = stepIds.map((id, i) => ({ ...stepMap.get(id)!, stepOrder: i }))
    set({ currentDemo: { ...currentDemo, steps: reordered } })
  },

  selectStep: (stepId) => set({ selectedStepId: stepId }),

  exportDemo: async (options) => {
    const { currentDemo } = get()
    if (!currentDemo) throw new Error('No demo selected')
    return window.api.exportDemo(currentDemo.id, options)
  },
}))
