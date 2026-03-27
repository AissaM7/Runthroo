import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { initDatabase, getDb, dbListCaptures, dbGetCapture, dbInsertCapture, dbDeleteCapture, dbDeleteCaptureWithCascade, dbUpdateCaptureTags, dbListDemos, dbGetDemo, dbInsertDemo, dbUpdateDemo, dbDeleteDemo, dbInsertStep, dbUpdateStep, dbDeleteStep, dbReorderSteps, dbReindexSteps, dbListSteps } from './services/database'
import { initDirectories, writeCaptureFile, readCaptureFile, deleteCaptureFile, deleteThumbnailFile } from './services/fileManager'
import { startCaptureServer } from './services/captureServer'
import { generateThumbnail } from './services/thumbnailGenerator'
import { exportDemo as runExport } from './services/exportEngine'
import type { Capture, ExportOptions } from '../src/types/index'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Runthroo',
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers() {
  // ── Captures ──────────────────────────────────────────────────────────────
  ipcMain.handle('captures:list', (_e, filters?: { platform?: string; search?: string }) => {
    return dbListCaptures(filters?.platform, filters?.search)
  })

  ipcMain.handle('captures:get', (_e, id: string) => {
    return dbGetCapture(id)
  })

  ipcMain.handle('captures:delete', (_e, id: string) => {
    deleteCaptureFile(id)
    deleteThumbnailFile(id)
    dbDeleteCaptureWithCascade(id)
  })

  ipcMain.handle('captures:import', async (_e, htmlContent: string, metadata: Partial<Capture>) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    const filePath = writeCaptureFile(id, htmlContent)
    const byteSize = Buffer.byteLength(htmlContent, 'utf-8')

    const capture = {
      id,
      platform: metadata.platform || 'unknown',
      pageLabel: metadata.pageLabel || 'Untitled',
      sourceUrl: metadata.sourceUrl || '',
      viewportWidth: metadata.viewportWidth || 1440,
      viewportHeight: metadata.viewportHeight || 900,
      byteSize,
      filePath,
      thumbnailPath: null as string | null,
      tags: metadata.tags || [],
      capturedAt: metadata.capturedAt || now,
    }

    dbInsertCapture(capture)

    // Generate thumbnail from the file on disk (not raw HTML — avoids data: URL size limit)
    generateThumbnail(id, filePath).then(thumbnailPath => {
      if (thumbnailPath && mainWindow) {
        mainWindow.webContents.send('captures:thumbnail-updated', { id, thumbnailPath })
      }
    }).catch(() => { })

    return { ...capture, createdAt: now }
  })

  ipcMain.handle('captures:update-tags', (_e, id: string, tags: string[]) => {
    dbUpdateCaptureTags(id, tags)
  })

  ipcMain.handle('captures:read-html', (_e, captureId: string) => {
    return readCaptureFile(captureId)
  })

  // ── Demos ─────────────────────────────────────────────────────────────────
  ipcMain.handle('demos:list', () => {
    return dbListDemos()
  })

  ipcMain.handle('demos:get', (_e, id: string) => {
    return dbGetDemo(id)
  })

  ipcMain.handle('demos:create', (_e, name: string, platform: string) => {
    const id = uuidv4()
    dbInsertDemo(id, name, platform)
    return dbGetDemo(id)
  })

  ipcMain.handle('demos:update', (_e, id: string, updates: { name?: string; description?: string; platform?: string }) => {
    dbUpdateDemo(id, updates)
  })

  ipcMain.handle('demos:delete', (_e, id: string) => {
    dbDeleteDemo(id)
  })

  // ── Steps ─────────────────────────────────────────────────────────────────
  ipcMain.handle('steps:add', (_e, demoId: string, captureId: string, stepOrder: number) => {
    const id = uuidv4()
    dbInsertStep({ id, demoId, captureId, stepOrder, label: '', clickZone: null, cursorConfig: null, transition: 'fade' })
    return dbListSteps(demoId).find(s => s.id === id)
  })

  ipcMain.handle('steps:update', (_e, stepId: string, updates: { label?: string; clickZone?: unknown; cursorConfig?: unknown; transition?: string }) => {
    dbUpdateStep(stepId, updates)
  })

  ipcMain.handle('steps:remove', (_e, stepId: string) => {
    // Get the step's demoId before deleting so we can reindex
    const db = getDb()
    const step = db.prepare('SELECT demo_id FROM demo_steps WHERE id = ?').get(stepId) as { demo_id: string } | undefined
    dbDeleteStep(stepId)
    if (step) dbReindexSteps(step.demo_id)
  })

  ipcMain.handle('steps:reorder', (_e, demoId: string, stepIds: string[]) => {
    dbReorderSteps(demoId, stepIds)
  })

  // ── Export ────────────────────────────────────────────────────────────────
  ipcMain.handle('export:run', async (_e, demoId: string, options: ExportOptions) => {
    const demo = dbGetDemo(demoId)
    if (!demo) throw new Error('Demo not found')
    return runExport(demo, options)
  })

  ipcMain.handle('dialog:save', async (_e, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Demo',
      defaultPath: defaultName,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    return result.canceled ? null : result.filePath
  })

  // ── Capture server status ─────────────────────────────────────────────────
  ipcMain.handle('capture-server:status', () => {
    return { running: true, port: 19876 }
  })
}

app.whenReady().then(() => {
  initDatabase()
  initDirectories()
  registerIpcHandlers()

  startCaptureServer(
    (capture: Capture) => {
      if (mainWindow) {
        mainWindow.webContents.send('captures:new', capture)
      }
    },
    (captureId: string, thumbnailPath: string) => {
      if (mainWindow) {
        mainWindow.webContents.send('captures:thumbnail-updated', { id: captureId, thumbnailPath })
      }
    }
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export function getMainWindow() {
  return mainWindow
}
