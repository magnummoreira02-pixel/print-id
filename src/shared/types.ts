export type CellValue = string | number | null

export type RowData = Record<string, CellValue>

export interface MatrixRow {
  id: number
  data: RowData
}

export interface MatrixMeta {
  headers: string[]
  fileName: string
  importedAt: string
  rowCount: number
}

export interface MatrixPayload {
  meta: MatrixMeta
  rows: MatrixRow[]
}

/**
 * Campos semânticos do modelo impresso: permitem resolver a coluna da matriz
 * automaticamente mesmo quando o nome muda por safra ("ID 25-25" → "ID 26-26")
 */
export type LabelField =
  | 'boxB'
  | 'boxL'
  | 'serpentine'
  | 'trait'
  | 'entryPrefix'
  | 'entrySuffix'
  | 'boxLetter'
  | 'id'
  | 'seedPac'
  | 'quadra'
  | 'local'

export type LabelRotation = 0 | 90 | 270
export type LabelAlign = 'left' | 'center' | 'right'

interface LabelElementBase {
  id: string
  /** Posição do canto superior esquerdo, em mm a partir do canto da etiqueta */
  x: number
  y: number
  visible: boolean
}

/** Valor vindo da matriz (uma ou mais colunas concatenadas) */
export interface LabelFieldElement extends LabelElementBase {
  type: 'field'
  /** Campos semânticos resolvidos automaticamente (ordem preservada) */
  autos: LabelField[]
  /** Colunas explícitas; quando não-vazio, substitui `autos` */
  columns: string[]
  separator: string
  /** Texto estático impresso antes do valor (ex.: "Q-") */
  prefix: string
  fontSizeMm: number
  bold: boolean
  align: LabelAlign
  rotation: LabelRotation
  /** Borda ao redor do valor */
  boxed: boolean
  borderMm: number
  /** Largura/altura fixas em mm; null = ajusta ao conteúdo */
  widthMm: number | null
  heightMm: number | null
}

export interface LabelTextElement extends LabelElementBase {
  type: 'text'
  text: string
  fontSizeMm: number
  bold: boolean
  align: LabelAlign
  rotation: LabelRotation
}

/** Retângulo simples (só borda) */
export interface LabelBoxElement extends LabelElementBase {
  type: 'box'
  widthMm: number
  heightMm: number
  borderMm: number
}

export interface LabelQrElement extends LabelElementBase {
  type: 'qr'
  sizeMm: number
  /** Colunas concatenadas no conteúdo; vazio = coluna do ID (auto) */
  columns: string[]
  separator: string
}

export type LabelElement = LabelFieldElement | LabelTextElement | LabelBoxElement | LabelQrElement

export interface LabelTemplate {
  id: string
  name: string
  widthMm: number
  heightMm: number
  elements: LabelElement[]
}

/** Formato do arquivo de exportação de modelos (.json) */
export interface LabelTemplateFile {
  bitredLabelTemplate: 1
  template: LabelTemplate
}

export interface TemplateImportResult {
  ok: boolean
  canceled?: boolean
  error?: string
  template?: LabelTemplate
}

export interface TemplateExportResult {
  ok: boolean
  canceled?: boolean
  error?: string
  filePath?: string
}

export interface AppSettings {
  printerName: string | null
  scanColumn: string | null
  copies: number
  templates: LabelTemplate[]
  activeTemplateId: string | null
}

export interface PrinterInfo {
  name: string
  displayName: string
  isDefault: boolean
}

export interface ScanResult {
  code: string
  found: boolean
  rows: MatrixRow[]
}

export interface PrintResult {
  ok: boolean
  printed: number
  error?: string
}

export interface ImportResult {
  ok: boolean
  canceled?: boolean
  error?: string
  payload?: MatrixPayload
}

export interface ExportResult {
  ok: boolean
  canceled?: boolean
  error?: string
  filePath?: string
}

export interface AppInfo {
  version: string
  storageBackend: 'sqlite' | 'json'
  dataPath: string
  /** true quando o app está instalado e o desinstalador NSIS existe */
  canUninstall: boolean
}
