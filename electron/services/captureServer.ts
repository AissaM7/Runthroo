import * as http from 'http'
import { v4 as uuidv4 } from 'uuid'
import { dbInsertCapture } from './database'
import { writeCaptureFile } from './fileManager'
import { generateThumbnail } from './thumbnailGenerator'
import type { Capture } from '../../src/types/index'

let server: http.Server | null = null

interface CapturePayload {
  sourceUrl: string
  pageTitle: string
  platform: string
  viewportWidth: number
  viewportHeight: number
  htmlContent: string
  tags: string[]
}

export function startCaptureServer(
  onCapture: (capture: Capture) => void,
  onThumbnailReady: (captureId: string, thumbnailPath: string) => void
): void {
  server = http.createServer((req, res) => {
    // CORS headers for the extension
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', port: 19876 }))
      return
    }

    if (req.method === 'POST' && req.url === '/api/captures') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body) as CapturePayload

          console.log('[Runthroo] capture received, HTML size:', payload.htmlContent?.length ?? 0, 'bytes')

          if (!payload.htmlContent) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'htmlContent is required' }))
            return
          }

          const id = uuidv4()
          const now = new Date().toISOString()
          // Write to disk first — filePath is passed to thumbnailGenerator
          // instead of the raw HTML string, avoiding the data: URL size limit
          const filePath = writeCaptureFile(id, payload.htmlContent)
          const byteSize = Buffer.byteLength(payload.htmlContent, 'utf-8')

          const capture: Omit<Capture, 'createdAt'> = {
            id,
            platform: payload.platform || 'unknown',
            pageLabel: payload.pageTitle || 'Untitled',
            sourceUrl: payload.sourceUrl || '',
            viewportWidth: payload.viewportWidth || 1440,
            viewportHeight: payload.viewportHeight || 900,
            byteSize,
            filePath,
            thumbnailPath: null,
            tags: payload.tags || [],
            capturedAt: now,
          }

          dbInsertCapture(capture)

          // Generate thumbnail from the saved file (not from the raw HTML string).
          // Call onThumbnailReady so main.ts can push captures:thumbnail-updated to renderer.
          generateThumbnail(id, filePath).then(thumbnailPath => {
            if (thumbnailPath) {
              onThumbnailReady(id, thumbnailPath)
            }
          }).catch(() => { })

          const fullCapture: Capture = { ...capture, createdAt: now }
          onCapture(fullCapture)

          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ captureId: id, message: 'Capture saved' }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
      return
    }

    res.writeHead(404)
    res.end()
  })

  const PORT = 19876

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Runthroo] Port ${PORT} in use, killing stale process and retrying...`)
      const { execSync } = require('child_process')
      try {
        execSync(`lsof -i :${PORT} -t | xargs kill -9`, { stdio: 'ignore' })
      } catch (_) { /* ignore */ }
      setTimeout(() => {
        server!.listen(PORT, '127.0.0.1', () => {
          console.log(`Capture server listening on 127.0.0.1:${PORT}`)
        })
      }, 500)
    } else {
      console.error('[Runthroo] Server error:', err)
    }
  })

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Capture server listening on 127.0.0.1:${PORT}`)
  })
}

export function stopCaptureServer(): void {
  server?.close()
}
