(async function () {
  // Reset the guard immediately — during multi-step recording, the service worker
  // re-injects this script for each new page. We must allow re-execution.
  window.__demoforgeCapturing = true

  try {
    // ─── Step 1: Inline all stylesheets on the LIVE DOM ─────────────────
    await inlineAllStylesheets()

    // ─── Step 2: Resolve @import rules inside inlined stylesheets ───────
    await resolveImports()

    // ─── Step 2b: Inline @font-face font files as base64 data URIs ──────
    await inlineFontFaces()

    // ─── Step 3: Capture runtime CSS custom properties ──────────────────
    const runtimeVarsCSS = captureRuntimeCSSVars()

    // ─── Step 4: Inline all images on the LIVE DOM ──────────────────────
    await inlineImages()

    // ─── Step 5: Inline background images from computed styles ──────────
    await inlineComputedBackgroundImages()

    // ─── Step 6: Snapshot <canvas> elements (Grafana charts, etc.) ─────
    const canvasSnapshots = snapshotCanvasElements()

    // ─── Step 7: Clone the DOM after all inlining is complete ───────────
    const clone = document.documentElement.cloneNode(true)

    // ─── Step 7b: Replace cloned <canvas> with <img> snapshots ──────────
    replaceCanvasWithImages(clone, canvasSnapshots)

    // Clean up temp markers from the live DOM
    document.querySelectorAll('canvas[data-df-canvas-id]').forEach(c =>
      c.removeAttribute('data-df-canvas-id')
    )

    // ─── Step 8: Inject runtime CSS variables as a <style> tag ──────────
    if (runtimeVarsCSS) {
      const varStyle = clone.ownerDocument.createElement('style')
      varStyle.setAttribute('data-demoforge', 'runtime-vars')
      varStyle.textContent = runtimeVarsCSS
      const head = clone.querySelector('head')
      if (head) head.insertBefore(varStyle, head.firstChild)
    }

    // ─── Step 9: Force structural elements to be visible ────────────────
    const clonedBody = clone.querySelector('body')
    if (clonedBody) {
      const bodyStyle = clonedBody.getAttribute('style') || ''
      if (/display\s*:\s*none/i.test(bodyStyle)) {
        clonedBody.setAttribute('style',
          bodyStyle.replace(/display\s*:\s*none/gi, 'display:block')
        )
      }
      if (!bodyStyle.includes('display')) {
        clonedBody.setAttribute('style', bodyStyle + ';display:block')
      }
    }

    // ─── Step 10: Clean up non-visual elements ──────────────────────────
    clone.querySelectorAll('style, meta, title, link, base, head').forEach(el => {
      el.removeAttribute('style')
    })

    // ─── Step 11: Remove scripts ────────────────────────────────────────
    clone.querySelectorAll('script').forEach(el => el.remove())

    // ─── Step 12: Remove external iframes (Stripe, analytics, etc.) ────
    clone.querySelectorAll('iframe').forEach(el => {
      const src = el.getAttribute('src') || ''
      if (src.startsWith('http') || src.startsWith('//')) {
        el.remove()
      }
    })

    // ─── Step 13: Remove unused link tags ───────────────────────────────
    clone.querySelectorAll('link[rel="modulepreload"], link[rel="preload"], link[rel="prefetch"], link[rel="preconnect"], link[rel="dns-prefetch"]').forEach(el => el.remove())

    // ─── Step 14: Remove event attrs and form actions ───────────────────
    clone.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
      })
      el.removeAttribute('action')
    })

    // ─── Step 15: Serialize ─────────────────────────────────────────────
    const serializer = new XMLSerializer()
    let htmlString = '<!DOCTYPE html>' + serializer.serializeToString(clone)

    // Strip XHTML namespace attrs for HTML5 rendering
    htmlString = htmlString.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')

    // Decode HTML entities inside <style> blocks
    htmlString = htmlString.replace(
      /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (match, open, css, close) => {
        css = css
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
        return open + css + close
      }
    )

    // Inject viewport meta tag
    const vpMeta = '<meta name="viewport" content="width=' + window.innerWidth + ', initial-scale=1">'
    htmlString = htmlString.replace('</head>', vpMeta + '</head>')

    console.log('[Runthroo] capture ready, HTML size:', htmlString.length, 'bytes')

    // ─── Step 16: Send result back ──────────────────────────────────────
    chrome.runtime.sendMessage({
      type: 'CAPTURE_RESULT',
      data: {
        htmlContent: htmlString,
        sourceUrl: window.location.href,
        pageTitle: document.title,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      }
    })
  } catch (err) {
    console.error('[Runthroo] capture failed:', err)
    chrome.runtime.sendMessage({
      type: 'CAPTURE_ERROR',
      error: err.message
    })
  } finally {
    window.__demoforgeCapturing = false
  }
})()

