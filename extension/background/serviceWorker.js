const BUILDER_URL = 'http://127.0.0.1:19876'

// ═══════════════════════════════════════════════════════════════════════════════
// Recording State Management
// ═══════════════════════════════════════════════════════════════════════════════
// State stored in chrome.storage.session:
//   runthrooRecordingActive  : boolean
//   runthrooRecordingTabId   : number
//   runthrooRecordingCaptures: { captureId, pageTitle, sourceUrl }[]
//   runthrooRecordingPlatform: string

async function getRecordingState() {
  const data = await chrome.storage.session.get([
    'runthrooRecordingActive',
    'runthrooRecordingTabId',
    'runthrooRecordingCaptures',
    'runthrooRecordingPlatform',
  ])
  return {
    active: data.runthrooRecordingActive || false,
    tabId: data.runthrooRecordingTabId || null,
    captures: data.runthrooRecordingCaptures || [],
    platform: data.runthrooRecordingPlatform || '',
  }
}

async function setRecordingState(state) {
  await chrome.storage.session.set({
    runthrooRecordingActive: state.active,
    runthrooRecordingTabId: state.tabId,
    runthrooRecordingCaptures: state.captures,
    runthrooRecordingPlatform: state.platform,
  })
}

async function addRecordingCapture(captureInfo) {
  const state = await getRecordingState()
  if (!state.active) return 0
  state.captures.push(captureInfo)
  await setRecordingState(state)
  // Update badge count
  chrome.action.setBadgeText({ text: String(state.captures.length) })
  chrome.action.setBadgeBackgroundColor({ color: '#ff453a' })
  return state.captures.length
}

// ═══════════════════════════════════════════════════════════════════════════════
// Auto-Capture on Navigation — Debounced Settle Timer
// ═══════════════════════════════════════════════════════════════════════════════
// Strategy: every navigation event resets a single timer. The page is only
// captured after 3.5 seconds of NO new navigation events, which means the page
// has finished loading and the user is viewing it. This prevents duplicates
// from rapid SPA route changes and ensures JS frameworks have time to render.

const capturedUrls = new Set()   // normalized URLs already captured in this session
let settleTimer = null           // single debounce timer
let pendingCaptureUrl = ''       // URL the settle timer is waiting to capture

/**
 * Normalize a URL for dedup — strip hash + trailing slash so that
 * https://example.com/page, https://example.com/page/, and
 * https://example.com/page#section all count as the same page.
 */
function normalizeUrl(url) {
  try {
    const u = new URL(url)
    u.hash = ''
    // Remove trailing slash (but keep '/' for root)
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1)
    }
    return u.toString()
  } catch {
    return url
  }
}

function scheduleAutoCapture(tabId, url) {
  // Skip internal pages
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return

  const normalized = normalizeUrl(url)

  // Already captured this page in this recording session
  if (capturedUrls.has(normalized)) {
    console.debug('[Runthroo] Already captured, skipping:', normalized)
    return
  }

  // Cancel any pending capture — the page is still changing
  if (settleTimer) {
    clearTimeout(settleTimer)
    settleTimer = null
  }

  pendingCaptureUrl = normalized

  // Wait 3.5 seconds of silence (no new nav events) before capturing.
  // This gives JS frameworks plenty of time to finish rendering.
  settleTimer = setTimeout(() => {
    settleTimer = null
    doAutoCapture(tabId, normalized)
  }, 3500)

  console.debug('[Runthroo] Settle timer started for:', normalized)
}

