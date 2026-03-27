(async function () {
  // Prevent double-injection
  if (window.__demoforgeCapturing) return
  window.__demoforgeCapturing = true

  try {
    // ─── Step 1: Inline all stylesheets on the LIVE DOM ─────────────────
    await inlineAllStylesheets()

    // ─── Step 2: Resolve @import rules inside inlined stylesheets ───────
    await resolveImports()

    // ─── Step 2b: Inline @font-face font files as base64 data URIs ──────
    await inlineFontFaces()

    // ─── Step 3: Capture runtime CSS custom properties ──────────────────
    // CSS-in-JS and theme systems define CSS variables via JavaScript at
    // runtime. These vars live on elements (html, body, :root) but aren't
    // in any stylesheet. We must capture them explicitly.
    const runtimeVarsCSS = captureRuntimeCSSVars()

    // ─── Step 4: Inline all images on the LIVE DOM ──────────────────────
    await inlineImages()

    // ─── Step 5: Inline background images from computed styles ──────────
    await inlineComputedBackgroundImages()

    // ─── Step 6: Clone the DOM after all inlining is complete ───────────
    const clone = document.documentElement.cloneNode(true)

    // ─── Step 7: Inject runtime CSS variables as a <style> tag ──────────
    if (runtimeVarsCSS) {
      const varStyle = clone.ownerDocument.createElement('style')
      varStyle.setAttribute('data-demoforge', 'runtime-vars')
      varStyle.textContent = runtimeVarsCSS
      const head = clone.querySelector('head')
      if (head) head.insertBefore(varStyle, head.firstChild)
    }

    // ─── Step 8: Force structural elements to be visible ────────────────
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

    // ─── Step 9: Clean up non-visual elements ───────────────────────────
    clone.querySelectorAll('style, meta, title, link, base, head').forEach(el => {
      el.removeAttribute('style')
    })

    // ─── Step 10: Remove scripts ────────────────────────────────────────
    clone.querySelectorAll('script').forEach(el => el.remove())

    // ─── Step 11: Remove external iframes (Stripe, analytics, etc.) ────
    clone.querySelectorAll('iframe').forEach(el => {
      const src = el.getAttribute('src') || ''
      if (src.startsWith('http') || src.startsWith('//')) {
        el.remove()
      }
    })

    // ─── Step 12: Remove unused link tags ───────────────────────────────
    clone.querySelectorAll('link[rel="modulepreload"], link[rel="preload"], link[rel="prefetch"], link[rel="preconnect"], link[rel="dns-prefetch"]').forEach(el => el.remove())

    // ─── Step 13: Remove event attrs and form actions ───────────────────
    clone.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
      })
      el.removeAttribute('action')
    })

    // ─── Step 14: Serialize ─────────────────────────────────────────────
    const serializer = new XMLSerializer()
    let htmlString = '<!DOCTYPE html>' + serializer.serializeToString(clone)

    // Strip XHTML namespace attrs for HTML5 rendering
    htmlString = htmlString.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')

    // XMLSerializer HTML-entity-encodes > chars inside <style> text content,
    // turning CSS child selectors (.a > .b) into broken (.a &gt; .b).
    // Decode these entities only inside <style> blocks to fix CSS.
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

    // Inject viewport meta tag with original viewport width so media queries
    // evaluate correctly even when the page is rendered in a scaled iframe.
    const vpMeta = '<meta name="viewport" content="width=' + window.innerWidth + ', initial-scale=1">'
    htmlString = htmlString.replace('</head>', vpMeta + '</head>')

    console.log('[Runthroo] capture ready, HTML size:', htmlString.length, 'bytes')

    // ─── Step 15: Send result back ──────────────────────────────────────
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
          // CSSOM may return HTML-entity-encoded selectors (e.g. &gt; instead of >)
          // This happens when stylesheets are parsed in an XHTML context.
          // We must decode these for the CSS to work correctly.
          cssText = unescapeCSS(cssText)
        }
      } catch (securityErr) {
        if (sheet.href) {
          try {
            const res = await fetch(sheet.href, { credentials: 'include' })
            cssText = await res.text()
            cssText = rebaseCssUrls(cssText, sheet.href)
          } catch (fetchErr) {
            console.warn('[Runthroo] Could not fetch stylesheet:', sheet.href)
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
      console.warn('[Runthroo] stylesheet inline failed:', e)
    }
  }
}

