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
} from './types'

export interface BitredApi {
  importMatrix: () => Promise<ImportResult>
  getMatrix: () => Promise<MatrixPayload | null>
  updateCell: (rowId: number, column: string, value: CellValue) => Promise<void>
  exportMatrix: (format: 'xlsx' | 'csv') => Promise<ExportResult>
  lookup: (code: string) => Promise<ScanResult>
  printLabels: (rowIds: number[]) => Promise<PrintResult>
  printTest: () => Promise<PrintResult>
  previewLabels: (rowIds: number[]) => Promise<string>
  listPrinters: () => Promise<PrinterInfo[]>
  getSettings: () => Promise<AppSettings>
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  exportTemplate: (templateId: string) => Promise<TemplateExportResult>
  importTemplate: () => Promise<TemplateImportResult>
  appInfo: () => Promise<AppInfo>
  /** Apaga todos os dados (matriz, modelos, configurações) e reinicia o app */
  resetApp: () => Promise<void>
  /** Abre o desinstalador do Windows e fecha o app (só no app instalado) */
  uninstallApp: () => Promise<boolean>
}
