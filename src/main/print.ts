import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFileSync, unlink } from 'fs'
import type { PrinterInfo, PrintResult } from '../shared/types'
import { sheetLayout } from './labels'

export async function listPrinters(win: BrowserWindow): Promise<PrinterInfo[]> {
  const printers = await win.webContents.getPrintersAsync()
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName || p.name,
    // Electron não expõe mais a impressora padrão do sistema
    isDefault: false
  }))
}

export interface PrintJobOptions {
  printerName: string | null
  widthMm: number
  heightMm: number
  copies: number
}

let printSeq = 0

export async function printHtml(
  html: string,
  job: PrintJobOptions,
  labelCount: number
): Promise<PrintResult> {
  if (!job.printerName) {
    return {
      ok: false,
      printed: 0,
      error: 'Nenhuma impressora configurada. Selecione uma na tela de Configurações.'
    }
  }

  const tmpPath = join(app.getPath('temp'), `bitred-labels-${process.pid}-${++printSeq}.html`)
  writeFileSync(tmpPath, html, 'utf-8')

  const win = new BrowserWindow({
    show: false,
    width: 500,
    height: 400,
    webPreferences: { sandbox: true }
  })

  const copies = Math.max(1, job.copies)
  const sheet = sheetLayout(Math.max(1, labelCount))
  const pageSize = {
    width: Math.round(job.widthMm * sheet.columns * 1000),
    height: Math.round(job.heightMm * sheet.rows * 1000)
  }
  const baseOptions: Electron.WebContentsPrintOptions = {
    silent: true,
    deviceName: job.printerName,
    printBackground: true,
    copies,
    margins: { marginType: 'none' }
  }

  const attempt = (withPageSize: boolean): Promise<{ ok: boolean; reason: string }> =>
    new Promise((resolve) => {
      const options = withPageSize
        ? {
            ...baseOptions,
            pageSize
          }
        : baseOptions
      win.webContents.print(options, (success, failureReason) => {
        resolve({ ok: success, reason: failureReason || '' })
      })
    })

  try {
    await win.loadFile(tmpPath)
    // 1ª tentativa: tamanho de página customizado (mm da etiqueta).
    // Alguns drivers rejeitam páginas menores que o mínimo suportado
    // ("Printer settings invalid"); nesse caso tenta de novo com o papel
    // padrão configurado no driver — o cenário usual de térmicas no Windows.
    let result = await attempt(true)
    if (!result.ok) {
      result = await attempt(false)
    }
    if (result.ok) {
      return { ok: true, printed: labelCount * copies }
    }
    return {
      ok: false,
      printed: 0,
      error: result.reason || 'Falha ao imprimir. Verifique a impressora.'
    }
  } catch (error) {
    return { ok: false, printed: 0, error: String(error) }
  } finally {
    win.destroy()
    unlink(tmpPath, () => {})
  }
}
