import type { Capture, Demo, DemoStep, ExportOptions } from '../types/index'

// Augment the global Window type with our API bridge
declare global {
  interface Window {
    api: {
      getCaptures: (filters?: { platform?: string; search?: string }) => Promise<Capture[]>
      getCapture: (id: string) => Promise<Capture | null>
      deleteCapture: (id: string) => Promise<void>
      importCapture: (htmlContent: string, metadata: Partial<Capture>) => Promise<Capture>
      updateCaptureTags: (id: string, tags: string[]) => Promise<void>
      getDemos: () => Promise<Demo[]>
      getDemo: (id: string) => Promise<Demo>
      createDemo: (name: string, platform: string) => Promise<Demo>
      updateDemo: (id: string, updates: Partial<Demo>) => Promise<void>
      deleteDemo: (id: string) => Promise<void>
      addStep: (demoId: string, captureId: string, stepOrder: number) => Promise<DemoStep>
      updateStep: (stepId: string, updates: Partial<DemoStep>) => Promise<void>
      removeStep: (stepId: string) => Promise<void>
      reorderSteps: (demoId: string, stepIds: string[]) => Promise<void>
      exportDemo: (demoId: string, options: ExportOptions) => Promise<string>
      showSaveDialog: (defaultName: string) => Promise<string | null>
      getCaptureServerStatus: () => Promise<{ running: boolean; port: number }>
      readCaptureHtml: (captureId: string) => Promise<string>
      onCaptureReceived: (callback: (capture: Capture) => void) => void
      onCaptureThumbnailUpdated: (callback: (data: { id: string; thumbnailPath: string }) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}

export { }
