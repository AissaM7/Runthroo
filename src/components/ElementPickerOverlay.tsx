import React, { useEffect, useRef } from 'react'
import { useUIStore } from '../stores/uiStore'

interface Props {
  hiddenElements: string[]
  scale: number
  onChange: (selectors: string[]) => void
}

export function ElementPickerOverlay({ hiddenElements, scale, onChange }: Props) {
  const { drawMode } = useUIStore()
  const isPickerMode = drawMode === 'element-picker'

  // Use refs so the iframe click handler always gets the latest values
  const hiddenRef = useRef(hiddenElements)
  hiddenRef.current = hiddenElements
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Track previous hidden elements for undo reconciliation
  const prevHiddenRef = useRef<string[]>(hiddenElements)

  // ── Reconcile iframe DOM when hiddenElements changes (e.g. via undo) ────────
  useEffect(() => {
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null
    const doc = iframe?.contentDocument
    if (!doc?.body) return

    const prevHidden = prevHiddenRef.current
    const currHidden = hiddenElements

    // Unhide elements that were removed (by undo)
    for (const selector of prevHidden) {
      if (!currHidden.includes(selector)) {
        try {
          const el = doc.querySelector(selector) as HTMLElement
          if (el) el.style.display = ''
        } catch { }
      }
    }

    // Hide elements that are in the current list
    for (const selector of currHidden) {
      try {
        const el = doc.querySelector(selector) as HTMLElement
        if (el) el.style.display = 'none'
      } catch { }
    }

    prevHiddenRef.current = currHidden
  }, [hiddenElements])

  useEffect(() => {
    if (!isPickerMode) return

    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null
    if (!iframe) return

    // AbortController ensures ALL listeners are removed on cleanup — no leaks
    const abort = new AbortController()

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target) return
      e.preventDefault()
      e.stopPropagation()

      const selector = buildSelector(target)
      if (!selector) return

      const current = hiddenRef.current
      if (current.includes(selector)) {
        onChangeRef.current(current.filter(s => s !== selector))
        target.style.display = ''
      } else {
        onChangeRef.current([...current, selector])
        target.style.display = 'none'
      }
    }

    const checkInterval = setInterval(() => {
      try {
        const doc = iframe.contentDocument
        if (doc && doc.body) {
          if (!(doc as any).__runthrooPickerBound) {
            (doc as any).__runthrooPickerBound = true
            doc.addEventListener('click', handleClick, { capture: true, signal: abort.signal })
          }
          if (!doc.getElementById('runthroo-element-picker-style')) {
            const style = doc.createElement('style')
            style.id = 'runthroo-element-picker-style'
            style.textContent = `
              * { cursor: pointer !important; }
              *:hover { outline: 2px dashed rgba(255,59,48,0.6) !important; outline-offset: 2px !important; background: rgba(255,59,48,0.05) !important; }
            `
            doc.head.appendChild(style)
          }
          for (const sel of hiddenRef.current) {
            try {
              const el = doc.querySelector(sel) as HTMLElement
              if (el) el.style.display = 'none'
            } catch { }
          }
        }
      } catch { }
    }, 300)

    return () => {
      clearInterval(checkInterval)
      // Abort removes ALL listeners attached with this controller's signal
      abort.abort()
      try {
        const doc = iframe.contentDocument
        if (doc) {
          (doc as any).__runthrooPickerBound = false
          const style = doc.getElementById('runthroo-element-picker-style')
          if (style) style.remove()
        }
      } catch { }
    }
  }, [isPickerMode, scale])

  function buildSelector(el: HTMLElement): string {
    const parts: string[] = []
    let current: HTMLElement | null = el
    while (current && current !== current.ownerDocument?.body) {
      let selector = current.tagName.toLowerCase()
      if (current.id) {
        selector += '#' + CSS.escape(current.id)
        parts.unshift(selector)
        break
      }
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c.length < 40).slice(0, 3)
        if (classes.length > 0) {
          selector += '.' + classes.map(c => CSS.escape(c)).join('.')
        }
      }
      const parent = current.parentElement
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName)
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1
          selector += `:nth-of-type(${idx})`
        }
      }
      parts.unshift(selector)
      current = current.parentElement
    }
    return parts.join(' > ')
  }

  return null
}
