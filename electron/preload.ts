import { contextBridge, ipcRenderer } from 'electron'
contextBridge.exposeInMainWorld('electronAPI',{
  listPrinters: ()=> ipcRenderer.invoke('listPrinters'),
  printRaw: (d:any)=> ipcRenderer.invoke('printRaw', d),
  windowControl: (a:string)=> ipcRenderer.send('windowControl', a)
})
