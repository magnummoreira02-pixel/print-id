import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { basename, dirname, extname, join } from 'path'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'
import type {
  AppInfo,
  AppSettings,
  CellValue,
  ExportResult,
  ImportResult,
  LabelTemplateFile,
  MatrixPayload,
  PrintResult,
  PrinterInfo,
  ScanResult,
  TemplateExportResult,
  TemplateImportResult
} from '../shared/types'
import type { MatrixStore } from './store'
import type { SettingsManager } from './settings'
import { normalizeTemplate } from '../shared/labelTemplate'
import { parseMatrixFile, detectScanColumn } from './importer'
import { writeMatrixFile } from './exporter'
import { buildLabelsHtml, sampleHeaders, sampleRow } from './labels'
import { listPrinters, printHtml } from './print'

interface IpcContext {
  store: MatrixStore
  settings: SettingsManager
  getMainWindow: () => BrowserWindow | null
}

function getPayload(store: MatrixStore): MatrixPayload | null {
  const meta = store.getMeta()
  if (!meta) return null
  return { meta, rows: store.getAllRows() }
}

export function registerIpc({ store, settings, getMainWindow }: IpcContext): void {
  ipcMain.handle('matrix:import', async (): Promise<ImportResult> => {
    try {
      const win = getMainWindow()
      if (!win) return { ok: false, error: 'Janela principal indisponível.' }
      const picked = await dialog.showOpenDialog(win, {
        title: 'Importar matriz',
        properties: ['openFile'],
        filters: [
          { name: 'Planilhas', extensions: ['xlsx', 'xls', 'csv'] },
          { name: 'Todos os arquivos', extensions: ['*'] }
        ]
      })
      if (picked.canceled || picked.filePaths.length === 0) return { ok: false, canceled: true }

      const filePath = picked.filePaths[0]
      const { headers, rows } = parseMatrixFile(filePath)
      const saved = settings.get().scanColumn
      const scanColumn = saved && headers.includes(saved) ? saved : detectScanColumn(headers)
      store.replaceAll(basename(filePath), headers, rows, scanColumn)
      settings.set({ scanColumn })
      return { ok: true, payload: getPayload(store)! }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('matrix:get', (): MatrixPayload | null => getPayload(store))

  ipcMain.handle(
    'matrix:update-cell',
    (_e, rowId: number, column: string, value: CellValue): void => {
      store.updateCell(rowId, column, value)
    }
  )

  ipcMain.handle('matrix:export', async (_e, format: 'xlsx' | 'csv'): Promise<ExportResult> => {
    const win = getMainWindow()
    const meta = store.getMeta()
    if (!win || !meta) return { ok: false, error: 'Nenhuma matriz importada.' }
    const base = basename(meta.fileName, extname(meta.fileName)) || 'matriz'
    const picked = await dialog.showSaveDialog(win, {
      title: 'Exportar matriz',
      defaultPath: `${base}-editada.${format}`,
      filters:
        format === 'xlsx'
          ? [{ name: 'Excel', extensions: ['xlsx'] }]
          : [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (picked.canceled || !picked.filePath) return { ok: false, canceled: true }
    try {
      writeMatrixFile(picked.filePath, meta, store.getAllRows(), format)
      return { ok: true, filePath: picked.filePath }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('scan:lookup', (_e, code: string): ScanResult => {
    const rows = store.findByCode(code)
    return { code, found: rows.length > 0, rows }
  })

  ipcMain.handle('print:labels', async (_e, rowIds: number[]): Promise<PrintResult> => {
    try {
      const rows = store.getRowsByIds(rowIds)
      if (rows.length === 0) {
        return { ok: false, printed: 0, error: 'Nenhuma linha para imprimir.' }
      }
      const headers = store.getMeta()?.headers ?? []
      const cfg = settings.get()
      const template = settings.getActiveTemplate()
      const html = await buildLabelsHtml(rows, template, headers)
      return await printHtml(
        html,
        {
          printerName: cfg.printerName,
          widthMm: template.widthMm,
          heightMm: template.heightMm,
          copies: cfg.copies
        },
        rows.length
      )
    } catch (error) {
      return {
        ok: false,
        printed: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  ipcMain.handle('print:test', async (): Promise<PrintResult> => {
    try {
      const cfg = settings.get()
      const template = settings.getActiveTemplate()
      const html = await buildLabelsHtml([sampleRow()], template, sampleHeaders())
      // etiqueta de teste sai sempre em cópia única
      return await printHtml(
        html,
        {
          printerName: cfg.printerName,
          widthMm: template.widthMm,
          heightMm: template.heightMm,
          copies: 1
        },
        1
      )
    } catch (error) {
      return {
        ok: false,
        printed: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  ipcMain.handle('print:preview', async (_e, rowIds: number[]): Promise<string> => {
    const template = settings.getActiveTemplate()
    if (rowIds.length === 0) {
      return buildLabelsHtml([sampleRow()], template, sampleHeaders())
    }
    const rows = store.getRowsByIds(rowIds)
    const headers = store.getMeta()?.headers ?? []
    return buildLabelsHtml(rows, template, headers)
  })

  ipcMain.handle(
    'templates:export',
    async (_e, templateId: string): Promise<TemplateExportResult> => {
      const win = getMainWindow()
      const template = settings.get().templates.find((t) => t.id === templateId)
      if (!win || !template) return { ok: false, error: 'Modelo não encontrado.' }
      const safeName = template.name.replace(/[\\/:*?"<>|]/g, '-')
      const picked = await dialog.showSaveDialog(win, {
        title: 'Exportar modelo de etiqueta',
        defaultPath: `${safeName}.etiqueta.json`,
        filters: [{ name: 'Modelo de etiqueta', extensions: ['json'] }]
      })
      if (picked.canceled || !picked.filePath) return { ok: false, canceled: true }
      try {
        const file: LabelTemplateFile = { bitredLabelTemplate: 1, template }
        writeFileSync(picked.filePath, JSON.stringify(file, null, 2), 'utf-8')
        return { ok: true, filePath: picked.filePath }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle('templates:import', async (): Promise<TemplateImportResult> => {
    const win = getMainWindow()
    if (!win) return { ok: false, error: 'Janela principal indisponível.' }
    const picked = await dialog.showOpenDialog(win, {
      title: 'Importar modelo de etiqueta',
      properties: ['openFile'],
      filters: [
        { name: 'Modelo de etiqueta', extensions: ['json'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    })
    if (picked.canceled || picked.filePaths.length === 0) return { ok: false, canceled: true }
    try {
      const parsed = JSON.parse(readFileSync(picked.filePaths[0], 'utf-8'))
      // aceita também arquivos exportados antes do rebrand
      const raw =
        parsed?.bitredLabelTemplate === 1 || parsed?.magnunLabelTemplate === 1
          ? parsed.template
          : parsed
      const template = normalizeTemplate(raw)
      if (!template) {
        return { ok: false, error: 'O arquivo não contém um modelo de etiqueta válido.' }
      }
      return { ok: true, template }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('printers:list', async (): Promise<PrinterInfo[]> => {
    const win = getMainWindow()
    if (!win) return []
    return listPrinters(win)
  })

  ipcMain.handle('settings:get', (): AppSettings => settings.get())

  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>): AppSettings => {
    const before = settings.get()
    const after = settings.set(patch)
    if (patch.scanColumn && patch.scanColumn !== before.scanColumn && store.getMeta()) {
      store.reindex(patch.scanColumn)
    }
    return after
  })

  const uninstallerPath = (): string | null => {
    if (!app.isPackaged) return null
    const dir = dirname(app.getPath('exe'))
    // o electron-builder nomeia como "Uninstall <nome>.exe" — varre a pasta
    // para não depender de qual nome (package vs product) foi usado
    try {
      const found = readdirSync(dir).find((f) => /^uninstall .*\.exe$/i.test(f))
      return found ? join(dir, found) : null
    } catch {
      return null
    }
  }

  ipcMain.handle('app:info', (): AppInfo => {
    return {
      version: app.getVersion(),
      storageBackend: store.backend,
      dataPath: app.getPath('userData'),
      canUninstall: uninstallerPath() !== null
    }
  })

  ipcMain.handle('app:uninstall', (): boolean => {
    const path = uninstallerPath()
    if (!path) return false
    spawn(path, [], { detached: true, stdio: 'ignore' }).unref()
    app.quit()
    return true
  })

  ipcMain.handle('app:reset', (): void => {
    try {
      store.close()
    } catch {
      // banco já fechado
    }
    const dataDir = app.getPath('userData')
    for (const file of [
      'settings.json',
      'bitred.db',
      'bitred.db-wal',
      'bitred.db-shm',
      'bitred-data.json',
      'magnun.db',
      'magnun.db-wal',
      'magnun.db-shm',
      'magnun-data.json'
    ]) {
      rmSync(join(dataDir, file), { force: true })
    }
    // sem isso, a migração da pasta legada ressuscitaria os dados antigos
    rmSync(join(app.getPath('appData'), 'magnun-etiquetas'), { recursive: true, force: true })
    app.relaunch()
    app.exit(0)
  })
}