// ─── Unescape HTML entities in CSS text ─────────────────────────────────────
// CSSOM cssRules.cssText can contain HTML-entity-encoded characters
// (e.g. &gt; instead of >) when the stylesheet was parsed in an XHTML/DOM
// context. We must decode these for the CSS to render correctly.
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
      try {
        const res = await fetch(url, { credentials: 'include' })
        let importedCSS = await res.text()
        importedCSS = rebaseCssUrls(importedCSS, url)
        // Replace the @import with the actual CSS content
        newText = newText.replace(match[0], importedCSS)
      } catch (e) {
        // Fetch failed (CORS, CSP, etc.) — leave the @import rule in place
        // so it can load at render time from the iframe.
        // No action needed — newText still contains the original @import.
      }
    }
    styleEl.textContent = newText
  }
}

// ─── Inline @font-face font files as base64 data URIs ──────────────────────
// Icon fonts and custom fonts are loaded via @font-face with url() references.
// In the sandboxed iframe, relative URLs can't resolve, so we must fetch the
// font files and embed them as base64 data URIs.
async function inlineFontFaces() {
  const styleTags = [...document.querySelectorAll('style')]
  for (const styleEl of styleTags) {
    let text = styleEl.textContent || ''
    // Find all @font-face blocks
    const fontFaceBlocks = [...text.matchAll(/@font-face\s*\{[^}]+\}/g)]
    if (fontFaceBlocks.length === 0) continue

    for (const block of fontFaceBlocks) {
      let blockText = block[0]
      let newBlockText = blockText

      // Find all url() references inside this @font-face block
      const urlMatches = [...blockText.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
      for (const urlMatch of urlMatches) {
        let fontUrl = urlMatch[1]
        // Skip data: URIs (already inlined)
        if (fontUrl.startsWith('data:')) continue

        // Resolve relative URLs against the page origin
        try {
          if (fontUrl.startsWith('/')) {
            fontUrl = window.location.origin + fontUrl
          } else if (!fontUrl.startsWith('http')) {
            fontUrl = new URL(fontUrl, window.location.href).href
          }

          // Strip query string for MIME type detection
          const cleanUrl = fontUrl.split('?')[0]
          let mimeType = 'font/woff2'
          if (cleanUrl.endsWith('.woff')) mimeType = 'font/woff'
          else if (cleanUrl.endsWith('.ttf')) mimeType = 'font/ttf'
          else if (cleanUrl.endsWith('.otf')) mimeType = 'font/otf'
          else if (cleanUrl.endsWith('.eot')) mimeType = 'application/vnd.ms-fontobject'

          const res = await fetch(fontUrl, { credentials: 'include' })
          if (!res.ok) continue
          const blob = await res.blob()
          const dataUrl = await blobToDataUrl(blob)
          // Replace original URL with data URI
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
// Returns a CSS string with :root { } and body { } blocks containing all
// runtime-defined custom properties.
function captureRuntimeCSSVars() {
  const blocks = []

  // Capture vars from <html> element
  const htmlStyle = getComputedStyle(document.documentElement)
  const htmlVars = extractCSSVars(htmlStyle)
  if (htmlVars.length > 0) {
    blocks.push(':root {\n' + htmlVars.join(';\n') + ';\n}')
  }

  // Capture vars from <body> element
  if (document.body) {
    const bodyStyle = getComputedStyle(document.body)
    const bodyVars = extractCSSVars(bodyStyle)
    if (bodyVars.length > 0) {
      blocks.push('body {\n' + bodyVars.join(';\n') + ';\n}')
    }
  }

  // Also capture vars from any element with a data-theme attribute
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
  // getComputedStyle contains all properties including custom properties
  // We need to iterate to find --* properties
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
      } catch (e) { /* canvas failed */ }
      try {
        const res = await fetch(img.src, { credentials: 'include' })
        const blob = await res.blob()
        const dataUrl = await blobToDataUrl(blob)
        img.setAttribute('src', dataUrl)
      } catch (e) { /* fetch failed */ }
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
          const res = await fetch(urlMatch[1], { credentials: 'include' })
          const blob = await res.blob()
          const dataUrl = await blobToDataUrl(blob)
          newBgImage = newBgImage.replace(urlMatch[1], dataUrl)
        } catch (e) { /* fetch failed */ }
      }
      if (newBgImage !== bgImage) {
        el.style.backgroundImage = newBgImage
      }
    } catch (e) { /* skip */ }
  }
}