// ═══════════════════════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Fetch with CORS bypass ─────────────────────────────────────────────────
// Content script fetch() shares the page's origin, so cross-origin requests
// are blocked by CORS. We route ALL fetches through the service worker which
// has host_permissions: <all_urls> and bypasses CORS entirely.
async function fetchWithProxy(url, responseType = 'text') {
  // Always try service worker proxy first — it has unrestricted network access
  try {
    if (responseType === 'blob') {
      const swRes = await chrome.runtime.sendMessage({ type: 'FETCH_URL_BASE64', url })
      if (swRes && swRes.ok && swRes.dataUrl) {
        const fetchRes = await fetch(swRes.dataUrl)
        return { ok: true, data: await fetchRes.blob() }
      }
    } else {
      const swRes = await chrome.runtime.sendMessage({ type: 'FETCH_URL', url })
      if (swRes && swRes.ok && swRes.text) {
        return { ok: true, data: swRes.text }
      }
    }
  } catch (e) {
    // Service worker proxy failed
  }

  // Fallback: try direct fetch (works for same-origin or CORS-enabled resources)
  try {
    const res = await fetch(url, { credentials: 'omit' })
    if (res.ok) {
      if (responseType === 'blob') return { ok: true, data: await res.blob() }
      return { ok: true, data: await res.text() }
    }
  } catch (e) {
    // Direct fetch also failed
  }

  return { ok: false, data: null }
}

// ─── Inline all stylesheets using CSSOM ─────────────────────────────────────
async function inlineAllStylesheets() {
  const sheets = [...document.styleSheets]
  for (const sheet of sheets) {
    try {
      let cssText = ''
      try {
        const rules = sheet.cssRules || sheet.rules
        if (rules && rules.length > 0) {
          cssText = [...rules].map(r => r.cssText).join('\n')
          cssText = unescapeCSS(cssText)
        }
      } catch (securityErr) {
        // Cross-origin stylesheet — CSSOM blocked. Fetch the CSS text instead.
        if (sheet.href) {
          const result = await fetchWithProxy(sheet.href)
          if (result.ok && result.data) {
            cssText = rebaseCssUrls(result.data, sheet.href)
          } else {
            // Not fetchable — skip silently (console.debug won't show on error page)
            console.debug('[Runthroo] skipped unfetchable stylesheet:', sheet.href)
            continue
          }
        }
      }

      if (cssText && sheet.ownerNode && sheet.ownerNode.parentNode) {
        const style = document.createElement('style')
        style.textContent = cssText
        if (sheet.ownerNode.dataset) {
          Object.keys(sheet.ownerNode.dataset).forEach(key => {
            style.dataset[key] = sheet.ownerNode.dataset[key]
          })
        }
        sheet.ownerNode.parentNode.replaceChild(style, sheet.ownerNode)
      }
    } catch (e) {
      console.debug('[Runthroo] stylesheet inline skipped:', e)
    }
  }
}

// ─── Unescape HTML entities in CSS text ─────────────────────────────────────
function unescapeCSS(cssText) {
  return cssText
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
}

// ─── Resolve @import rules by fetching their content ────────────────────────
async function resolveImports() {
  const styleTags = [...document.querySelectorAll('style')]
  for (const styleEl of styleTags) {
    const text = styleEl.textContent || ''
    const importMatches = [...text.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)\s*;?/g)]
    if (importMatches.length === 0) continue

    let newText = text
    for (const match of importMatches) {
      const url = match[1]
      const result = await fetchWithProxy(url)
      if (result.ok) {
        let importedCSS = rebaseCssUrls(result.data, url)
        newText = newText.replace(match[0], importedCSS)
      }
    }
    styleEl.textContent = newText
  }
}

