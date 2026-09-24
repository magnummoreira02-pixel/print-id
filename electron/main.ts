import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

let win: BrowserWindow|null=null
function create(){
  win=new BrowserWindow({
    width:1280, height:800, minWidth:900, minHeight:600,
    frame:false, titleBarStyle:'hidden',
    webPreferences:{ preload: join(__dirname,'preload.js'), contextIsolation:true, nodeIntegration:false }
  })
  const dev = !app.isPackaged
  if(dev) win.loadURL('http://localhost:5173')
  else win.loadFile(join(__dirname,'../dist/index.html'))
}
app.whenReady().then(create)
ipcMain.handle('listPrinters', async()=>{
  // TODO: enumerate via powershell Get-Printer
  return ['ZDesigner ZD220-203dpi ZPL','ZDesigner ZT411-300dpi ZPL']
})
ipcMain.handle('printRaw', async(_, data:{zpl:string, printer:string})=>{
  console.log('PRINT RAW', data.printer, data.zpl.slice(0,80))
  return {ok:true}
})
ipcMain.on('windowControl', (_, action:string)=>{
  if(!win) return
  if(action==='minimize') win.minimize()
  if(action==='maximize') win.isMaximized()? win.unmaximize(): win.maximize()
  if(action==='close') win.close()
})
app.on('window-all-closed', ()=>{ if(process.platform!=='darwin') app.quit() })
