import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LabelElement = {
  id: string
  type: 'text' | 'qrcode' | 'code128' | 'code39' | 'datamatrix' | 'ean13' | 'rect' | 'line'
  x: number; y: number; w: number; h: number
  rotation?: number
  field?: string // coluna vinculada ou texto fixo se começa com "
  text?: string
  fontSize?: number; bold?: boolean; align?: 'left'|'center'|'right'
  thickness?: number
}

export type LabelModel = {
  id: string
  nome: string
  largura: number // mm
  altura: number
  linhas: number
  colunas: number
  margemTop: number; margemLeft: number; margemBottom: number; margemRight: number
  gapH: number; gapV: number
  copiasPorLinha: number
  definirManual: boolean
  elementos: LabelElement[]
  ativo?: boolean
}

export type HistoryEntry = {
  id: string
  ts: string // ISO
  codigo: string
  colunaChave: string
  encontrado: boolean
  qtdLinhas: number
  qtdEtiquetas: number
  modeloId: string
  modeloNome: string
  impressora: string
  statusImpressao: 'IMPRESSO'|'NAO_ENCONTRADO'|'ERRO'|'FILADO'
  linhas?: Record<string, any>[]
  erro?: string
}

type State = {
  tema: 'dark'|'light'
  aba: 'bipagem'|'dados'|'config'
  impressaoAutomatica: boolean
  colunaChave: string
  headers: string[]
  rows: Record<string, any>[]
  matrizMeta: { arquivo: string; data: string; qtd: number } | null
  // busca index
  config: {
    dpi: 203|300|600
    velocidade: number
    densidade: number
    modoTermico: 'transferencia'|'direta'
    tipoMidia: 'gap'|'marca-preta'|'continua'
    offsetX: number; offsetY: number
    orientacao: 0|90|180|270
    impressora: string
    conexao: 'spooler'|'tcp'|'usb'
    ip?: string; porta?: number
    repeticaoUltima: boolean
    prefixoRemover: string; sufixoRemover: string; ignoreCase: boolean
  }
  modelos: LabelModel[]
  modeloAtivoId: string
  historico: HistoryEntry[]
  historicoSessao: HistoryEntry[] // view only session (also persisted separately but clearable)
  // filtros dados
  addHistory: (e: HistoryEntry) => void
  clearSessao: () => void
  setTema: (t:'dark'|'light')=>void
  setAba: (a:State['aba'])=>void
  setRows: (h:string[], r:Record<string,any>[], meta:State['matrizMeta'])=>void
  setColunaChave: (c:string)=>void
  updateRow: (idx:number, col:string, val:any)=>void
  addRow: (row:Record<string,any>)=>void
  deleteRow: (idx:number)=>void
  setModelos: (m:LabelModel[])=>void
  setModeloAtivo: (id:string)=>void
  setConfig: (c:Partial<State['config']>)=>void
  setImpressaoAutomatica: (v:boolean)=>void
}

const defaultModelo: LabelModel = {
  id: 'modelo-455x18-2col',
  nome: 'Padrão 45,5 × 18 mm (2 colunas)',
  largura: 45.5, altura: 18,
  linhas: 1, colunas: 2,
  margemTop: 1, margemLeft: 1, margemBottom: 1, margemRight: 1,
  gapH: 3, gapV: 2,
  copiasPorLinha: 1,
  definirManual: false,
  ativo: true,
  elementos: [
    { id:'e1', type:'qrcode', x:1, y:1, w:14, h:14, field:'ID' },
    { id:'e2', type:'text', x:16, y:1, w:27, h:4, field:'ID', fontSize:7, bold:true, align:'left' },
    { id:'e3', type:'text', x:16, y:5, w:27, h:3, field:'ENTRY', fontSize:5, align:'left' },
    { id:'e4', type:'text', x:16, y:8, w:27, h:3, field:'TRAIT/HERBICIDE', fontSize:5, align:'left' },
    { id:'e5', type:'text', x:16, y:11, w:27, h:3, field:'WHERE PLACED', fontSize:5, align:'left' },
    { id:'e6', type:'rect', x:0.5, y:0.5, w:44.5, h:17, thickness:1 },
  ]
}

export const useStore = create<State>()(persist((set,get)=>({
  tema: 'dark',
  aba: 'bipagem',
  impressaoAutomatica: true,
  colunaChave: 'ID',
  headers: [],
  rows: [],
  matrizMeta: null,
  config: {
    dpi: 203, velocidade: 4, densidade: 12, modoTermico: 'transferencia',
    tipoMidia: 'gap', offsetX:0, offsetY:0, orientacao:0,
    impressora: '', conexao:'spooler', porta:9100,
    repeticaoUltima:false, prefixoRemover:'', sufixoRemover:'', ignoreCase:true
  },
  modelos: [defaultModelo],
  modeloAtivoId: defaultModelo.id,
  historico: [],
  historicoSessao: [],
  addHistory: (e)=> set(s=>({ historico:[e,...s.historico], historicoSessao:[e,...s.historicoSessao]})),
  clearSessao: ()=> set({ historicoSessao:[]}),
  setTema: (tema)=> set({tema}),
  setAba: (aba)=> set({aba}),
  setRows: (headers, rows, matrizMeta)=> set({headers, rows, matrizMeta, colunaChave: headers.includes(get().colunaChave) ? get().colunaChave : (headers[0]||'') }),
  setColunaChave: (colunaChave)=> set({colunaChave}),
  updateRow: (idx,col,val)=> set(s=>{ const rows=[...s.rows]; rows[idx]={...rows[idx],[col]:val}; return {rows}}),
  addRow: (row)=> set(s=>({rows:[...s.rows,row]})),
  deleteRow: (idx)=> set(s=>({rows:s.rows.filter((_,i)=>i!==idx)})),
  setModelos: (modelos)=> set({modelos}),
  setModeloAtivo: (id)=> set(s=>({modeloAtivoId:id, modelos:s.modelos.map(m=>({...m,ativo:m.id===id}))})),
  setConfig: (c)=> set(s=>({config:{...s.config,...c}})),
  setImpressaoAutomatica: (v)=> set({impressaoAutomatica:v}),
}),{ name:'print-id-storage', partialize:s=>({tema:s.tema, colunaChave:s.colunaChave, headers:s.headers, rows:s.rows, matrizMeta:s.matrizMeta, config:s.config, modelos:s.modelos, modeloAtivoId:s.modeloAtivoId, historico:s.historico, historicoSessao:s.historicoSessao, impressaoAutomatica:s.impressaoAutomatica })}))
