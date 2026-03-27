import React, { useEffect } from 'react'
import './lib/ipc'
import { useUIStore } from './stores/uiStore'
import { useCaptureStore } from './stores/captureStore'
import { useDemoStore } from './stores/demoStore'
import { TopBar } from './components/TopBar'
import { CaptureLibrary } from './views/CaptureLibrary'
import { FlowEditor } from './views/FlowEditor'
import { Preview } from './views/Preview'
import { ExportView } from './views/ExportView'
import { DemosLibrary } from './views/DemosLibrary'

export default function App() {
  const { currentView } = useUIStore()
  const { setCaptureServerRunning } = useUIStore()
  const { addCapture, updateCaptureThumbnail } = useCaptureStore()
  const { fetchDemos } = useDemoStore()

  const isPreview = currentView === 'preview'
  const isExport = currentView === 'export'

  useEffect(() => {
    window.api.getCaptureServerStatus().then(({ running }) => {
      setCaptureServerRunning(running)
    }).catch(() => { })

    window.api.onCaptureReceived((capture) => {
      addCapture(capture)
      setCaptureServerRunning(true)
    })

    window.api.onCaptureThumbnailUpdated(({ id, thumbnailPath }) => {
      updateCaptureThumbnail(id, thumbnailPath)
    })

    fetchDemos()

    return () => {
      window.api.removeAllListeners('captures:new')
      window.api.removeAllListeners('captures:thumbnail-updated')
    }
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-white overflow-hidden select-none">
      {!isPreview && <TopBar />}
      <div className="flex-1 flex overflow-hidden">
        {currentView === 'library' && <CaptureLibrary />}
        {currentView === 'demos' && <DemosLibrary />}
        {(currentView === 'editor' || isExport) && <FlowEditor />}
      </div>
      {isPreview && <Preview />}
      {isExport && <ExportView />}
    </div>
  )
}
