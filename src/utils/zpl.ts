import type { LabelModel, LabelElement } from '../store/useStore'

export function mmToDots(mm:number, dpi:number){ return Math.round((mm/25.4)*dpi) }

export function buildZPL(model: LabelModel, rows: Record<string,any>[], dpi: number, opts:{offsetX?:number, offsetY?:number, velocidade?:number, densidade?:number}={}){
  const dpiNum = dpi
  const pw = mmToDots(pageWidth(model), dpiNum)
  const ll = mmToDots(model.altura + model.margemTop + model.margemBottom, dpiNum)
  let z = ''
  // calcula passes (agrupamento por colunas)
  const colunas = Math.max(1, model.colunas)
  const copies = Math.max(1, model.copiasPorLinha)
  // expande rows * copies
  const expanded: Record<string,any>[] = []
  rows.forEach(r=>{ for(let i=0;i<copies;i++) expanded.push(r) })
  // agrupa em lotes de colunas
  for(let i=0;i<expanded.length;i+=colunas){
    const chunk = expanded.slice(i, i+colunas)
    z += `^XA\n`
    if(opts.velocidade) z+=`^PR${opts.velocidade}\n`
    if(opts.densidade) z+=`~SD${opts.densidade}\n`
    z+=`^PW${pw}\n^LL${ll}\n^LH${mmToDots((opts.offsetX||0),dpiNum)},${mmToDots((opts.offsetY||0),dpiNum)}\n`
    chunk.forEach((row, colIdx)=>{
      const xOffsetMm = colIdx * (model.largura + model.gapH)
      const xOffsetDots = mmToDots(xOffsetMm, dpiNum)
      model.elementos.forEach(el=>{
        const fx = mmToDots(el.x, dpiNum) + xOffsetDots
        const fy = mmToDots(el.y, dpiNum)
        const fw = mmToDots(el.w, dpiNum)
        const fh = mmToDots(el.h, dpiNum)
        const fieldVal = resolveField(el, row)
        if(el.type==='text'){
          const hDots = mmToDots((el.fontSize||3)*0.3528, dpiNum) // aproximado
          const orientation = zplOrientation(el.rotation)
          const font = el.bold ? 'A0' : 'A0'
          z+=`^FO${fx},${fy}^${font}${orientation},${Math.round(hDots)},${Math.round(hDots)}^FD${escapeZPL(fieldVal)}^FS\n`
        } else if(el.type==='qrcode'){
          const mag = Math.max(2, Math.round(fw/30))
          z+=`^FO${fx},${fy}^BQN,2,${mag}^FDLA,${escapeZPL(fieldVal)}^FS\n`
        } else if(el.type==='code128'){
          z+=`^FO${fx},${fy}^BCN,${fh},Y,N,A^FD${escapeZPL(fieldVal)}^FS\n`
        } else if(el.type==='code39'){
          z+=`^FO${fx},${fy}^B3N,N,${fh},Y,N^FD${escapeZPL(fieldVal)}^FS\n`
        } else if(el.type==='datamatrix'){
          z+=`^FO${fx},${fy}^BXN,${Math.max(4, Math.round(fw/24))},200^FD${escapeZPL(fieldVal)}^FS\n`
        } else if(el.type==='ean13'){
          z+=`^FO${fx},${fy}^BEN,${fh},Y,N^FD${escapeZPL(fieldVal)}^FS\n`
        } else if(el.type==='rect'){
          z+=`^FO${fx},${fy}^GB${fw},${fh},${el.thickness||1}^FS\n`
        } else if(el.type==='line'){
          z+=`^FO${fx},${fy}^GB${fw},${el.thickness||1},${el.thickness||1}^FS\n`
        }
      })
    })
    z+=`^XZ\n`
  }
  return z
}

function pageWidth(m:LabelModel){
  if(m.definirManual) return m.largura // fallback
  return m.margemLeft + m.margemRight + m.colunas*m.largura + (m.colunas-1)*m.gapH
}
export function pageSizeCalc(m:LabelModel){
  const w = m.margemLeft + m.margemRight + m.colunas*m.largura + (m.colunas-1)*m.gapH
  const h = m.margemTop + m.margemBottom + m.altura
  return {w,h}
}
function resolveField(el:LabelElement, row:Record<string,any>){
  let value = ''
  if(!el.field) value = el.text||''
  else if(el.field.startsWith('"') && el.field.endsWith('"')) value = el.field.slice(1,-1)
  else value = String(row[el.field] ?? el.text ?? '')
  return `${el.prefix || ''}${value}`
}
function escapeZPL(s:string){ return s.replace(/[\^~]/g,' ') }

function zplOrientation(rotation:number|undefined){
  const normalized = ((rotation||0)%360+360)%360
  if(normalized===90) return 'R'
  if(normalized===180) return 'I'
  if(normalized===270) return 'B'
  return 'N'
}
