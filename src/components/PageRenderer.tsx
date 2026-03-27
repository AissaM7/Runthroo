import React, { useEffect, useRef } from 'react'

interface Props {
  captureId: string
  viewportWidth?: number
  viewportHeight?: number
  containerWidth?: number
  containerHeight?: number
  className?: string
  /** When true (default), the iframe is interactive — scrollable, hoverable, clickable */
  interactive?: boolean
}

export function PageRenderer({
  captureId,
  viewportWidth = 1440,
  viewportHeight = 900,
  containerWidth,
  containerHeight,
  className = '',
  interactive = true,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!captureId) return
    window.api.readCaptureHtml(captureId).then(html => {
      if (iframeRef.current) {
        iframeRef.current.srcdoc = html
      }
    }).catch(() => { })
  }, [captureId])

  const cw = containerWidth ?? 800
  const ch = containerHeight ?? 600
  const scaleX = cw / viewportWidth
  const scaleY = ch / viewportHeight
  const scale = Math.min(scaleX, scaleY, 1)

  const scaledW = viewportWidth * scale
  const scaledH = viewportHeight * scale

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        width: scaledW,
        height: scaledH,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.05)',
        borderRadius: 2,
      }}
    >
      <iframe
        id={interactive ? 'preview-iframe' : undefined}
        ref={iframeRef}
        sandbox="allow-same-origin allow-scripts"
        style={{
          width: viewportWidth,
          height: viewportHeight,
          border: 'none',
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      />
    </div>
  )
}