async function doAutoCapture(tabId, normalizedUrl, retryCount = 0) {
  try {
    const state = await getRecordingState()
    if (!state.active || tabId !== state.tabId) return

    // Already captured (e.g. from a race)
    if (capturedUrls.has(normalizedUrl)) return

    // Verify the tab still exists and is still on the expected URL
    let tab
    try {
      tab = await chrome.tabs.get(tabId)
    } catch {
      return // Tab was closed
    }

    const currentNormalized = normalizeUrl(tab.url)
    if (currentNormalized !== normalizedUrl) {
      console.debug('[Runthroo] Tab URL changed before capture, skipping:', normalizedUrl)
      return
    }

    // Mark captured BEFORE injection so duplicate events can't re-trigger
    capturedUrls.add(normalizedUrl)

    // Store metadata so handleCaptureResult knows this is an auto-recording capture
    await chrome.storage.session.set({
      pendingCaptureMeta: {
        platform: state.platform,
        pageLabel: tab.title || 'Untitled',
        autoRecording: true,
      }
    })

    // Inject the capture agent
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/captureAgent.js'],
    })

    console.log('[Runthroo] ✓ Captured:', normalizedUrl)
  } catch (err) {
    const msg = err.message || ''
    // "Frame with ID 0 was removed" = tab navigated during injection. Retry.
    if (msg.includes('Frame') && msg.includes('removed') && retryCount < 3) {
      console.debug('[Runthroo] Frame removed during injection, retrying in 2s…', normalizedUrl)
      // Un-mark so retry can proceed
      capturedUrls.delete(normalizedUrl)
      await new Promise(r => setTimeout(r, 2000))
      return doAutoCapture(tabId, normalizedUrl, retryCount + 1)
    }
    // Remove from captured set so user can retry
    capturedUrls.delete(normalizedUrl)
    console.debug('[Runthroo] Auto-capture failed for', normalizedUrl, ':', msg)
  }
}

// ── Listen for full page navigations ─────────────────────────────────────────
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return // main frame only
  const state = await getRecordingState()
  if (!state.active || details.tabId !== state.tabId) return
  scheduleAutoCapture(details.tabId, details.url)
})

// ── Listen for SPA navigation (pushState / replaceState) ─────────────────────
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return
  const state = await getRecordingState()
  if (!state.active || details.tabId !== state.tabId) return
  scheduleAutoCapture(details.tabId, details.url)
})

