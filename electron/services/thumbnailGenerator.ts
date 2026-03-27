import { BrowserWindow } from 'electron'
import { getThumbnailPath } from './fileManager'
import { dbUpdateCaptureThumbnail } from './database'
import { writeFileSync, existsSync } from 'fs'

/**
 * Generate a thumbnail for a capture from its HTML file on disk.
 *
 * Uses loadFile() instead of a data: URL to avoid Chromium's ~2MB data URL limit.
 * Captured pages with inlined computed styles + base64 images can be 10-50MB,
 * which causes the data: URL approach to fail silently and return a blank bitmap.
 */
export async function generateThumbnail(captureId: string, htmlFilePath: string): Promise<string | null> {
  if (!existsSync(htmlFilePath)) return null

  return new Promise((resolve) => {
    let win: BrowserWindow | null = null
    const timeout = setTimeout(() => {
      win?.destroy()
      resolve(null)
    }, 20000)

    try {
      win = new BrowserWindow({
        width: 1440,
        height: 900,
        show: false,
        webPreferences: {
          offscreen: true,
          contextIsolation: true,
          nodeIntegration: false,
          javascript: false,
        },
      })

      // loadFile() reads directly from disk — no size limit, no base64 encoding
      win.loadFile(htmlFilePath)

      win.webContents.once('did-finish-load', async () => {
        try {
          // Wait longer for complex pages (Embrace dashboard has many layout layers;
          // 500ms was insufficient for paint to complete before capturePage() was called)
          await new Promise(r => setTimeout(r, 1500))

          const image = await win!.webContents.capturePage()
          if (image.isEmpty()) {
            clearTimeout(timeout)
            win!.destroy()
            resolve(null)
            return
          }

          const resized = image.resize({ width: 400 })
          const pngBuffer = resized.toPNG()
          const thumbnailPath = getThumbnailPath(captureId)
          writeFileSync(thumbnailPath, pngBuffer)
          dbUpdateCaptureThumbnail(captureId, thumbnailPath)
          clearTimeout(timeout)
          win!.destroy()
          resolve(thumbnailPath)
        } catch {
          clearTimeout(timeout)
          win?.destroy()
          resolve(null)
        }
      })

      win.webContents.once('did-fail-load', () => {
        clearTimeout(timeout)
        win?.destroy()
        resolve(null)
      })
    } catch {
      clearTimeout(timeout)
      win?.destroy()
      resolve(null)
    }
  })
}
