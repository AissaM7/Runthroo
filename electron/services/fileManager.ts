import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'

export function getDataRoot(): string {
  return app.getPath('userData')
}

export function getCapturesDir(): string {
  return join(getDataRoot(), 'captures')
}

export function getThumbnailsDir(): string {
  return join(getDataRoot(), 'thumbnails')
}

export function getExportsDir(): string {
  return join(getDataRoot(), 'exports')
}

export function initDirectories(): void {
  for (const dir of [getCapturesDir(), getThumbnailsDir(), getExportsDir()]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}

export function writeCaptureFile(captureId: string, htmlContent: string): string {
  const filePath = join(getCapturesDir(), `${captureId}.html`)
  writeFileSync(filePath, htmlContent, 'utf-8')
  return filePath
}

export function readCaptureFile(captureId: string): string {
  const filePath = join(getCapturesDir(), `${captureId}.html`)
  return readFileSync(filePath, 'utf-8')
}

export function deleteCaptureFile(captureId: string): void {
  const filePath = join(getCapturesDir(), `${captureId}.html`)
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function deleteThumbnailFile(captureId: string): void {
  const filePath = join(getThumbnailsDir(), `${captureId}.png`)
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function getThumbnailPath(captureId: string): string {
  return join(getThumbnailsDir(), `${captureId}.png`)
}

export function getExportPath(filename: string): string {
  return join(getExportsDir(), filename.endsWith('.html') ? filename : `${filename}.html`)
}

export function writeExportFile(filename: string, content: string): string {
  const filePath = getExportPath(filename)
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}
