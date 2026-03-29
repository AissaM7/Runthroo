const BUILDER_URL = 'http://127.0.0.1:19876'

const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')
const captureBtn = document.getElementById('capture-btn')
const captureBtnText = document.getElementById('capture-btn-text')
const platformInput = document.getElementById('platform')
const pageLabelInput = document.getElementById('page-label')
const toast = document.getElementById('toast')
const historyList = document.getElementById('history-list')
const emptyHistory = document.getElementById('empty-history')

// ═══════════════════════════════════════════════════════════════════════════════
// Connection Check
// ═══════════════════════════════════════════════════════════════════════════════

async function checkConnection() {
  try {
    const res = await fetch(`${BUILDER_URL}/health`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      statusDot.className = 'dot dot-green'
      statusText.textContent = 'localhost:19876'
      captureBtn.disabled = false
      return true
    }
  } catch { }
  statusDot.className = 'dot dot-red'
  statusText.textContent = 'Offline'
  captureBtn.disabled = true
  return false
}

// Auto-fill page label from active tab title
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    pageLabelInput.value = tabs[0].title || ''
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// History
// ═══════════════════════════════════════════════════════════════════════════════

function loadHistory() {
  chrome.storage.local.get(['captureHistory'], (result) => {
    const history = result.captureHistory || []
    historyList.innerHTML = ''

    if (history.length === 0) {
      emptyHistory.style.display = 'block'
      return
    }
    emptyHistory.style.display = 'none'

    history.slice(0, 2).forEach((item, i) => {
      const li = document.createElement('li')
      li.className = 'history-item'
      li.style.animationDelay = `${i * 0.05}s`

      const platformTag = item.platform
        ? `<span class="platform-tag">${escapeHtml(item.platform)}</span>`
        : ''

      const timeAgo = getTimeAgo(new Date(item.capturedAt))

      li.innerHTML = `
        <div class="label">${escapeHtml(item.pageLabel)}</div>
        <div class="meta">${platformTag}<span>${timeAgo}</span></div>
      `
      historyList.appendChild(li)
    })
  })
}

function getTimeAgo(date) {
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return date.toLocaleDateString()
}

function showToast(msg, type) {
  toast.textContent = msg
  toast.className = `toast ${type}`
  setTimeout(() => { toast.className = 'toast hidden' }, 4000)
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Single-Page Capture (existing feature)
// ═══════════════════════════════════════════════════════════════════════════════

captureBtn.addEventListener('click', async () => {
  const connected = await checkConnection()
  if (!connected) {
    showToast('Runthroo app is not running on port 19876', 'error')
    return
  }

  captureBtn.disabled = true
  captureBtn.classList.add('capturing')
  captureBtnText.textContent = 'Capturing…'

  const platform = platformInput.value.trim() || 'unknown'
  const pageLabel = pageLabelInput.value.trim() || 'Untitled'

  // Store metadata for the service worker (NOT autoRecording — normal capture)
  chrome.storage.session.set({ pendingCaptureMeta: { platform, pageLabel } })

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0]
    if (!tab?.id) {
      showToast('No active tab found', 'error')
      resetButton()
      return
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/captureAgent.js'],
      })
    } catch (err) {
      showToast('Could not inject capture script: ' + err.message, 'error')
      resetButton()
      return
    }

    // Listen for result from service worker
    const listener = (msg) => {
      if (msg.type === 'CAPTURE_DONE') {
        chrome.runtime.onMessage.removeListener(listener)
        resetButton()
        if (msg.success) {
          showToast('✓ Captured successfully!', 'success')
          chrome.storage.local.get(['captureHistory'], (result) => {
            const history = result.captureHistory || []
            history.unshift({ pageLabel, platform, capturedAt: new Date().toISOString() })
            chrome.storage.local.set({ captureHistory: history.slice(0, 10) })
            loadHistory()
          })
        } else {
          showToast('Capture failed: ' + (msg.error || 'Unknown error'), 'error')
        }
      }
    }
    chrome.runtime.onMessage.addListener(listener)

    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener)
      resetButton()
    }, 60000)
  })
})

function resetButton() {
  captureBtn.disabled = false
  captureBtn.classList.remove('capturing')
  captureBtnText.textContent = 'Capture This Page'
}

// ═══════════════════════════════════════════════════════════════════════════════
// Recording Mode
// ═══════════════════════════════════════════════════════════════════════════════
// Recording is managed by the service worker. Pages are auto-captured whenever
// the user navigates on the recorded tab. The popup just starts/stops recording
// and shows progress.

