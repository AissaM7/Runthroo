import React, { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { TextEdit } from '../types/index'
import { useUIStore } from '../stores/uiStore'

interface Props {
  textEdits: TextEdit[]
  scale: number
  onChange: (edits: TextEdit[]) => void
}

// Inline formatting tags that can be "flattened" safely when editing text
const INLINE_TAGS = new Set([
  'SPAN', 'STRONG', 'EM', 'B', 'I', 'A', 'SMALL', 'MARK', 'CODE',
  'SUB', 'SUP', 'U', 'S', 'ABBR', 'CITE', 'Q', 'LABEL', 'TIME',
  'DATA', 'VAR', 'KBD', 'SAMP', 'BDI', 'BDO', 'WBR',
])

/**
 * Check if an element is safe to edit —
 * it should contain only text nodes and inline formatting children.
 */
function isEditableElement(el: HTMLElement): boolean {
  const text = el.innerText?.trim()
  if (!text) return false
  if (text.length > 500) return false // Too large — probably a container

  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]
    if (child.nodeType === Node.TEXT_NODE) continue
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as HTMLElement).tagName
      if (!INLINE_TAGS.has(tag)) return false
    }
  }
  return true
}

/**
 * Walk the DOM to find the best text-editing target near the clicked element.
 * Tries: the element itself → single-child walk-down → walk-up max 3 levels.
 */
function findEditableTarget(el: HTMLElement): HTMLElement | null {
  if (isEditableElement(el)) return el

  // Walk down: if the element has a single child chain, try deeper
  let cursor: HTMLElement = el
  for (let d = 0; d < 5; d++) {
    if (cursor.children.length === 1) {
      cursor = cursor.children[0] as HTMLElement
      if (isEditableElement(cursor)) return cursor
    } else if (cursor.children.length > 1) {
      // Check each child
      for (let i = 0; i < cursor.children.length; i++) {
        const child = cursor.children[i] as HTMLElement
        if (child.innerText?.trim() && isEditableElement(child)) return child
      }
      break
    } else {
      break
    }
  }

  // Walk up max 3 levels
  let parent = el.parentElement
  for (let d = 0; d < 3 && parent; d++) {
    if (isEditableElement(parent)) return parent
    parent = parent.parentElement
  }

  return null
}

/**
 * Build a unique CSS selector for the element
 */
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

