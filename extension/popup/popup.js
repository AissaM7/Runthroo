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

// Check connection to builder app
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

// Load history
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

  // Store metadata for the service worker
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
          // Save to history
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

    // Timeout if no response in 60s
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

checkConnection()
loadHistory()
