// Abstrai impressão: tenta via Electron IPC, senão simula fila
export type PrintJob = { id:string, zpl:string, printer:string, ts:string, status:'ok'|'erro'|'filado' }
const queue: PrintJob[] = []

export async function listPrinters(): Promise<string[]>{
  // @ts-ignore
  if(window.electronAPI?.listPrinters) return await window.electronAPI.listPrinters()
  // fallback mock com destaque Zebra
  return ['Microsoft Print to PDF','ZDesigner ZD220-203dpi ZPL','ZDesigner ZT411-300dpi ZPL','HP LaserJet']
}

export async function printZPL(zpl:string, printer:string, opts:{ip?:string,port?:number, conexao:string}){
  // @ts-ignore
  if(window.electronAPI?.printRaw){
    try{
      // @ts-ignore
      await window.electronAPI.printRaw({zpl, printer, ...opts})
      const j={id:Date.now().toString(), zpl, printer, ts:new Date().toISOString(), status:'ok' as const}
      queue.push(j); return j
    }catch(e:any){
      const j={id:Date.now().toString(), zpl, printer, ts:new Date().toISOString(), status:'erro' as const}
      queue.push(j); throw e
    }
  }
  // modo web: simula e registra em fila
  console.log('[PRINT SIMULADO]', printer, zpl.slice(0,120))
  const j={id:Date.now().toString(), zpl, printer, ts:new Date().toISOString(), status:'filado' as const}
  queue.push(j)
  // salva blob para debug
  const blob=new Blob([zpl],{type:'text/plain'}); const url=URL.createObjectURL(blob)
  // dispara download opcional? não automático
  return j
}
export function getQueue(){ return [...queue] }
