import { reactive } from 'vue'
import type { CellValue, ExportResult, ImportResult, MatrixPayload } from '@shared/types'
import { useSettings } from './useSettings'

interface MatrixState {
  payload: MatrixPayload | null
  loading: boolean
  loaded: boolean
}

const state = reactive<MatrixState>({
  payload: null,
  loading: false,
  loaded: false
})

async function refresh(): Promise<void> {
  state.loading = true
  try {
    state.payload = await window.api.getMatrix()
    state.loaded = true
  } finally {
    state.loading = false
  }
}

async function importFile(): Promise<ImportResult> {
  state.loading = true
  try {
    const result = await window.api.importMatrix()
    if (result.ok && result.payload) {
      state.payload = result.payload
      state.loaded = true
      // o import pode ter trocado a scanColumn no main (cabeçalhos novos)
      await useSettings().load()
    }
    return result
  } finally {
    state.loading = false
  }
}

async function updateCell(rowId: number, column: string, value: CellValue): Promise<void> {
  await window.api.updateCell(rowId, column, value)
  const row = state.payload?.rows.find((r) => r.id === rowId)
  if (row) row.data[column] = value
}

async function exportFile(format: 'xlsx' | 'csv'): Promise<ExportResult> {
  return window.api.exportMatrix(format)
}

export function useMatrix(): {
  state: MatrixState
  refresh: typeof refresh
  importFile: typeof importFile
  updateCell: typeof updateCell
  exportFile: typeof exportFile
} {
  return { state, refresh, importFile, updateCell, exportFile }
}
