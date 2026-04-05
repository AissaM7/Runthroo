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

    // ─── Step 3b: Capture color-scheme for dark mode fidelity ──────────
    const colorSchemeCSS = captureColorScheme()

    // ─── Step 3c: Tag elements & capture computed backgrounds ──────────
    // This ensures that background colors applied by JS frameworks,
    // CSS-in-JS, or class-based styles survive serialization even if
    // the corresponding CSS rules are lost during CSSOM extraction.
    const computedVisuals = captureComputedVisuals()

    // ─── Step 3d: Analyze scroll containers for background harmonization ─
    const scrollContainerFixes = analyzeScrollContainerBackgrounds()

    // ─── Step 4: Inline all images on the LIVE DOM ──────────────────────
    await inlineImages()

    // ─── Step 5: Inline background images from computed styles ──────────
    await inlineComputedBackgroundImages()

    // ─── Step 6: Snapshot <canvas> elements (Grafana charts, etc.) ─────
    const canvasSnapshots = snapshotCanvasElements()

    // ─── Step 6b: Neutralize virtualized list spacers ───────────────────
    // React-virtualized / TanStack Virtual insert massive spacer rows
    // (e.g. height: 29225px) that push visible rows out of view in a
    // static capture. Collapse them and unlock fixed-height containers.
    const virtualCleanup = neutralizeVirtualizedLists()

    // ─── Step 7: Clone the DOM after all inlining is complete ───────────
    const clone = document.documentElement.cloneNode(true)

    // ─── Step 7b: Replace cloned <canvas> with <img> snapshots ──────────
    replaceCanvasWithImages(clone, canvasSnapshots)

    // ─── Step 7c: Apply captured computed visuals to clone ──────────────
    applyComputedVisuals(clone, computedVisuals)

    // ─── Step 7d: Harmonize scroll container & page backgrounds ─────────
    // Many apps (Embrace, Grafana, etc.) have transparent scroll containers
    // with colored content panels inside. When the Runthroo viewer allows
    // scrolling past the content, the page background (often near-black)
    // bleeds through, creating a visible color division. This step:
    //   1. Fills transparent scroll containers with their content's bg
    //   2. Sets html/body to the dominant content background as a fallback
    applyScrollContainerFixes(clone, scrollContainerFixes)

    // ─── Step 7e: Clean up data-df-idx markers from the clone ───────────
    clone.querySelectorAll('[data-df-idx]').forEach(el =>
      el.removeAttribute('data-df-idx')
    )

    // Clean up temp markers from the live DOM
    document.querySelectorAll('canvas[data-df-canvas-id]').forEach(c =>
      c.removeAttribute('data-df-canvas-id')
    )
    document.querySelectorAll('[data-df-idx]').forEach(el =>
      el.removeAttribute('data-df-idx')
    )
    document.querySelectorAll('[data-df-scroll-idx]').forEach(el =>
      el.removeAttribute('data-df-scroll-idx')
    )

    // Restore the live DOM after cloning (undo virtualisation fixes)
    virtualCleanup()

    // ─── Step 8: Inject runtime CSS variables as a <style> tag ──────────
    if (runtimeVarsCSS) {
      const varStyle = clone.ownerDocument.createElement('style')
      varStyle.setAttribute('data-demoforge', 'runtime-vars')
      varStyle.textContent = runtimeVarsCSS
      const head = clone.querySelector('head')
      if (head) head.insertBefore(varStyle, head.firstChild)
    }

    // ─── Step 8b: Inject color-scheme CSS ───────────────────────────────
    if (colorSchemeCSS) {
      const csStyle = clone.ownerDocument.createElement('style')
      csStyle.setAttribute('data-demoforge', 'color-scheme')
      csStyle.textContent = colorSchemeCSS
      const head = clone.querySelector('head')
      if (head) head.insertBefore(csStyle, head.firstChild)
    }

    // ─── Step 8c: Inject viewport width lock ────────────────────────────
    {
      const vwStyle = clone.ownerDocument.createElement('style')
      vwStyle.setAttribute('data-demoforge', 'viewport-lock')
      vwStyle.textContent =
        'html { width: ' + window.innerWidth + 'px; ' +
        'min-width: ' + window.innerWidth + 'px; ' +
        'max-width: ' + window.innerWidth + 'px; ' +
        'overflow-x: hidden; }\n' +
        'body { width: 100%; max-width: ' + window.innerWidth + 'px; ' +
        'overflow-x: hidden; }'
      const head = clone.querySelector('head')
      if (head) head.appendChild(vwStyle)
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

    // Inject color-scheme meta tag to match the original page
    const computedCS = getComputedStyle(document.documentElement).colorScheme
    const metaCS = document.querySelector('meta[name="color-scheme"]')
    const csValue = (metaCS && metaCS.content) || computedCS || ''
    if (csValue && csValue !== 'normal') {
      const csMeta = '<meta name="color-scheme" content="' + csValue + '">'
      htmlString = htmlString.replace('</head>', csMeta + '</head>')
    }

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

  // Capture CSS variables from [data-theme] elements
  document.querySelectorAll('[data-theme]').forEach(el => {
    if (el === document.documentElement || el === document.body) return
    const style = getComputedStyle(el)
    const vars = extractCSSVars(style)
    if (vars.length > 0) {
      const selector = el.tagName.toLowerCase() + '[data-theme="' + el.getAttribute('data-theme') + '"]'
      blocks.push(selector + ' {\n' + vars.join(';\n') + ';\n}')
    }
  })

  // Also capture CSS variables from elements with data-color-mode, data-color-scheme,
  // class-based themes (e.g., .theme-dark, .dark-theme), and Grafana's theme containers
  const themeSelectors = [
    '[data-color-mode]',
    '[data-color-scheme]',
    '[data-grafana-theme]',
    '.theme-dark', '.theme-light',
    '[class*="theme-"]',
    '[data-mode]',
  ]
  const themeQuery = themeSelectors.join(', ')
  try {
    document.querySelectorAll(themeQuery).forEach(el => {
      if (el === document.documentElement || el === document.body) return
      const style = getComputedStyle(el)
      const vars = extractCSSVars(style)
      if (vars.length > 0) {
        // Build a unique selector for this element
        let selector = el.tagName.toLowerCase()
        if (el.id) {
          selector = '#' + el.id
        } else if (el.className && typeof el.className === 'string') {
          selector += '.' + el.className.trim().split(/\s+/).join('.')
        }
        blocks.push(selector + ' {\n' + vars.join(';\n') + ';\n}')
      }
    })
  } catch (e) {
    // Selector might fail on some pages — not critical
  }

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

// ─── Capture color-scheme for dark mode fidelity ───────────────────────────
// Many modern UIs (Embrace, Grafana, etc.) use `color-scheme: dark` which
// tells the browser to render scrollbars, form controls, and default
// backgrounds in dark mode. Without preserving this, captures render with
// light-mode defaults, causing subtle but visible color shifts.
function captureColorScheme() {
  const blocks = []

  // Check <html> element
  const htmlCS = getComputedStyle(document.documentElement).colorScheme
  if (htmlCS && htmlCS !== 'normal') {
    blocks.push(':root { color-scheme: ' + htmlCS + '; }')
  }

  // Check <body>
  if (document.body) {
    const bodyCS = getComputedStyle(document.body).colorScheme
    if (bodyCS && bodyCS !== 'normal' && bodyCS !== htmlCS) {
      blocks.push('body { color-scheme: ' + bodyCS + '; }')
    }
  }

  return blocks.length > 0 ? blocks.join('\n') : ''
}

// ─── Capture computed visual properties on all visible elements ────────────
// This is the key fix for the "bottom half turns black" and color accuracy
// issues. CSS-in-JS frameworks, class-based themes, and CSSOM serialization
// artifacts can cause background colors to be lost during capture. By
// reading the LIVE computed styles and baking them into the clone, we
// guarantee pixel-perfect color fidelity regardless of stylesheet issues.
function captureComputedVisuals() {
  const visuals = []
  const allEls = document.querySelectorAll('*')
  let idx = 0

  for (const el of allEls) {
    try {
      const computed = getComputedStyle(el)
      const bg = computed.backgroundColor
      const bgImage = computed.backgroundImage

      // Skip fully transparent backgrounds (nothing to preserve)
      const isTransparent = !bg || bg === 'transparent' ||
        bg === 'rgba(0, 0, 0, 0)' || bg === 'hsla(0, 0%, 0%, 0)'
      const hasBgImage = bgImage && bgImage !== 'none'

      if (isTransparent && !hasBgImage) continue

      // Tag the element so we can find its clone counterpart
      const id = '__df_vis_' + (idx++)
      el.setAttribute('data-df-idx', id)

      const entry = { id }

      if (!isTransparent) {
        entry.backgroundColor = bg
      }
      if (hasBgImage && !bgImage.startsWith('url("data:')) {
        // Only capture non-data-url backgrounds (data URLs are already inline)
        entry.backgroundImage = bgImage
      }

      // Also capture background-related properties for completeness
      const bgSize = computed.backgroundSize
      const bgPos = computed.backgroundPosition
      const bgRepeat = computed.backgroundRepeat
      if (bgSize && bgSize !== 'auto') entry.backgroundSize = bgSize
      if (bgPos && bgPos !== '0% 0%') entry.backgroundPosition = bgPos
      if (bgRepeat && bgRepeat !== 'repeat') entry.backgroundRepeat = bgRepeat

      // ── Color-accuracy properties ──────────────────────────────────
      // Foreground (text) color — CSS-in-JS / class-based themes set this
      // dynamically and it can be lost during serialization.
      const fg = computed.color
      if (fg) entry.color = fg

      // Opacity — if set via a CSS class that gets lost in serialization,
      // the element becomes fully opaque, shifting perceived brightness.
      const opacity = computed.opacity
      if (opacity && opacity !== '1') entry.opacity = opacity

      // Filter — brightness()/contrast()/etc. applied by JS frameworks;
      // losing these makes dark themes appear lighter.
      const filter = computed.filter
      if (filter && filter !== 'none') entry.filter = filter

      // Per-element color-scheme — frameworks like Grafana may set
      // color-scheme on containers, not just :root.
      const elCS = computed.colorScheme
      if (elCS && elCS !== 'normal') entry.colorScheme = elCS

      visuals.push(entry)
    } catch (e) {
      // Skip elements that can't be computed (e.g., disconnected nodes)
    }
  }

  console.log('[Runthroo] captured computed visuals for', visuals.length, 'elements')
  return visuals
}

// ─── Apply captured computed visuals to the cloned DOM ─────────────────────
function applyComputedVisuals(clone, visuals) {
  for (const entry of visuals) {
    const el = clone.querySelector('[data-df-idx="' + entry.id + '"]')
    if (!el) continue

    // Read existing inline style to avoid overwriting explicit styles
    const existing = el.getAttribute('style') || ''

    const parts = []

    // Only set background-color if not already explicitly set inline
    if (entry.backgroundColor && !existing.includes('background-color')) {
      parts.push('background-color: ' + entry.backgroundColor)
    }

    // Only set background-image if not already explicitly set inline
    if (entry.backgroundImage && !existing.includes('background-image')) {
      parts.push('background-image: ' + entry.backgroundImage)
    }

    if (entry.backgroundSize && !existing.includes('background-size')) {
      parts.push('background-size: ' + entry.backgroundSize)
    }
    if (entry.backgroundPosition && !existing.includes('background-position')) {
      parts.push('background-position: ' + entry.backgroundPosition)
    }
    if (entry.backgroundRepeat && !existing.includes('background-repeat')) {
      parts.push('background-repeat: ' + entry.backgroundRepeat)
    }

    // ── Color-accuracy properties ──────────────────────────────────
    if (entry.color && !existing.includes('color:') && !existing.includes('color :')) {
      parts.push('color: ' + entry.color)
    }
    if (entry.opacity && !existing.includes('opacity')) {
      parts.push('opacity: ' + entry.opacity)
    }
    if (entry.filter && !existing.includes('filter')) {
      parts.push('filter: ' + entry.filter)
    }
    if (entry.colorScheme && !existing.includes('color-scheme')) {
      parts.push('color-scheme: ' + entry.colorScheme)
    }

    if (parts.length > 0) {
      const newStyle = existing
        ? existing.replace(/;?\s*$/, '; ') + parts.join('; ')
        : parts.join('; ')
      el.setAttribute('style', newStyle)
    }
  }
}

// ─── Analyze scroll containers on the LIVE DOM ────────────────────────────
// Reads computed styles from the live DOM before cloning. Identifies scroll
// containers with transparent backgrounds and finds the dominant background
// color of their visible content children. Also determines a page-level
// fallback background by sampling the most common content background color.
function analyzeScrollContainerBackgrounds() {
  const fixes = {
    containers: [],     // { idx, bgColor } — scroll containers to fill
    pageBg: '',         // dominant content background for html/body fallback
  }

  // Helper: is a color effectively transparent?
  function isTransparent(c) {
    return !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'hsla(0, 0%, 0%, 0)'
  }

  // Collect background colors from CONTENT elements (excluding html/body)
  // to find the dominant content background for page-level fallback
  const bgColorCounts = {}

  // Find all scroll containers
  const allEls = document.querySelectorAll('*')
  let idx = 0

  for (const el of allEls) {
    try {
      const cs = getComputedStyle(el)
      const ovY = cs.overflowY
      const bg = cs.backgroundColor

      // Count non-transparent backgrounds for page-level fallback,
      // EXCLUDING html and body (those are what we want to override)
      if (!isTransparent(bg) &&
          el !== document.documentElement && el !== document.body) {
        const rect = el.getBoundingClientRect()
        // Only count elements visible in the viewport with meaningful size
        if (rect.width > 50 && rect.height > 50 &&
            rect.top < window.innerHeight && rect.bottom > 0 &&
            rect.left < window.innerWidth && rect.right > 0) {
          const area = Math.min(rect.width, window.innerWidth) *
                       Math.min(rect.height, window.innerHeight)
          bgColorCounts[bg] = (bgColorCounts[bg] || 0) + area
        }
      }

      // Is this a scroll container?
      if (ovY !== 'auto' && ovY !== 'scroll') continue
      if (el.scrollHeight <= el.clientHeight + 10) continue // not actually scrollable

      // Is the scroll container's background transparent?
      if (!isTransparent(bg)) continue

      // Search up to 5 levels deep within the scroll container to find
      // the dominant content background. Many apps (Embrace, Grafana) have
      // several layers of transparent wrappers before reaching colored content.
      let contentBg = ''
      let maxContentArea = 0
      const contentColorCounts = {}

      function searchDescendants(parent, depth) {
        if (depth > 5) return
        for (const child of parent.children) {
          try {
            const childCs = getComputedStyle(child)
            const childColor = childCs.backgroundColor
            if (!isTransparent(childColor)) {
              const childRect = child.getBoundingClientRect()
              if (childRect.width > 30 && childRect.height > 30) {
                const area = childRect.width * childRect.height
                contentColorCounts[childColor] =
                  (contentColorCounts[childColor] || 0) + area
              }
            }
            // Keep searching deeper even if this element has a background
            searchDescendants(child, depth + 1)
          } catch (e) { /* skip */ }
        }
      }

      searchDescendants(el, 0)

      // Pick the color with the most total area within this scroll container
      for (const [color, area] of Object.entries(contentColorCounts)) {
        if (area > maxContentArea) {
          maxContentArea = area
          contentBg = color
        }
      }

      if (contentBg) {
        const id = '__df_scroll_' + (idx++)
        el.setAttribute('data-df-scroll-idx', id)
        fixes.containers.push({ id, bgColor: contentBg })
      }
    } catch (e) { /* skip */ }
  }

  // Determine the dominant CONTENT background (most area-weighted color,
  // excluding html/body backgrounds)
  let maxArea = 0
  for (const [color, area] of Object.entries(bgColorCounts)) {
    if (area > maxArea) {
      maxArea = area
      fixes.pageBg = color
    }
  }

  console.log('[Runthroo] scroll container analysis:',
    fixes.containers.length, 'transparent containers found,',
    'page bg:', fixes.pageBg)

  return fixes
}

// ─── Apply scroll container fixes to the cloned DOM ───────────────────────
function applyScrollContainerFixes(clone, fixes) {
  // 1. Fill transparent scroll containers with their content's background
  for (const { id, bgColor } of fixes.containers) {
    const el = clone.querySelector('[data-df-scroll-idx="' + id + '"]')
    if (!el) continue

    const existing = el.getAttribute('style') || ''
    if (!existing.includes('background-color') && !existing.includes('background:')) {
      const newStyle = existing
        ? existing.replace(/;?\s*$/, '; ') + 'background-color: ' + bgColor
        : 'background-color: ' + bgColor
      el.setAttribute('style', newStyle)
    }
    el.removeAttribute('data-df-scroll-idx')
  }

  // Also walk UP from each scroll container and fill any transparent
  // ancestors between the scroll container and the html/body. This prevents
  // the html background from bleeding through intermediate transparent divs.

  // 2. Set page-level background ONLY on transparent html/body/ancestors.
  //    Do NOT override existing non-transparent backgrounds — the original
  //    page may intentionally use different shades (e.g. near-black html vs
  //    slightly lighter content panels) and overriding them homogenises the
  //    colors, making the capture appear washed-out / lighter.
  if (fixes.pageBg) {
    function isTransparentBg(el) {
      const style = el.getAttribute('style') || ''
      // If there's an explicit background-color or background shorthand,
      // the element already has a color — leave it alone.
      if (style.includes('background-color') || style.includes('background:')) {
        return false
      }
      return true
    }

    // Helper: set background-color only if the element has none
    function setBgIfTransparent(el, color) {
      if (!isTransparentBg(el)) return
      let style = el.getAttribute('style') || ''
      style = style
        ? style.replace(/;?\s*$/, '; ') + 'background-color: ' + color
        : 'background-color: ' + color
      el.setAttribute('style', style)
    }

    // Apply to <html> only if it has no explicit background
    setBgIfTransparent(clone, fixes.pageBg)

    // Apply to <body> only if it has no explicit background
    const body = clone.querySelector('body')
    if (body) setBgIfTransparent(body, fixes.pageBg)

    // Fill intermediate transparent ancestors between scroll containers and body
    for (const { id } of fixes.containers) {
      const el = clone.querySelector('[data-df-scroll-idx="' + id + '"]')
      if (!el) continue

      let parent = el.parentElement
      while (parent && parent !== clone && parent.tagName !== 'BODY') {
        setBgIfTransparent(parent, fixes.pageBg)
        parent = parent.parentElement
      }
    }
  }

  // Clean up remaining markers
  clone.querySelectorAll('[data-df-scroll-idx]').forEach(el =>
    el.removeAttribute('data-df-scroll-idx')
  )
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

// ─── Neutralize virtualized list spacers ──────────────────────────────────────
// React-virtualized, TanStack Virtual, and similar libraries only render a
// small window of rows. They insert spacer elements with enormous heights
// (e.g. 29,000px) to keep the scrollbar accurate. In a static capture the
// scroll position resets to 0, so the actual data rows are pushed far below
// the visible area. This function:
//   1. Collapses spacer rows/divs (height → 0)
//   2. Unlocks fixed-height scroll containers (height → auto, overflow → visible)
// It returns a cleanup function that restores the original styles on the live DOM.
function neutralizeVirtualizedLists() {
  const SPACER_HEIGHT_THRESHOLD = 1000  // px – anything above this is a spacer
  const restoreList = []

  // ── 1. Collapse spacer <tr> rows ──────────────────────────────────────────
  // Pattern: <tr><td style="height: 29225px;"></td></tr>  (top/bottom spacer)
  // Also:    <tr style="height: 8131px;"><td colspan="5"></td></tr>
  document.querySelectorAll('tr').forEach(tr => {
    // Check inline height on the <tr> itself
    const trHeight = parseFloat(tr.style.height)
    if (trHeight > SPACER_HEIGHT_THRESHOLD) {
      const cells = tr.querySelectorAll('td, th')
      const isEmpty = [...cells].every(td => td.textContent.trim() === '' && td.children.length === 0)
      if (isEmpty || cells.length <= 1) {
        restoreList.push({ el: tr, prop: 'height', original: tr.style.height })
        tr.style.height = '0px'
        // Also collapse child tds
        cells.forEach(td => {
          if (parseFloat(td.style.height) > SPACER_HEIGHT_THRESHOLD) {
            restoreList.push({ el: td, prop: 'height', original: td.style.height })
            td.style.height = '0px'
          }
        })
        return
      }
    }

    // Check inline height on child <td> (single-cell spacer row)
    const tds = tr.querySelectorAll('td')
    if (tds.length === 1 && tds[0].textContent.trim() === '' && tds[0].children.length === 0) {
      const tdHeight = parseFloat(tds[0].style.height)
      if (tdHeight > SPACER_HEIGHT_THRESHOLD) {
        restoreList.push({ el: tds[0], prop: 'height', original: tds[0].style.height })
        tds[0].style.height = '0px'
      }
    }
  })

  // ── 2. Collapse spacer <div> elements (react-window / react-virtualized) ──
  // Pattern: <div style="height: 29225px;"></div>  (empty div spacer)
  document.querySelectorAll('div').forEach(div => {
    const h = parseFloat(div.style.height)
    if (h > SPACER_HEIGHT_THRESHOLD && div.textContent.trim() === '' && div.children.length === 0) {
      restoreList.push({ el: div, prop: 'height', original: div.style.height })
      div.style.height = '0px'
    }
  })

  // ── 3. Unlock fixed-height scroll containers ─────────────────────────────
  // If a container has overflow-y:auto/scroll AND an inline height AND it
  // contains data rows, switch it to height:auto + overflow:visible so all
  // rows are visible without scrolling.
  document.querySelectorAll('[style]').forEach(el => {
    const computed = getComputedStyle(el)
    const overflowY = computed.overflowY
    if (overflowY !== 'auto' && overflowY !== 'scroll') return

    const inlineHeight = el.style.height
    if (!inlineHeight) return
    const h = parseFloat(inlineHeight)
    if (!h || h < 100) return  // skip tiny containers

    // Only unlock if the container has content children (real data rows)
    const hasContent = el.querySelector('tr[data-index], [data-row-index], [role="row"]')
    if (!hasContent) return

    restoreList.push({ el, prop: 'height', original: el.style.height })
    restoreList.push({ el, prop: 'overflowY', original: el.style.overflowY })
    restoreList.push({ el, prop: 'maxHeight', original: el.style.maxHeight })
    el.style.height = 'auto'
    el.style.overflowY = 'visible'
    el.style.maxHeight = 'none'
  })

  console.log('[Runthroo] neutralized', restoreList.length, 'virtualized list elements')

  // Return a cleanup function to restore the live DOM
  return function restoreVirtualizedLists() {
    for (const entry of restoreList) {
      entry.el.style[entry.prop] = entry.original
    }
  }
}