// ═══════════════════════════════════════════════════════════════════════════════
// Message Handler
// ═══════════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Start Recording ────────────────────────────────────────────────────────
  if (message.type === 'START_RECORDING') {
    (async () => {
      try {
        capturedUrls.clear()
        if (settleTimer) { clearTimeout(settleTimer); settleTimer = null }
        pendingCaptureUrl = ''
        await setRecordingState({
          active: true,
          tabId: message.tabId,
          captures: [],
          platform: message.platform || '',
        })
        chrome.action.setBadgeText({ text: '0' })
        chrome.action.setBadgeBackgroundColor({ color: '#ff453a' })

        // Auto-capture the current page immediately
        let tab
        try {
          tab = await chrome.tabs.get(message.tabId)
        } catch { /* tab might not exist */ }
        if (tab && tab.url && !tab.url.startsWith('chrome://')) {
          scheduleAutoCapture(message.tabId, tab.url)
        }

        sendResponse({ ok: true })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // ── Stop Recording ─────────────────────────────────────────────────────────
  if (message.type === 'STOP_RECORDING') {
    (async () => {
      try {
        const state = await getRecordingState()
        const captures = state.captures || []
        await setRecordingState({ active: false, tabId: null, captures: [], platform: '' })
        chrome.action.setBadgeText({ text: '' })
        capturedUrls.clear()
        if (settleTimer) { clearTimeout(settleTimer); settleTimer = null }
        pendingCaptureUrl = ''
        sendResponse({ ok: true, captures })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // ── Get Recording State ────────────────────────────────────────────────────
  if (message.type === 'GET_RECORDING_STATE') {
    getRecordingState()
      .then(state => sendResponse(state))
      .catch(() => sendResponse({ active: false, captures: [] }))
    return true
  }

  // ── Capture Result (from captureAgent.js) ──────────────────────────────────
  if (message.type === 'CAPTURE_RESULT') {
    handleCaptureResult(message.data)
      .then(() => sendResponse({ ok: true }))
      .catch(err => {
        console.error('[Runthroo] handleCaptureResult error:', err.message)
        sendResponse({ ok: false, error: err.message })
      })
    return true
  }

  // ── Capture Error ──────────────────────────────────────────────────────────
  if (message.type === 'CAPTURE_ERROR') {
    chrome.runtime.sendMessage({
      type: 'CAPTURE_DONE',
      success: false,
      error: message.error
    }).catch(() => { })
    return false
  }

  // ── CORS Proxy Fetch (text) ────────────────────────────────────────────────
  // The service worker has host_permissions: <all_urls>, so it can fetch any URL
  // without CORS restrictions. Content scripts relay their fetch requests here.
  if (message.type === 'FETCH_URL') {
    (async () => {
      try {
        const res = await fetch(message.url, {
          credentials: 'omit',
          headers: {
            'Accept': 'text/css,*/*;q=0.1',
          }
        })
        if (!res.ok) {
          sendResponse({ ok: false, error: 'HTTP ' + res.status })
          return
        }
        const text = await res.text()
        sendResponse({ ok: true, text })
      } catch (err) {
        console.debug('[Runthroo] FETCH_URL failed for', message.url, err.message)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // ── CORS Proxy Fetch (binary → base64 data URL) ──────────────────────────
  if (message.type === 'FETCH_URL_BASE64') {
    (async () => {
      try {
        const res = await fetch(message.url, { credentials: 'omit' })
        if (!res.ok) {
          sendResponse({ ok: false, error: 'HTTP ' + res.status })
          return
        }
        const blob = await res.blob()
        const reader = new FileReader()
        reader.onloadend = () => sendResponse({ ok: true, dataUrl: reader.result })
        reader.onerror = () => sendResponse({ ok: false, error: 'FileReader failed' })
        reader.readAsDataURL(blob)
      } catch (err) {
        console.debug('[Runthroo] FETCH_URL_BASE64 failed for', message.url, err.message)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // Unknown message type — don't keep the channel open
  return false
})

// ═══════════════════════════════════════════════════════════════════════════════
// Handle Capture Results
// ═══════════════════════════════════════════════════════════════════════════════

async function handleCaptureResult(data) {
  const sessionData = await chrome.storage.session.get(['pendingCaptureMeta'])
  const meta = sessionData.pendingCaptureMeta || {}

  const payload = {
    sourceUrl: data.sourceUrl,
    pageTitle: meta.pageLabel || data.pageTitle,
    platform: meta.platform || 'unknown',
    viewportWidth: data.viewportWidth,
    viewportHeight: data.viewportHeight,
    htmlContent: data.htmlContent,
    tags: []
  }

  // POST to Runthroo server
  let response
  try {
    response = await fetch(`${BUILDER_URL}/api/captures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (netErr) {
    throw new Error('Cannot reach Runthroo app: ' + netErr.message)
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `HTTP ${response.status}`)
  }

  const result = await response.json()

  // If this was an auto-recording capture, save captureId to recording state
  if (meta.autoRecording) {
    const count = await addRecordingCapture({
      captureId: result.captureId,
      pageTitle: payload.pageTitle,
      sourceUrl: payload.sourceUrl,
    })

    // Notify the popup (if open) so it can update its UI
    chrome.runtime.sendMessage({
      type: 'RECORDING_PAGE_CAPTURED',
      captureCount: count,
      pageTitle: payload.pageTitle,
      sourceUrl: payload.sourceUrl,
    }).catch(() => { }) // Popup may not be open — that's OK
  } else {
    // Normal single-capture flow — notify popup
    chrome.runtime.sendMessage({
      type: 'CAPTURE_DONE',
      success: true
    }).catch(() => { })
  }

  // Clear pending meta
  chrome.storage.session.remove('pendingCaptureMeta')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Restore badge on service worker restart
// ═══════════════════════════════════════════════════════════════════════════════
getRecordingState().then(state => {
  if (state.active) {
    chrome.action.setBadgeText({ text: String(state.captures.length) })
    chrome.action.setBadgeBackgroundColor({ color: '#ff453a' })
  }
})
