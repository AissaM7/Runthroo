import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'

let db: Database.Database

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'demoforge.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runSchema()
  runMigrations()
}

function runSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      page_label TEXT NOT NULL,
      source_url TEXT DEFAULT '',
      viewport_width INTEGER DEFAULT 1440,
      viewport_height INTEGER DEFAULT 900,
      byte_size INTEGER DEFAULT 0,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      tags TEXT DEFAULT '[]',
      captured_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS demos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      platform TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS demo_steps (
      id TEXT PRIMARY KEY,
      demo_id TEXT NOT NULL REFERENCES demos(id) ON DELETE CASCADE,
      capture_id TEXT NOT NULL REFERENCES captures(id),
      step_order INTEGER NOT NULL,
      label TEXT DEFAULT '',
      click_zone TEXT DEFAULT NULL,
      cursor_config TEXT DEFAULT NULL,
      transition TEXT DEFAULT 'instant',
      blur_zones TEXT DEFAULT '[]',
      text_edits TEXT DEFAULT '[]',
      hidden_elements TEXT DEFAULT '[]',
      click_zones TEXT DEFAULT '[]',
      auto_play_delay INTEGER DEFAULT 0,
      personalization_tokens TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(demo_id, step_order)
    );

    CREATE INDEX IF NOT EXISTS idx_captures_platform ON captures(platform);
    CREATE INDEX IF NOT EXISTS idx_steps_demo ON demo_steps(demo_id, step_order);
  `)
}

function runMigrations(): void {
  // V2 migration: add new columns to demo_steps if they don't exist
  const columns = db.prepare(`PRAGMA table_info(demo_steps)`).all() as { name: string }[]
  const colNames = new Set(columns.map(c => c.name))

  const v2Columns: [string, string][] = [
    ['blur_zones', "TEXT DEFAULT '[]'"],
    ['text_edits', "TEXT DEFAULT '[]'"],
    ['hidden_elements', "TEXT DEFAULT '[]'"],
    ['click_zones', "TEXT DEFAULT '[]'"],
    ['auto_play_delay', 'INTEGER DEFAULT 0'],
    ['personalization_tokens', "TEXT DEFAULT '{}'"],
  ]

  for (const [name, def] of v2Columns) {
    if (!colNames.has(name)) {
      db.exec(`ALTER TABLE demo_steps ADD COLUMN ${name} ${def}`)
    }
  }
}

export function getDb(): Database.Database {
  return db
}

// ─── Capture helpers ──────────────────────────────────────────────────────────

export function dbListCaptures(platform?: string, search?: string) {
  let query = `SELECT * FROM captures`
  const params: string[] = []
  const conditions: string[] = []

  if (platform) {
    conditions.push(`platform = ?`)
    params.push(platform)
  }
  if (search) {
    conditions.push(`(page_label LIKE ? OR source_url LIKE ?)`)
    params.push(`%${search}%`, `%${search}%`)
  }
  if (conditions.length) query += ` WHERE ` + conditions.join(` AND `)
  query += ` ORDER BY captured_at DESC`

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[]
  return rows.map(rowToCapture)
}

export function dbGetCapture(id: string) {
  const row = db.prepare(`SELECT * FROM captures WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  return row ? rowToCapture(row) : null
}

