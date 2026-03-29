import * as http from 'http'
import { v4 as uuidv4 } from 'uuid'
import { dbInsertCapture, dbGetCapture, dbInsertDemo, dbInsertStep } from './database'
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

interface BatchCapturePayload {
  demoName: string
  platform: string
  captures: CapturePayload[]
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

    // ── Batch capture: multiple pages → auto-create demo ──
    if (req.method === 'POST' && req.url === '/api/captures/batch') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', async () => {
        try {
          const batch = JSON.parse(body) as BatchCapturePayload
          if (!batch.captures || batch.captures.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'No captures in batch' }))
            return
          }

          console.log(`[Runthroo] Batch capture: ${batch.captures.length} pages`)

          // Create demo
          const demoId = uuidv4()
          dbInsertDemo(demoId, batch.demoName || 'Recorded Demo', batch.platform || '')

          // Process each capture
          const captureIds: string[] = []
          for (let i = 0; i < batch.captures.length; i++) {
            const payload = batch.captures[i]
            if (!payload.htmlContent) continue

            const captureId = uuidv4()
            const now = new Date().toISOString()
            const filePath = writeCaptureFile(captureId, payload.htmlContent)
            const byteSize = Buffer.byteLength(payload.htmlContent, 'utf-8')

            const capture: Omit<Capture, 'createdAt'> = {
              id: captureId,
              platform: payload.platform || batch.platform || 'unknown',
              pageLabel: payload.pageTitle || `Step ${i + 1}`,
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
            captureIds.push(captureId)

            // Add step to demo
            const stepId = uuidv4()
            dbInsertStep({
              id: stepId,
              demoId,
              captureId,
              stepOrder: i,
              label: payload.pageTitle || `Step ${i + 1}`,
              clickZone: null,
              cursorConfig: null,
              transition: 'fade',
            })

            // Fire capture event for each
            const fullCapture: Capture = { ...capture, createdAt: now }
            onCapture(fullCapture)

            // Generate thumbnail async
            generateThumbnail(captureId, filePath).then(thumbnailPath => {
              if (thumbnailPath) onThumbnailReady(captureId, thumbnailPath)
            }).catch(() => { })
          }

          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ demoId, captureCount: captureIds.length, message: 'Batch captured and demo created' }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
      return
    }

    // ── Create demo from existing capture IDs ──
    if (req.method === 'POST' && req.url === '/api/demos/from-captures') {
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', async () => {
        try {
          const { demoName, captureIds } = JSON.parse(body) as { demoName: string; captureIds: string[] }
          if (!captureIds || captureIds.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'No capture IDs provided' }))
            return
          }

          console.log(`[Runthroo] Creating demo from ${captureIds.length} existing captures`)

          const demoId = uuidv4()
          dbInsertDemo(demoId, demoName || 'Recorded Demo', '')

          let addedCount = 0
          for (let i = 0; i < captureIds.length; i++) {
            // Verify the capture exists
            const capture = dbGetCapture(captureIds[i])
            if (!capture) {
              console.warn(`[Runthroo] Capture ${captureIds[i]} not found — skipping`)
              continue
            }

            const stepId = uuidv4()
            dbInsertStep({
              id: stepId,
              demoId,
              captureId: captureIds[i],
              stepOrder: addedCount,
              label: capture.pageLabel || `Step ${addedCount + 1}`,
              clickZone: null,
              cursorConfig: null,
              transition: 'fade',
            })
            addedCount++
          }

          if (addedCount === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'None of the capture IDs were valid' }))
            return
          }

          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ demoId, stepCount: addedCount, message: 'Demo created from captures' }))
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