// ─── Inline @font-face font files as base64 data URIs ──────────────────────
async function inlineFontFaces() {
  const styleTags = [...document.querySelectorAll('style')]
  for (const styleEl of styleTags) {
    let text = styleEl.textContent || ''
    const fontFaceBlocks = [...text.matchAll(/@font-face\s*\{[^}]+\}/g)]
    if (fontFaceBlocks.length === 0) continue

    for (const block of fontFaceBlocks) {
      let blockText = block[0]
      let newBlockText = blockText

      const urlMatches = [...blockText.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
      for (const urlMatch of urlMatches) {
        let fontUrl = urlMatch[1]
        if (fontUrl.startsWith('data:')) continue

        try {
          if (fontUrl.startsWith('/')) {
            fontUrl = window.location.origin + fontUrl
          } else if (!fontUrl.startsWith('http')) {
            fontUrl = new URL(fontUrl, window.location.href).href
          }

          const result = await fetchWithProxy(fontUrl, 'blob')
          if (!result.ok) continue
          const dataUrl = await blobToDataUrl(result.data)
          newBlockText = newBlockText.replace(urlMatch[0], 'url("' + dataUrl + '")')
        } catch (e) {
          // Could not fetch font — leave original URL in place
        }
      }

      if (newBlockText !== blockText) {
        text = text.replace(blockText, newBlockText)
      }
    }
    styleEl.textContent = text
  }
}

// ─── Capture CSS custom properties set on root elements by JavaScript ───────
function captureRuntimeCSSVars() {
  const blocks = []

  const htmlStyle = getComputedStyle(document.documentElement)
  const htmlVars = extractCSSVars(htmlStyle)
  if (htmlVars.length > 0) {
    blocks.push(':root {\n' + htmlVars.join(';\n') + ';\n}')
  }

  if (document.body) {
    const bodyStyle = getComputedStyle(document.body)
    const bodyVars = extractCSSVars(bodyStyle)
    if (bodyVars.length > 0) {
      blocks.push('body {\n' + bodyVars.join(';\n') + ';\n}')
    }
  }

  document.querySelectorAll('[data-theme]').forEach(el => {
    if (el === document.documentElement || el === document.body) return
    const style = getComputedStyle(el)
    const vars = extractCSSVars(style)
    if (vars.length > 0) {
      const selector = el.tagName.toLowerCase() + '[data-theme="' + el.getAttribute('data-theme') + '"]'
      blocks.push(selector + ' {\n' + vars.join(';\n') + ';\n}')
    }
  })

  return blocks.join('\n\n')
}

function extractCSSVars(computedStyle) {
  const vars = []
  for (let i = 0; i < computedStyle.length; i++) {
    const prop = computedStyle[i]
    if (prop.startsWith('--')) {
      const value = computedStyle.getPropertyValue(prop).trim()
      if (value) {
        vars.push('  ' + prop + ': ' + value)
      }
    }
  }
  return vars
}

// ─── Rebase relative url() references ───────────────────────────────────────
function rebaseCssUrls(cssText, baseUrl) {
  return cssText.replace(
    /url\(\s*['"]?(?!data:|https?:|\/\/)([^'"\s)]+)['"]?\s*\)/g,
    (match, relPath) => {
      try {
        return `url("${new URL(relPath, baseUrl).href}")`
      } catch {
        return match
      }
    }
  )
}

// ─── Inline <img> elements as base64 data URIs ─────────────────────────────
async function inlineImages() {
  const imgs = [...document.querySelectorAll('img[src]')]
    .filter(img => !img.src.startsWith('data:'))

  const batchSize = 10
  for (let i = 0; i < imgs.length; i += batchSize) {
    const batch = imgs.slice(i, i + batchSize)
    await Promise.all(batch.map(async (img) => {
      try {
        const dataUrl = await imageToDataUrl(img)
        if (dataUrl) { img.setAttribute('src', dataUrl); return }
      } catch (e) { /* canvas tainted */ }
      try {
        const result = await fetchWithProxy(img.src, 'blob')
        if (result.ok) {
          const dataUrl = await blobToDataUrl(result.data)
          img.setAttribute('src', dataUrl)
        }
      } catch (e) { /* failed */ }
    }))
  }
}

