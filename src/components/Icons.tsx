import React from 'react'
import {
  Search,
  Plus,
  X,
  Play,
  Download,
  ChevronDown,
  ChevronRight,
  MousePointer2,
  LayoutGrid,
  FileText,
  Trash2,
  Camera,
  Zap,
} from 'lucide-react'

// Wrappers preserve the `size` prop API used across the codebase.
// strokeWidth=1.75 matches premium UI icon weights; decorative icons use strokeWidth=1.

export function SearchIcon({ size = 16 }: { size?: number }) {
  return <Search size={size} strokeWidth={1.75} />
}

export function PlusIcon({ size = 16 }: { size?: number }) {
  return <Plus size={size} strokeWidth={1.75} />
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  return <X size={size} strokeWidth={1.75} />
}

export function PlayIcon({ size = 16 }: { size?: number }) {
  return <Play size={size} strokeWidth={1.75} />
}

export function DownloadIcon({ size = 16 }: { size?: number }) {
  return <Download size={size} strokeWidth={1.75} />
}

export function ChevronDownIcon({ size = 16 }: { size?: number }) {
  return <ChevronDown size={size} strokeWidth={1.75} />
}

export function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return <ChevronRight size={size} strokeWidth={1.75} />
}

export function CursorIcon({ size = 16 }: { size?: number }) {
  return <MousePointer2 size={size} strokeWidth={1.75} />
}

export function GridIcon({ size = 16 }: { size?: number }) {
  return <LayoutGrid size={size} strokeWidth={1.75} />
}

export function FileIcon({ size = 16 }: { size?: number }) {
  return <FileText size={size} strokeWidth={1.75} />
}

export function TrashIcon({ size = 16 }: { size?: number }) {
  return <Trash2 size={size} strokeWidth={1.75} />
}

export function CameraIcon({ size = 16 }: { size?: number }) {
  return <Camera size={size} strokeWidth={1} />
}

export function DiamondIcon({ size = 16 }: { size?: number }) {
  return <Zap size={size} strokeWidth={1.75} className="text-[#0A84FF]" />
}
