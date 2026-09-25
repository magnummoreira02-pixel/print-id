import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

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
  if(process.platform !== 'win32') return []
  try{
    const result = await execFileAsync('powershell.exe', ['-NoProfile','-NonInteractive','-Command', 'Get-Printer | Select-Object -ExpandProperty Name'], { windowsHide:true })
    return result.stdout.split(/\r?\n/).map(name=>name.trim()).filter(Boolean)
  }catch(error){
    console.error('Não foi possível enumerar as impressoras do Windows', error)
    return []
  }
})
ipcMain.handle('printRaw', async(_, data:{zpl:string, printer:string, conexao?:string})=>{
  if(!data.printer) throw new Error('Selecione uma impressora antes de imprimir.')
  if((data.conexao === 'usb' || data.conexao === 'spooler') && process.platform === 'win32'){
    await sendRawToWindowsPrinter(data.printer, data.zpl)
    return {ok:true}
  }
  console.log('PRINT RAW', data.printer, data.zpl.slice(0,80))
  return {ok:true}
})

async function sendRawToWindowsPrinter(printer:string, zpl:string){
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class PrintIdRawSpooler {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)] static extern int StartDocPrinter(IntPtr handle, int level, [In] DocInfo doc);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr handle, byte[] data, int count, out int written);
  public static void Send(string printer, byte[] data) {
    IntPtr handle;
    if(!OpenPrinter(printer, out handle, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      var doc = new DocInfo { pDocName = "Print ID ZPL", pDataType = "RAW", pOutputFile = null };
      if(StartDocPrinter(handle, 1, doc) == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
      try {
        if(!StartPagePrinter(handle)) throw new Win32Exception(Marshal.GetLastWin32Error());
        try { int written; if(!WritePrinter(handle, data, data.Length, out written) || written != data.Length) throw new Win32Exception(Marshal.GetLastWin32Error()); }
        finally { EndPagePrinter(handle); }
      } finally { EndDocPrinter(handle); }
    } finally { ClosePrinter(handle); }
  }
}
'@
$bytes = [Convert]::FromBase64String($env:PRINT_ID_ZPL)
[PrintIdRawSpooler]::Send($env:PRINT_ID_PRINTER, $bytes)
`
  await execFileAsync('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command', script], {
    windowsHide:true,
    env:{...process.env, PRINT_ID_PRINTER:printer, PRINT_ID_ZPL:Buffer.from(zpl,'utf8').toString('base64')}
  })
}
ipcMain.on('windowControl', (_, action:string)=>{
  if(!win) return
  if(action==='minimize') win.minimize()
  if(action==='maximize') win.isMaximized()? win.unmaximize(): win.maximize()
  if(action==='close') win.close()
})
app.on('window-all-closed', ()=>{ if(process.platform!=='darwin') app.quit() })