function imageToDataUrl(img) {
  return new Promise((resolve) => {
    try {
      if (!img.naturalWidth || !img.naturalHeight) { resolve(null); return }
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    } catch (e) { resolve(null) }
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// ─── Inline computed background images ──────────────────────────────────────
async function inlineComputedBackgroundImages() {
  const allEls = [...document.querySelectorAll('*')]
  for (const el of allEls) {
    try {
      const computed = getComputedStyle(el)
      const bgImage = computed.backgroundImage
      if (!bgImage || bgImage === 'none') continue

      const urlMatches = bgImage.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/g)
      if (!urlMatches) continue

      let newBgImage = bgImage
      for (const match of urlMatches) {
        const urlMatch = match.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/)
        if (!urlMatch || !urlMatch[1]) continue
        try {
          const result = await fetchWithProxy(urlMatch[1], 'blob')
          if (result.ok) {
            const dataUrl = await blobToDataUrl(result.data)
            newBgImage = newBgImage.replace(urlMatch[1], dataUrl)
          }
        } catch (e) { /* failed */ }
      }
      if (newBgImage !== bgImage) {
        el.style.backgroundImage = newBgImage
      }
    } catch (e) { /* skip */ }
  }
}

// ─── Snapshot <canvas> elements to data URLs ────────────────────────────────
// Called BEFORE cloning so we can read the live canvas pixels AND computed styles.
function snapshotCanvasElements() {
  const snapshots = []
  const canvases = [...document.querySelectorAll('canvas')]
  let idx = 0

  for (const canvas of canvases) {
    try {
      // Skip zero-size canvases
      if (!canvas.width || !canvas.height) continue
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue

      const id = '__df_canvas_' + (idx++)
      canvas.setAttribute('data-df-canvas-id', id)

      // toDataURL may throw if the canvas is tainted (cross-origin drawn content)
      let dataUrl
      try {
        dataUrl = canvas.toDataURL('image/png')
      } catch (taintErr) {
        console.debug('[Runthroo] canvas tainted, skipping:', taintErr.message)
        continue
      }

      // Skip blank canvases (all transparent)
      if (dataUrl.length < 200) continue

      // Capture the COMPUTED styles so we can precisely replicate the layout.
      // canvas.width/height = pixel buffer (2x on Retina), but rect = CSS pixels.
      const computed = getComputedStyle(canvas)
      snapshots.push({
        id,
        dataUrl,
        // CSS display size (what the user actually sees) — NOT the buffer size
        cssWidth: rect.width,
        cssHeight: rect.height,
        // Positioning — critical for Grafana's absolutely-positioned canvases
        position: computed.position,
        top: computed.top,
        left: computed.left,
        right: computed.right,
        bottom: computed.bottom,
        zIndex: computed.zIndex,
        display: computed.display,
        // Original inline style for fallback
        inlineStyle: canvas.getAttribute('style') || '',
      })
    } catch (e) {
      console.debug('[Runthroo] canvas snapshot skipped:', e)
    }
  }

  console.log('[Runthroo] snapshotted', snapshots.length, 'canvas elements')
  return snapshots
}

// ─── Replace cloned <canvas> with <img> snapshots ───────────────────────────
// Called AFTER cloning. Swaps canvas nodes with pixel-perfect <img> elements
// that preserve the exact visual size and positioning.
function replaceCanvasWithImages(clone, snapshots) {
  for (const snap of snapshots) {
    const canvasEl = clone.querySelector('canvas[data-df-canvas-id="' + snap.id + '"]')
    if (!canvasEl) continue

    const img = clone.ownerDocument
      ? clone.ownerDocument.createElement('img')
      : document.createElement('img')

    img.setAttribute('src', snap.dataUrl)
    img.setAttribute('data-df-from-canvas', 'true')

    // Preserve the className for CSS rule matching
    if (canvasEl.className) img.className = canvasEl.className

    // Build a precise style string from computed values.
    // Use CSS pixel dimensions (not the 2x buffer) to prevent overflow.
    const parts = []

    // Exact CSS dimensions — this is the key fix for the stretching/overflow
    parts.push('width: ' + snap.cssWidth + 'px')
    parts.push('height: ' + snap.cssHeight + 'px')

    // Preserve positioning so the image doesn't push text/legends around
    if (snap.position && snap.position !== 'static') {
      parts.push('position: ' + snap.position)
      if (snap.top && snap.top !== 'auto') parts.push('top: ' + snap.top)
      if (snap.left && snap.left !== 'auto') parts.push('left: ' + snap.left)
      if (snap.right && snap.right !== 'auto') parts.push('right: ' + snap.right)
      if (snap.bottom && snap.bottom !== 'auto') parts.push('bottom: ' + snap.bottom)
    }

    if (snap.zIndex && snap.zIndex !== 'auto') {
      parts.push('z-index: ' + snap.zIndex)
    }

    // Preserve original display value (don't force display:block)
    if (snap.display) {
      parts.push('display: ' + snap.display)
    }

    img.setAttribute('style', parts.join('; '))

    // Copy data attributes (except our temp ID)
    Array.from(canvasEl.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') && attr.name !== 'data-df-canvas-id') {
        img.setAttribute(attr.name, attr.value)
      }
    })

    canvasEl.parentNode.replaceChild(img, canvasEl)
  }

  // Clean up any remaining canvas ID flags
  clone.querySelectorAll('canvas[data-df-canvas-id]').forEach(c => {
    c.removeAttribute('data-df-canvas-id')
  })
}