export function dbInsertCapture(capture: {
  id: string; platform: string; pageLabel: string; sourceUrl: string;
  viewportWidth: number; viewportHeight: number; byteSize: number;
  filePath: string; thumbnailPath: string | null; tags: string[];
  capturedAt: string;
}) {
  db.prepare(`
    INSERT INTO captures (id, platform, page_label, source_url, viewport_width, viewport_height,
      byte_size, file_path, thumbnail_path, tags, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    capture.id, capture.platform, capture.pageLabel, capture.sourceUrl,
    capture.viewportWidth, capture.viewportHeight, capture.byteSize,
    capture.filePath, capture.thumbnailPath, JSON.stringify(capture.tags),
    capture.capturedAt
  )
}

export function dbDeleteCapture(id: string) {
  db.prepare(`DELETE FROM captures WHERE id = ?`).run(id)
}

export function dbDeleteCaptureWithCascade(id: string) {
  const txn = db.transaction(() => {
    // Find all demos affected by this capture
    const affectedDemos = db.prepare(
      `SELECT DISTINCT demo_id FROM demo_steps WHERE capture_id = ?`
    ).all(id) as { demo_id: string }[]

    // Delete all steps referencing this capture
    db.prepare(`DELETE FROM demo_steps WHERE capture_id = ?`).run(id)

    // Re-index remaining steps in each affected demo
    for (const { demo_id } of affectedDemos) {
      dbReindexSteps(demo_id)
    }

    // Delete the capture itself
    db.prepare(`DELETE FROM captures WHERE id = ?`).run(id)
  })
  txn()
}

export function dbUpdateCaptureThumbnail(id: string, thumbnailPath: string) {
  db.prepare(`UPDATE captures SET thumbnail_path = ? WHERE id = ?`).run(thumbnailPath, id)
}

export function dbUpdateCaptureTags(id: string, tags: string[]) {
  db.prepare(`UPDATE captures SET tags = ? WHERE id = ?`).run(JSON.stringify(tags), id)
}

// ─── Demo helpers ─────────────────────────────────────────────────────────────

export function dbListDemos() {
  const demos = db.prepare(`SELECT * FROM demos ORDER BY updated_at DESC`).all() as Record<string, unknown>[]
  return demos.map(d => ({
    id: d.id as string,
    name: d.name as string,
    description: d.description as string,
    platform: d.platform as string,
    steps: dbListSteps(d.id as string),
    createdAt: d.created_at as string,
    updatedAt: d.updated_at as string,
  }))
}

export function dbGetDemo(id: string) {
  const d = db.prepare(`SELECT * FROM demos WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!d) return null
  return {
    id: d.id as string,
    name: d.name as string,
    description: d.description as string,
    platform: d.platform as string,
    steps: dbListSteps(id),
    createdAt: d.created_at as string,
    updatedAt: d.updated_at as string,
  }
}

export function dbInsertDemo(id: string, name: string, platform: string) {
  db.prepare(`INSERT INTO demos (id, name, platform) VALUES (?, ?, ?)`).run(id, name, platform)
}

export function dbUpdateDemo(id: string, updates: { name?: string; description?: string; platform?: string }) {
  const fields: string[] = []
  const params: unknown[] = []
  if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name) }
  if (updates.description !== undefined) { fields.push('description = ?'); params.push(updates.description) }
  if (updates.platform !== undefined) { fields.push('platform = ?'); params.push(updates.platform) }
  if (!fields.length) return
  fields.push(`updated_at = datetime('now')`)
  params.push(id)
  db.prepare(`UPDATE demos SET ${fields.join(', ')} WHERE id = ?`).run(...params)
}

export function dbDeleteDemo(id: string) {
  db.prepare(`DELETE FROM demos WHERE id = ?`).run(id)
}

// ─── Step helpers ─────────────────────────────────────────────────────────────

export function dbListSteps(demoId: string) {
  const rows = db.prepare(`SELECT * FROM demo_steps WHERE demo_id = ? ORDER BY step_order`).all(demoId) as Record<string, unknown>[]
  return rows.map(rowToStep)
}

