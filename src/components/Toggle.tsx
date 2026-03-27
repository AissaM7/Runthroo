import React from 'react'

interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  size?: 'sm' | 'md'
}

export function Toggle({ checked, onChange, size = 'md' }: Props) {
  const isMd = size === 'md'
  const w = isMd ? 44 : 36
  const h = isMd ? 24 : 20
  const dot = isMd ? 20 : 16
  const pad = 2

  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2c2c2c]"
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        background: checked
          ? 'linear-gradient(135deg, #0A84FF, #0066cc)'
          : 'rgba(120,120,128,0.32)',
        transition: 'background 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: pad,
      }}
    >
      <span
        style={{
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.15)',
          transform: `translateX(${checked ? w - dot - pad * 2 : 0}px)`,
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'block',
        }}
      />
    </button>
  )
}
