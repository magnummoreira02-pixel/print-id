import { readFileSync } from 'fs'
import { extname } from 'path'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { CellValue, RowData } from '../shared/types'

export interface ParsedMatrix {
  headers: string[]
  rows: RowData[]
}

const BOM = String.fromCharCode(0xfeff)

function stripBom(s: string): string {
  return s.startsWith(BOM) ? s.slice(1) : s
}

function decodeCsvBuffer(buf: Buffer): string {
  // BOMs UTF-16 (Excel "Texto Unicode")
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return stripBom(buf.toString('utf16le'))
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return buf.subarray(2).swap16().toString('utf16le')
  }
  const utf8 = buf.toString('utf-8')
  // Heurística: se a decodificação UTF-8 produziu caracteres de substituição,
  // o arquivo provavelmente está em latin1 (comum em CSVs gerados no Excel pt-BR)
  if (utf8.includes('�')) return buf.toString('latin1')
  return stripBom(utf8)
}

/**
 * Converte texto em número apenas quando a conversão é reversível sem perda:
 * "5243" vira 5243, mas "00123" (zeros à esquerda), "5E3" (notação
 * exponencial) e "1.10" (zero final) permanecem strings.
 */
function safeNumber(s: string): CellValue {
  if (!/^-?\d+(\.\d+)?$/.test(s)) return s
  const n = Number(s)
  return String(n) === s ? n : s
}

function normalizeCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const s = String(value).trim()
  if (s === '') return null
  return safeNumber(s)
}

function buildHeaders(headerRow: unknown[], dataRows: unknown[][]): string[] {
  // A largura real considera também as linhas de dados: colunas com valores
  // mas sem célula de cabeçalho recebem o placeholder "Coluna N"
  const width = Math.max(headerRow.length, ...dataRows.map((r) => r.length), 0)
  const headers: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < width; i++) {
    let name = String(headerRow[i] ?? '').trim()
    if (name === '') name = `Coluna ${i + 1}`
    let unique = name
    let n = 2
    while (seen.has(unique)) {
      unique = `${name} (${n})`
      n++
    }
    seen.add(unique)
    headers.push(unique)
  }
  // remove colunas do final que não têm cabeçalho NEM nenhum dado
  const columnHasData = (i: number): boolean =>
    dataRows.some((r) => {
      const v = r[i]
      return v !== null && v !== undefined && String(v).trim() !== ''
    })
  while (headers.length > 0) {
    const last = headers.length - 1
    const headerEmpty = String(headerRow[last] ?? '').trim() === ''
    if (headerEmpty && !columnHasData(last)) {
      headers.pop()
    } else {
      break
    }
  }
  return headers
}

function rowsFromArrays(headers: string[], arrays: unknown[][]): RowData[] {
  const rows: RowData[] = []
  for (const arr of arrays) {
    const data: RowData = {}
    let hasValue = false
    headers.forEach((h, i) => {
      const v = normalizeCell(arr[i])
      data[h] = v
      if (v !== null) hasValue = true
    })
    if (hasValue) rows.push(data)
  }
  return rows
}

export function parseMatrixFile(filePath: string): ParsedMatrix {
  const ext = extname(filePath).toLowerCase()
  let arrays: unknown[][]

  if (ext === '.csv' || ext === '.txt') {
    const text = decodeCsvBuffer(readFileSync(filePath))
    // Sem dynamicTyping: a conversão numérica segura fica em normalizeCell,
    // que preserva zeros à esquerda e notação exponencial como texto
    const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
    if (result.errors.length > 0 && result.data.length === 0) {
      throw new Error(`Falha ao ler CSV: ${result.errors[0].message}`)
    }
    arrays = result.data
  } else {
    const wb = XLSX.read(readFileSync(filePath), { type: 'buffer', cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) throw new Error('A planilha não contém abas.')
    arrays = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null
    }) as unknown[][]
  }

  if (arrays.length < 2) {
    throw new Error('O arquivo precisa ter uma linha de cabeçalho e ao menos uma linha de dados.')
  }

  const dataRows = arrays.slice(1)
  const headers = buildHeaders(arrays[0], dataRows)
  if (headers.length === 0) throw new Error('Não foi possível identificar os cabeçalhos.')
  return { headers, rows: rowsFromArrays(headers, dataRows) }
}

export function detectScanColumn(headers: string[]): string {
  return (
    headers.find((h) => /^id\b/i.test(h)) ?? headers.find((h) => /\bid\b/i.test(h)) ?? headers[0]
  )
}