export function dbInsertStep(step: {
  id: string; demoId: string; captureId: string; stepOrder: number;
  label: string; clickZone: unknown; cursorConfig: unknown; transition: string;
}) {
  db.prepare(`
    INSERT INTO demo_steps (id, demo_id, capture_id, step_order, label, click_zone, cursor_config, transition)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    step.id, step.demoId, step.captureId, step.stepOrder, step.label,
    step.clickZone ? JSON.stringify(step.clickZone) : null,
    step.cursorConfig ? JSON.stringify(step.cursorConfig) : null,
    step.transition
  )
}

export function dbUpdateStep(id: string, updates: {
  label?: string; clickZone?: unknown; cursorConfig?: unknown; transition?: string;
  blurZones?: unknown; textEdits?: unknown; hiddenElements?: unknown;
  clickZones?: unknown; autoPlayDelay?: number; personalizationTokens?: unknown;
}) {
  const fields: string[] = []
  const params: unknown[] = []
  if (updates.label !== undefined) { fields.push('label = ?'); params.push(updates.label) }
  if ('clickZone' in updates) { fields.push('click_zone = ?'); params.push(updates.clickZone ? JSON.stringify(updates.clickZone) : null) }
  if ('cursorConfig' in updates) { fields.push('cursor_config = ?'); params.push(updates.cursorConfig ? JSON.stringify(updates.cursorConfig) : null) }
  if (updates.transition !== undefined) { fields.push('transition = ?'); params.push(updates.transition) }
  // V2 fields
  if ('blurZones' in updates) { fields.push('blur_zones = ?'); params.push(JSON.stringify(updates.blurZones || [])) }
  if ('textEdits' in updates) { fields.push('text_edits = ?'); params.push(JSON.stringify(updates.textEdits || [])) }
  if ('hiddenElements' in updates) { fields.push('hidden_elements = ?'); params.push(JSON.stringify(updates.hiddenElements || [])) }
  if ('clickZones' in updates) { fields.push('click_zones = ?'); params.push(JSON.stringify(updates.clickZones || [])) }
  if ('autoPlayDelay' in updates) { fields.push('auto_play_delay = ?'); params.push(updates.autoPlayDelay || 0) }
  if ('personalizationTokens' in updates) { fields.push('personalization_tokens = ?'); params.push(JSON.stringify(updates.personalizationTokens || {})) }
  if (!fields.length) return
  params.push(id)
  db.prepare(`UPDATE demo_steps SET ${fields.join(', ')} WHERE id = ?`).run(...params)
}

export function dbDeleteStep(id: string) {
  db.prepare(`DELETE FROM demo_steps WHERE id = ?`).run(id)
}

export function dbReorderSteps(demoId: string, stepIds: string[]) {
  const update = db.prepare(`UPDATE demo_steps SET step_order = ? WHERE id = ? AND demo_id = ?`)
  const txn = db.transaction(() => {
    // Pass 1: set all to negative temps to avoid UNIQUE(demo_id, step_order) conflicts
    stepIds.forEach((sid, idx) => update.run(-(idx + 1), sid, demoId))
    // Pass 2: set to final positive values
    stepIds.forEach((sid, idx) => update.run(idx, sid, demoId))
  })
  txn()
}

export function dbReindexSteps(demoId: string) {
  const steps = db.prepare(`SELECT id FROM demo_steps WHERE demo_id = ? ORDER BY step_order`).all(demoId) as { id: string }[]
  const update = db.prepare(`UPDATE demo_steps SET step_order = ? WHERE id = ?`)
  const txn = db.transaction(() => {
    steps.forEach((s, idx) => update.run(idx, s.id))
  })
  txn()
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToCapture(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    platform: row.platform as string,
    pageLabel: row.page_label as string,
    sourceUrl: row.source_url as string,
    viewportWidth: row.viewport_width as number,
    viewportHeight: row.viewport_height as number,
    byteSize: row.byte_size as number,
    filePath: row.file_path as string,
    thumbnailPath: row.thumbnail_path as string | null,
    tags: JSON.parse((row.tags as string) || '[]') as string[],
    capturedAt: row.captured_at as string,
    createdAt: row.created_at as string,
  }
}

function rowToStep(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    demoId: row.demo_id as string,
    captureId: row.capture_id as string,
    stepOrder: row.step_order as number,
    label: row.label as string,
    clickZone: row.click_zone ? JSON.parse(row.click_zone as string) : null,
    cursorConfig: row.cursor_config ? JSON.parse(row.cursor_config as string) : null,
    transition: row.transition as 'fade' | 'slide-left' | 'instant',
    // V2 fields
    blurZones: JSON.parse((row.blur_zones as string) || '[]'),
    textEdits: JSON.parse((row.text_edits as string) || '[]'),
    hiddenElements: JSON.parse((row.hidden_elements as string) || '[]'),
    clickZones: JSON.parse((row.click_zones as string) || '[]'),
    autoPlayDelay: (row.auto_play_delay as number) || 0,
    personalizationTokens: JSON.parse((row.personalization_tokens as string) || '{}'),
  }
}