const startRecordingBtn = document.getElementById('start-recording-btn')
const recordingIdle = document.getElementById('recording-idle')
const recordingActive = document.getElementById('recording-active')
const finishRecordingBtn = document.getElementById('finish-recording-btn')
const cancelRecordingBtn = document.getElementById('cancel-recording-btn')
const recordingCount = document.getElementById('recording-count')
const recordingLog = document.getElementById('recording-log')

// ── Restore recording state on popup open ────────────────────────────────────
// The popup may have been closed and reopened — read state from service worker.
chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (state) => {
  if (chrome.runtime.lastError || !state) return
  if (state.active) {
    showRecordingUI(state.captures)
  }
})

function showRecordingUI(captures) {
  recordingIdle.style.display = 'none'
  recordingActive.style.display = 'block'
  recordingCount.textContent = String(captures.length)
  // Populate the capture log
  recordingLog.innerHTML = ''
  captures.forEach((cap, i) => {
    addLogEntry(i + 1, cap.pageTitle, cap.sourceUrl)
  })
}

function addLogEntry(num, title, url) {
  const li = document.createElement('li')
  li.className = 'recording-log-item'
  li.innerHTML = `
    <span class="log-num">${num}</span>
    <div class="log-detail">
      <span class="log-title">${escapeHtml(title || 'Untitled')}</span>
      <span class="log-url">${escapeHtml(truncateUrl(url || ''))}</span>
    </div>
    <span class="log-check">✓</span>
  `
  recordingLog.appendChild(li)
  // Scroll to bottom
  recordingLog.scrollTop = recordingLog.scrollHeight
}

function truncateUrl(url) {
  try {
    const u = new URL(url)
    return u.pathname.length > 40
      ? u.hostname + u.pathname.slice(0, 37) + '…'
      : u.hostname + u.pathname
  } catch {
    return url.slice(0, 50)
  }
}

// ── Start Recording ──────────────────────────────────────────────────────────
startRecordingBtn.addEventListener('click', async () => {
  const connected = await checkConnection()
  if (!connected) {
    showToast('Runthroo app is not running', 'error')
    return
  }

  // Get the active tab to record
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab?.id) {
    showToast('No active tab found', 'error')
    return
  }

  const platform = platformInput.value.trim() || ''

  // Tell the service worker to start recording this tab
  chrome.runtime.sendMessage({
    type: 'START_RECORDING',
    tabId: tab.id,
    platform,
  }, (response) => {
    if (response?.ok) {
      showRecordingUI([])
      showToast('Recording started — browse your site!', 'success')
    } else {
      showToast('Failed to start recording', 'error')
    }
  })
})

// ── Listen for auto-capture events from the service worker ───────────────────
// IMPORTANT: Only handle known message types. Return false/undefined for
// unrecognized messages so the service worker can handle them (e.g., FETCH_URL).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RECORDING_PAGE_CAPTURED') {
    recordingCount.textContent = String(msg.captureCount)
    addLogEntry(msg.captureCount, msg.pageTitle, msg.sourceUrl || '')
    return false // Handled synchronously, no async response needed
  }
  // Do NOT return true for unrecognized messages — let the service worker handle them
  return false
})

// ── Finish Recording & Create Demo ───────────────────────────────────────────
finishRecordingBtn.addEventListener('click', async () => {
  // Ask service worker for the capture list and stop recording
  chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, async (response) => {
    if (!response?.ok) {
      showToast('Failed to stop recording', 'error')
      return
    }

    const captures = response.captures || []
    if (captures.length === 0) {
      showToast('No pages were captured', 'error')
      stopRecordingUI()
      return
    }

    finishRecordingBtn.disabled = true
    finishRecordingBtn.textContent = 'Creating demo…'

    try {
      // Create a demo from the captured page IDs
      const captureIds = captures.map(c => c.captureId)
      const demoName = `Recording ${new Date().toLocaleTimeString()}`

      const res = await fetch(`${BUILDER_URL}/api/demos/from-captures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoName, captureIds })
      })

      if (res.ok) {
        const result = await res.json()
        showToast(`Demo created with ${result.stepCount} steps!`, 'success')
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown' }))
        showToast('Failed: ' + (err.error || 'Unknown error'), 'error')
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }

    stopRecordingUI()
  })
})

// ── Cancel Recording ─────────────────────────────────────────────────────────
cancelRecordingBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, () => {
    stopRecordingUI()
    showToast('Recording cancelled', 'error')
  })
})

function stopRecordingUI() {
  recordingIdle.style.display = 'block'
  recordingActive.style.display = 'none'
  recordingLog.innerHTML = ''
  finishRecordingBtn.disabled = false
  finishRecordingBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M4 8l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Finish & Create Demo
  `
}

// ═══════════════════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════════════════

checkConnection().then(connected => {
  startRecordingBtn.disabled = !connected
})
loadHistory()
