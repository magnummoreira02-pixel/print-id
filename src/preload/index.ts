import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AppInfo,
  AppSettings,
  CellValue,
  ExportResult,
  ImportResult,
  MatrixPayload,
  PrintResult,
  PrinterInfo,
  ScanResult,
  TemplateExportResult,
  TemplateImportResult
} from '../shared/types'
import type { BitredApi } from '../shared/api'

const api: BitredApi = {
  importMatrix: (): Promise<ImportResult> => ipcRenderer.invoke('matrix:import'),
  getMatrix: (): Promise<MatrixPayload | null> => ipcRenderer.invoke('matrix:get'),
  updateCell: (rowId: number, column: string, value: CellValue): Promise<void> =>
    ipcRenderer.invoke('matrix:update-cell', rowId, column, value),
  exportMatrix: (format: 'xlsx' | 'csv'): Promise<ExportResult> =>
    ipcRenderer.invoke('matrix:export', format),
  lookup: (code: string): Promise<ScanResult> => ipcRenderer.invoke('scan:lookup', code),
  printLabels: (rowIds: number[]): Promise<PrintResult> =>
    ipcRenderer.invoke('print:labels', rowIds),
  printTest: (): Promise<PrintResult> => ipcRenderer.invoke('print:test'),
  previewLabels: (rowIds: number[]): Promise<string> => ipcRenderer.invoke('print:preview', rowIds),
  listPrinters: (): Promise<PrinterInfo[]> => ipcRenderer.invoke('printers:list'),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),
  exportTemplate: (templateId: string): Promise<TemplateExportResult> =>
    ipcRenderer.invoke('templates:export', templateId),
  importTemplate: (): Promise<TemplateImportResult> => ipcRenderer.invoke('templates:import'),
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  resetApp: (): Promise<void> => ipcRenderer.invoke('app:reset'),
  uninstallApp: (): Promise<boolean> => ipcRenderer.invoke('app:uninstall')
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error('Falha ao expor a API auxiliar do Electron:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.electron = electronAPI
}