export function TextEditOverlay({ textEdits, scale, onChange }: Props) {
  const { drawMode } = useUIStore()
  const activeElRef = useRef<HTMLElement | null>(null)
  const activeEditIdRef = useRef<string | null>(null)
  const originalTextRef = useRef<string>('')

  // Use refs so the iframe click handler always sees the latest values
  const textEditsRef = useRef(textEdits)
  textEditsRef.current = textEdits
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Track previous edits for undo reconciliation
  const prevEditsRef = useRef<TextEdit[]>(textEdits)

  const isEditMode = drawMode === 'text-edit'

  // ── Re-apply all text edits to iframe DOM periodically ──────────────────────
  // Also handles UNDO: if an edit was in prevEdits but is now gone, revert to originalText.
  useEffect(() => {
    function applyEdits() {
      try {
        const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null
        const doc = iframe?.contentDocument
        if (!doc?.body) return

        const currentEdits = textEditsRef.current
        const prevEdits = prevEditsRef.current

        // 1. Revert edits that were removed (undo)
        for (const prev of prevEdits) {
          const stillExists = currentEdits.some(e => e.id === prev.id)
          if (!stillExists) {
            // This edit was undone — revert the DOM element to its original text
            try {
              const el = doc.querySelector(prev.selector) as HTMLElement
              if (el && !el.isContentEditable) {
                el.innerText = prev.originalText
              }
            } catch { }
          }
        }

        // 2. Check if any edit's newText was reverted to originalText by undo
        for (const edit of currentEdits) {
          const prev = prevEdits.find(p => p.id === edit.id)
          if (prev && prev.newText !== edit.newText) {
            // The text changed (possibly reverted by undo)
            try {
              const el = doc.querySelector(edit.selector) as HTMLElement
              if (el && !el.isContentEditable) {
                el.innerText = edit.newText === edit.originalText ? edit.originalText : edit.newText
              }
            } catch { }
          }
        }

        // 3. Apply remaining edits forward (normal flow)
        for (const edit of currentEdits) {
          if (edit.newText === edit.originalText) continue
          try {
            const el = doc.querySelector(edit.selector) as HTMLElement
            if (!el) continue
            if (el.isContentEditable) continue
            const currentText = el.innerText || ''
            if (currentText === edit.newText) continue
            el.innerText = edit.newText
          } catch { }
        }

        // Update prev ref
        prevEditsRef.current = currentEdits
      } catch { }
    }
    applyEdits()
    const interval = setInterval(applyEdits, 600)
    return () => clearInterval(interval)
  }, [textEdits])

  // ── Commit the current inline edit ──────────────────────────────────────────
  const commitInlineEdit = useCallback(() => {
    const el = activeElRef.current
    const editId = activeEditIdRef.current
    if (!el || !editId) return

    // Remove contentEditable styling
    el.contentEditable = 'false'
    el.style.removeProperty('outline')
    el.style.removeProperty('outline-offset')
    el.style.removeProperty('box-shadow')
    el.style.removeProperty('border-radius')
    el.style.removeProperty('min-width')
    el.blur()

    const newText = el.innerText || ''
    const currentEdits = textEditsRef.current

    // If user didn't change anything, remove the edit entry
    if (newText === originalTextRef.current) {
      const updated = currentEdits.filter(te => te.id !== editId)
      if (updated.length !== currentEdits.length) {
        onChangeRef.current(updated)
      }
    } else {
      const updated = currentEdits.map(te =>
        te.id === editId ? { ...te, newText } : te
      )
      onChangeRef.current(updated)
    }

    activeElRef.current = null
    activeEditIdRef.current = null
    originalTextRef.current = ''
  }, [])

  // ── Attach click handler to iframe while in text-edit mode ──────────────────
  useEffect(() => {
    if (!isEditMode) {
      // Commit any active edit when leaving edit mode
      if (activeElRef.current) commitInlineEdit()
      return
    }

    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null
    if (!iframe) return

    function handleIframeClick(e: MouseEvent) {
      const rawTarget = e.target as HTMLElement
      if (!rawTarget) return

      // If clicking the already-active element, let normal cursor behavior work
      if (rawTarget === activeElRef.current || activeElRef.current?.contains(rawTarget)) return

      // Commit any previous edit first
      if (activeElRef.current) commitInlineEdit()

      // Find the best editable element
      const target = findEditableTarget(rawTarget)
      if (!target) return

      e.preventDefault()
      e.stopPropagation()

      const selector = buildSelector(target)
      const currentEdits = textEditsRef.current
      const existingEdit = currentEdits.find(te => te.selector === selector)

      let editId: string
      if (existingEdit) {
        editId = existingEdit.id
        originalTextRef.current = existingEdit.originalText
      } else {
        const originalText = target.innerText || ''
        editId = uuidv4()
        const newEdit: TextEdit = {
          id: editId,
          selector,
          originalText,
          newText: originalText,
        }
        onChangeRef.current([...currentEdits, newEdit])
        originalTextRef.current = originalText
      }

      activeEditIdRef.current = editId
      activeElRef.current = target

      // Make the element contentEditable inline — preserves all original styling
      target.contentEditable = 'true'
      target.style.outline = '2px solid rgba(10,132,255,0.7)'
      target.style.outlineOffset = '2px'
      target.style.boxShadow = '0 0 0 4px rgba(10,132,255,0.15)'
      target.style.borderRadius = '2px'
      target.style.minWidth = '20px'
      target.focus()

      // Select all text so the user can start typing immediately
      try {
        const doc = target.ownerDocument
        const range = doc.createRange()
        range.selectNodeContents(target)
        const sel = doc.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      } catch { }
    }

    function handleIframeKeydown(e: KeyboardEvent) {
      if (!activeElRef.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        // Revert to original text
        const el = activeElRef.current
        const editId = activeEditIdRef.current
        if (el && editId) {
          const edit = textEditsRef.current.find(te => te.id === editId)
          if (edit) {
            el.innerText = edit.originalText
          }
          el.contentEditable = 'false'
          el.style.removeProperty('outline')
          el.style.removeProperty('outline-offset')
          el.style.removeProperty('box-shadow')
          el.style.removeProperty('border-radius')
          el.style.removeProperty('min-width')
          el.blur()

          // Remove the edit if it was unchanged
          const currentEdits = textEditsRef.current
          onChangeRef.current(currentEdits.filter(te => te.id !== editId))
        }
        activeElRef.current = null
        activeEditIdRef.current = null
        originalTextRef.current = ''
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitInlineEdit()
      }
    }

    function handleIframeBlur(e: FocusEvent) {
      // Small delay to allow click handler to fire first
      setTimeout(() => {
        if (activeElRef.current && !activeElRef.current.contains(e.relatedTarget as Node)) {
          commitInlineEdit()
        }
      }, 150)
    }

    // Poll for iframe readiness and attach listeners
    const checkInterval = setInterval(() => {
      try {
        const doc = iframe.contentDocument
        if (doc && doc.body) {
          if (!(doc as any).__runthrooInlineEditBound) {
            (doc as any).__runthrooInlineEditBound = true
            doc.addEventListener('click', handleIframeClick, true)
            doc.addEventListener('keydown', handleIframeKeydown, true)
            doc.addEventListener('focusout', handleIframeBlur, true)
          }
          // Hover highlight style
          if (!doc.getElementById('runthroo-text-edit-style')) {
            const style = doc.createElement('style')
            style.id = 'runthroo-text-edit-style'
            style.textContent = `
              * { cursor: text !important; }
              *:hover { outline: 2px solid rgba(10,132,255,0.3) !important; outline-offset: 2px !important; }
              [contenteditable="true"]:hover { outline: 2px solid rgba(10,132,255,0.7) !important; }
              [contenteditable="true"] { cursor: text !important; }
              [contenteditable="true"]::selection { background: rgba(10,132,255,0.25); }
            `
            doc.head.appendChild(style)
          }
        }
      } catch { }
    }, 300)

    return () => {
      clearInterval(checkInterval)
      // Commit any active edit before cleanup
      if (activeElRef.current) commitInlineEdit()
      try {
        const doc = iframe.contentDocument
        if (doc) {
          (doc as any).__runthrooInlineEditBound = false
          const style = doc.getElementById('runthroo-text-edit-style')
          if (style) style.remove()
        }
      } catch { }
    }
  }, [isEditMode, scale, commitInlineEdit])

  // No visible overlay needed — editing happens inline in the iframe
  return null
}
