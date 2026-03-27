import { contextBridge, ipcRenderer } from 'electron'
import type { Capture, Demo, DemoStep, ExportOptions } from '../src/types/index'

contextBridge.exposeInMainWorld('api', {
  // Captures
  getCaptures: (filters?: { platform?: string; search?: string }): Promise<Capture[]> =>
    ipcRenderer.invoke('captures:list', filters),

  getCapture: (id: string): Promise<Capture | null> =>
    ipcRenderer.invoke('captures:get', id),

  deleteCapture: (id: string): Promise<void> =>
    ipcRenderer.invoke('captures:delete', id),

  importCapture: (htmlContent: string, metadata: Partial<Capture>): Promise<Capture> =>
    ipcRenderer.invoke('captures:import', htmlContent, metadata),

  updateCaptureTags: (id: string, tags: string[]): Promise<void> =>
    ipcRenderer.invoke('captures:update-tags', id, tags),

  // Demos
  getDemos: (): Promise<Demo[]> =>
    ipcRenderer.invoke('demos:list'),

  getDemo: (id: string): Promise<Demo> =>
    ipcRenderer.invoke('demos:get', id),

  createDemo: (name: string, platform: string): Promise<Demo> =>
    ipcRenderer.invoke('demos:create', name, platform),

  updateDemo: (id: string, updates: Partial<Demo>): Promise<void> =>
    ipcRenderer.invoke('demos:update', id, updates),

  deleteDemo: (id: string): Promise<void> =>
    ipcRenderer.invoke('demos:delete', id),

  // Steps
  addStep: (demoId: string, captureId: string, stepOrder: number): Promise<DemoStep> =>
    ipcRenderer.invoke('steps:add', demoId, captureId, stepOrder),

  updateStep: (stepId: string, updates: Partial<DemoStep>): Promise<void> =>
    ipcRenderer.invoke('steps:update', stepId, updates),

  removeStep: (stepId: string): Promise<void> =>
    ipcRenderer.invoke('steps:remove', stepId),

  reorderSteps: (demoId: string, stepIds: string[]): Promise<void> =>
    ipcRenderer.invoke('steps:reorder', demoId, stepIds),

  // Export
  exportDemo: (demoId: string, options: ExportOptions): Promise<string> =>
    ipcRenderer.invoke('export:run', demoId, options),

  showSaveDialog: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:save', defaultName),

  // Capture server status
  getCaptureServerStatus: (): Promise<{ running: boolean; port: number }> =>
    ipcRenderer.invoke('capture-server:status'),

  // File reading
  readCaptureHtml: (captureId: string): Promise<string> =>
    ipcRenderer.invoke('captures:read-html', captureId),

  // Events
  onCaptureReceived: (callback: (capture: Capture) => void): void => {
    ipcRenderer.on('captures:new', (_event, capture) => callback(capture))
  },

  onCaptureThumbnailUpdated: (callback: (data: { id: string; thumbnailPath: string }) => void): void => {
    ipcRenderer.on('captures:thumbnail-updated', (_event, data) => callback(data))
  },

  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel)
  },
})
