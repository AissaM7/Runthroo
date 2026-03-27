export interface Capture {
  id: string;
  platform: string;
  pageLabel: string;
  sourceUrl: string;
  viewportWidth: number;
  viewportHeight: number;
  byteSize: number;
  filePath: string;
  thumbnailPath: string | null;
  tags: string[];
  capturedAt: string;
  createdAt: string;
}

export interface Demo {
  id: string;
  name: string;
  description: string;
  platform: string;
  steps: DemoStep[];
  createdAt: string;
  updatedAt: string;
}

export interface DemoStep {
  id: string;
  demoId: string;
  captureId: string;
  stepOrder: number;
  label: string;
  clickZone: ClickZone | null;
  cursorConfig: CursorConfig | null;
  transition: 'fade' | 'slide-left' | 'instant';
}

export interface ClickZone {
  x: number;       // percentage 0-100 from left
  y: number;       // percentage 0-100 from top
  width: number;   // percentage of viewport width
  height: number;  // percentage of viewport height
  scrollX?: number;
  scrollY?: number;
  highlightOnHover: boolean;
}

export interface CursorConfig {
  enabled: boolean;
  startX: number;   // percentage
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
  delayMs: number;
  easing: 'ease-in-out' | 'ease-out' | 'linear';
  showClickEffect: boolean;
  loop: boolean;
}

export interface ExportOptions {
  filename: string;
  keyboardNav: boolean;
  showStepCounter: boolean;
  imageQuality: number; // 1-100, JPEG quality
  outputPath?: string; // user-chosen save location
  presentationMode?: boolean; // true = dark framed view, false = full-screen raw website
}
