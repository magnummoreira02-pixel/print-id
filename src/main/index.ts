import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createStore } from './store'
import { SettingsManager } from './settings'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | null = null

/**
 * O app chamava "magnun-etiquetas"; a pasta de dados muda com o nome.
 * Migra banco e configurações da pasta antiga na primeira execução.
 */
function migrateLegacyUserData(dataDir: string): void {
  const legacyDir = join(app.getPath('appData'), 'magnun-etiquetas')
  if (!existsSync(legacyDir)) return
  const marker = ['settings.json', 'magnun.db', 'magnun-data.json']
  if (marker.some((f) => existsSync(join(dataDir, f)))) return
  // Duas fases: copia tudo para nomes .tmp e só então renomeia para os nomes
  // finais (marcadores por último). Falha parcial não deixa marcador para
  // trás — a migração é retentada na próxima execução.
  const files = [
    'magnun.db-wal',
    'magnun.db-shm',
    'magnun-data.json',
    'magnun.db',
    'settings.json'
  ].filter((f) => existsSync(join(legacyDir, f)))
  if (files.length === 0) return
  try {
    mkdirSync(dataDir, { recursive: true })
    for (const file of files) {
      copyFileSync(join(legacyDir, file), join(dataDir, `${file}.migtmp`))
    }
    for (const file of files) {
      renameSync(join(dataDir, `${file}.migtmp`), join(dataDir, file))
    }
    console.log('Dados migrados de', legacyDir)
  } catch (error) {
    console.error('Falha ao migrar dados antigos (será retentado):', error)
    for (const file of files) {
      try {
        rmSync(join(dataDir, `${file}.migtmp`), { force: true })
      } catch {
        // limpeza opcional
      }
    }
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0c0e11',
    title: 'Print ID',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Instância única: uma segunda cópia do app compartilharia o banco e a fila
// de impressão — em vez disso, foca a janela já aberta
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  // app.quit() da segunda instância não interrompe o whenReady:
  // sem o lock, não migrar/abrir banco/criar janela
  if (!gotSingleInstanceLock) return

  electronApp.setAppUserModelId('br.com.bitred.printid')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const dataDir = app.getPath('userData')
  migrateLegacyUserData(dataDir)
  const store = createStore(dataDir)
  const settings = new SettingsManager(dataDir)

  registerIpc({ store, settings, getMainWindow: () => mainWindow })

  app.on('before-quit', () => {
    store.close()
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
