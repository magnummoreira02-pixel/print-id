import { writeFileSync } from 'fs'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { MatrixMeta, MatrixRow } from '../shared/types'

export function writeMatrixFile(
  filePath: string,
  meta: MatrixMeta,
  rows: MatrixRow[],
  format: 'xlsx' | 'csv'
): void {
  const table = rows.map((r) => meta.headers.map((h) => r.data[h] ?? null))
  if (format === 'csv') {
    // Excel pt-BR (delimitador ';') espera vírgula decimal; inteiros ficam como estão
    const localized = table.map((row) =>
      row.map((v) =>
        typeof v === 'number' && !Number.isInteger(v) ? String(v).replace('.', ',') : v
      )
    )
    const csv = Papa.unparse(
      { fields: meta.headers, data: localized },
      { delimiter: ';', newline: '\r\n' }
    )
    // BOM para o Excel pt-BR abrir com acentuação correta
    writeFileSync(filePath, '﻿' + csv, 'utf-8')
    return
  }
  const ws = XLSX.utils.aoa_to_sheet([meta.headers, ...table])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha1')
  XLSX.writeFile(wb, filePath)
}
