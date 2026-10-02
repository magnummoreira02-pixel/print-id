import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import type { CellValue, MatrixMeta, MatrixRow, RowData } from '../shared/types'

export interface MatrixStore {
  backend: 'sqlite' | 'json'
  getMeta(): MatrixMeta | null
  getScanColumn(): string | null
  replaceAll(fileName: string, headers: string[], rows: RowData[], scanColumn: string): void
  getAllRows(): MatrixRow[]
  getRowsByIds(ids: number[]): MatrixRow[]
  updateCell(rowId: number, column: string, value: CellValue): void
  findByCode(code: string): MatrixRow[]
  reindex(scanColumn: string): void
  close(): void
}

export function normalizeCode(value: CellValue): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

function stripLeadingZeros(code: string): string {
  return code.replace(/^0+(?=.)/, '')
}

class SqliteStore implements MatrixStore {
  readonly backend = 'sqlite' as const
  private db: import('better-sqlite3').Database

  constructor(dataDir: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3')
    // banco criado antes do rebrand: renomeia magnun.db → bitred.db
    const dbPath = join(dataDir, 'bitred.db')
    if (!existsSync(dbPath) && existsSync(join(dataDir, 'magnun.db'))) {
      for (const suffix of ['', '-wal', '-shm']) {
        const src = join(dataDir, `magnun.db${suffix}`)
        if (existsSync(src)) renameSync(src, join(dataDir, `bitred.db${suffix}`))
      }
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rows (
        id INTEGER PRIMARY KEY,
        scan_key TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rows_scan_key ON rows (scan_key);
    `)
  }

  private getMetaValue(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
      { value: string } | undefined
    return row ? row.value : null
  }

  getMeta(): MatrixMeta | null {
    const headers = this.getMetaValue('headers')
    if (!headers) return null
    const count = this.db.prepare('SELECT COUNT(*) AS c FROM rows').get() as { c: number }
    return {
      headers: JSON.parse(headers),
      fileName: this.getMetaValue('fileName') ?? '',
      importedAt: this.getMetaValue('importedAt') ?? '',
      rowCount: count.c
    }
  }

  getScanColumn(): string | null {
    return this.getMetaValue('scanColumn')
  }

  replaceAll(fileName: string, headers: string[], rows: RowData[], scanColumn: string): void {
    const setMeta = this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
    const insert = this.db.prepare('INSERT INTO rows (scan_key, data) VALUES (?, ?)')
    const tx = this.db.transaction(() => {
      this.db.exec('DELETE FROM rows')
      setMeta.run('headers', JSON.stringify(headers))
      setMeta.run('fileName', fileName)
      setMeta.run('importedAt', new Date().toISOString())
      setMeta.run('scanColumn', scanColumn)
      for (const data of rows) {
        insert.run(normalizeCode(data[scanColumn] ?? null), JSON.stringify(data))
      }
    })
    tx()
  }

  getAllRows(): MatrixRow[] {
    const rows = this.db.prepare('SELECT id, data FROM rows ORDER BY id').all() as Array<{
      id: number
      data: string
    }>
    return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }))
  }

  getRowsByIds(ids: number[]): MatrixRow[] {
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db
      .prepare(`SELECT id, data FROM rows WHERE id IN (${placeholders}) ORDER BY id`)
      .all(...ids) as Array<{ id: number; data: string }>
    return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }))
  }

  updateCell(rowId: number, column: string, value: CellValue): void {
    const row = this.db.prepare('SELECT data FROM rows WHERE id = ?').get(rowId) as
      { data: string } | undefined
    if (!row) return
    const data: RowData = JSON.parse(row.data)
    data[column] = value
    const scanColumn = this.getScanColumn()
    const scanKey =
      scanColumn === column
        ? normalizeCode(value)
        : (
            this.db.prepare('SELECT scan_key FROM rows WHERE id = ?').get(rowId) as {
              scan_key: string
            }
          ).scan_key
    this.db
      .prepare('UPDATE rows SET data = ?, scan_key = ? WHERE id = ?')
      .run(JSON.stringify(data), scanKey, rowId)
  }

  findByCode(code: string): MatrixRow[] {
    const normalized = normalizeCode(code)
    if (!normalized) return []
    let rows = this.db
      .prepare('SELECT id, data FROM rows WHERE scan_key = ? ORDER BY id')
      .all(normalized) as Array<{ id: number; data: string }>
    if (rows.length === 0) {
      // Fallback: tolerate leading zeros on either side (barcode "05243" vs cell 5243)
      const stripped = stripLeadingZeros(normalized)
      rows = this.db
        .prepare(
          "SELECT id, data FROM rows WHERE ltrim(scan_key, '0') = ? AND scan_key != '' ORDER BY id"
        )
        .all(stripped) as Array<{ id: number; data: string }>
    }
    return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }))
  }

  reindex(scanColumn: string): void {
    const rows = this.db.prepare('SELECT id, data FROM rows').all() as Array<{
      id: number
      data: string
    }>
    const update = this.db.prepare('UPDATE rows SET scan_key = ? WHERE id = ?')
    const setMeta = this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
    const tx = this.db.transaction(() => {
      setMeta.run('scanColumn', scanColumn)
      for (const r of rows) {
        const data: RowData = JSON.parse(r.data)
        update.run(normalizeCode(data[scanColumn] ?? null), r.id)
      }
    })
    tx()
  }

  close(): void {
    this.db.close()
  }
}

interface JsonStoreShape {
  meta: MatrixMeta | null
  scanColumn: string | null
  nextId: number
  rows: Array<{ id: number; key: string; data: RowData }>
}

class JsonStore implements MatrixStore {
  readonly backend = 'json' as const
  private filePath: string
  private state: JsonStoreShape

  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'bitred-data.json')
    const legacyPath = join(dataDir, 'magnun-data.json')
    if (!existsSync(this.filePath) && existsSync(legacyPath)) {
      renameSync(legacyPath, this.filePath)
    }
    if (existsSync(this.filePath)) {
      this.state = JSON.parse(readFileSync(this.filePath, 'utf-8'))
    } else {
      this.state = { meta: null, scanColumn: null, nextId: 1, rows: [] }
    }
  }

  private save(): void {
    const tmp = this.filePath + '.tmp'
    writeFileSync(tmp, JSON.stringify(this.state), 'utf-8')
    renameSync(tmp, this.filePath)
  }

  getMeta(): MatrixMeta | null {
    if (!this.state.meta) return null
    return { ...this.state.meta, rowCount: this.state.rows.length }
  }

  getScanColumn(): string | null {
    return this.state.scanColumn
  }

  replaceAll(fileName: string, headers: string[], rows: RowData[], scanColumn: string): void {
    this.state.meta = {
      headers,
      fileName,
      importedAt: new Date().toISOString(),
      rowCount: rows.length
    }
    this.state.scanColumn = scanColumn
    this.state.nextId = rows.length + 1
    this.state.rows = rows.map((data, i) => ({
      id: i + 1,
      key: normalizeCode(data[scanColumn] ?? null),
      data
    }))
    this.save()
  }

  getAllRows(): MatrixRow[] {
    return this.state.rows.map((r) => ({ id: r.id, data: r.data }))
  }

  getRowsByIds(ids: number[]): MatrixRow[] {
    const wanted = new Set(ids)
    return this.state.rows.filter((r) => wanted.has(r.id)).map((r) => ({ id: r.id, data: r.data }))
  }

  updateCell(rowId: number, column: string, value: CellValue): void {
    const row = this.state.rows.find((r) => r.id === rowId)
    if (!row) return
    row.data[column] = value
    if (this.state.scanColumn === column) row.key = normalizeCode(value)
    this.save()
  }

  findByCode(code: string): MatrixRow[] {
    const normalized = normalizeCode(code)
    if (!normalized) return []
    let hits = this.state.rows.filter((r) => r.key === normalized)
    if (hits.length === 0) {
      const stripped = stripLeadingZeros(normalized)
      hits = this.state.rows.filter((r) => r.key !== '' && stripLeadingZeros(r.key) === stripped)
    }
    return hits.map((r) => ({ id: r.id, data: r.data }))
  }

  reindex(scanColumn: string): void {
    this.state.scanColumn = scanColumn
    for (const r of this.state.rows) {
      r.key = normalizeCode(r.data[scanColumn] ?? null)
    }
    this.save()
  }

  close(): void {
    // nothing to release; state is flushed on every mutation
  }
}

export function createStore(dataDir: string): MatrixStore {
  try {
    return new SqliteStore(dataDir)
  } catch (error) {
    console.error('better-sqlite3 indisponível, usando armazenamento JSON:', error)
    return new JsonStore(dataDir)
  }
}
