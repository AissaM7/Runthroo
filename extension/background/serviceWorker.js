const BUILDER_URL = 'http://127.0.0.1:19876'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CAPTURE_RESULT') {
    handleCaptureResult(message.data)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true // keep the channel open for async
  }

  if (message.type === 'CAPTURE_ERROR') {
    // Notify popup of failure
    chrome.runtime.sendMessage({
      type: 'CAPTURE_DONE',
      success: false,
      error: message.error
    }).catch(() => {})
  }
})

async function handleCaptureResult(data) {
  // Get pending metadata set by the popup
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

  const response = await fetch(`${BUILDER_URL}/api/captures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `HTTP ${response.status}`)
  }

  // Notify popup of success
  chrome.runtime.sendMessage({
    type: 'CAPTURE_DONE',
    success: true
  }).catch(() => {})
}
