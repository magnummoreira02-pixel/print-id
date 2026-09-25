import { useEffect, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva'
import QRCode from 'qrcode'
import type Konva from 'konva'
import type { LabelElement, LabelModel } from '../store/useStore'

type Props = {
  modelo: LabelModel
  headers: string[]
  rows?: Record<string, any>[]
  onClose: () => void
  onSave: (els: LabelElement[], patch?: Partial<LabelModel>) => void
  onTestPrint?: (els: LabelElement[], row: Record<string, any>, patch: Partial<LabelModel>) => void
}

const zoomOptions = [50, 75, 100, 150]
const toolTypes: { type: LabelElement['type']; label: string }[] = [
  { type: 'text', label: 'Texto fixo' }, { type: 'qrcode', label: 'QR Code' },
  { type: 'code128', label: 'Code 128' }, { type: 'code39', label: 'Code 39' },
  { type: 'datamatrix', label: 'Data Matrix' }, { type: 'ean13', label: 'EAN-13' },
  { type: 'rect', label: 'Retângulo' }, { type: 'line', label: 'Linha' }
]

function QrNode({ value, width, height }: { value: string; width: number; height: number }){
  const [image, setImage] = useState<HTMLImageElement|null>(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value || ' ', { margin: 0, errorCorrectionLevel: 'M' }).then(source => {
      const nextImage = new window.Image()
      nextImage.onload = () => { if(!cancelled) setImage(nextImage) }
      nextImage.src = source
    }).catch(() => setImage(null))
    return () => { cancelled = true }
  }, [value])
  if(!image) return <Text text="QR" width={width} height={height} align="center" verticalAlign="middle" fontSize={Math.max(10, height / 5)} fill="#111827" />
  return <KonvaImage image={image} width={width} height={height} />
}

export default function LabelEditor({ modelo, headers, rows = [], onClose, onSave, onTestPrint }: Props){
  const [els, setEls] = useState<LabelElement[]>(modelo.elementos.map(el => ({ ...el })))
  const [selected, setSelected] = useState<string[]>([])
  const [modelName, setModelName] = useState(modelo.nome)
  const [labelWidth, setLabelWidth] = useState(modelo.largura)
  const [labelHeight, setLabelHeight] = useState(modelo.altura)
  const [zoom, setZoom] = useState<number|'fit'>('fit')
  const [snap, setSnap] = useState(true)
  const [mode, setMode] = useState<'edit'|'preview'>('edit')
  const [rowIndex, setRowIndex] = useState(0)
  const [past, setPast] = useState<LabelElement[][]>([])
  const [future, setFuture] = useState<LabelElement[][]>([])
  const canvasAreaRef = useRef<HTMLElement>(null)
  const [fitScale, setFitScale] = useState(10)
  const shapeRefs = useRef<Record<string, Konva.Node>>({})
  const transformerRef = useRef<Konva.Transformer>(null)
  const availableHeaders = Array.from(new Set([...headers, ...rows.flatMap(row => Object.keys(row))]))
  const scale = fitScale * (zoom === 'fit' ? 1 : zoom / 100)
  const current = els.find(el => el.id === selected[0]) || null
  const previewRow = rows[rowIndex] || {}

  useEffect(() => {
    const element = canvasAreaRef.current
    if(!element) return
    const updateScale = () => {
      const availableWidth = Math.max(280, element.clientWidth - 92)
      const availableHeight = Math.max(220, element.clientHeight - 72)
      setFitScale(Math.max(4, Math.min(availableWidth / labelWidth, availableHeight / labelHeight)))
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(element)
    return () => observer.disconnect()
  }, [labelWidth, labelHeight])

  useEffect(() => {
    const node = selected.length === 1 ? shapeRefs.current[selected[0]] : undefined
    transformerRef.current?.nodes(node ? [node] : [])
    transformerRef.current?.getLayer()?.batchDraw()
  }, [selected, els])

  function snapValue(value: number){ return snap ? Math.round(value * 2) / 2 : value }
  function applyElements(next: LabelElement[]){
    setPast(previous => [...previous, els])
    setFuture([])
    setEls(next)
  }
  function patch(id: string, patchValue: Partial<LabelElement>){
    applyElements(els.map(el => el.id === id ? { ...el, ...patchValue } : el))
  }
  function add(type: LabelElement['type'], field?: string){
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const isCode = ['qrcode','code128','code39','datamatrix','ean13'].includes(type)
    const element: LabelElement = { id, type, x: 2, y: 2, w: isCode ? 14 : 24, h: isCode ? 14 : 5, field, text: type === 'text' && !field ? 'Texto fixo' : undefined, fontSize: 6, align: 'left' }
    if(type === 'rect' || type === 'line') element.thickness = 1
    applyElements([...els, element]); setSelected([id]); setMode('edit')
  }
  function duplicate(){
    const source = els.find(el => el.id === selected[0]); if(!source) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    applyElements([...els, { ...source, id, x: source.x + 2, y: source.y + 2 }]); setSelected([id])
  }
  function dropField(event: React.DragEvent<HTMLDivElement>){
    event.preventDefault(); const field = event.dataTransfer.getData('field'); const type = event.dataTransfer.getData('type') as LabelElement['type']
    if(field) add(type || 'text', field)
  }
  function handleTransformEnd(id: string){
    const node = shapeRefs.current[id]; if(!node) return
    const width = Math.max(2, node.width() * node.scaleX() / scale)
    const height = Math.max(2, node.height() * node.scaleY() / scale)
    node.scaleX(1); node.scaleY(1)
    patch(id, { x: snapValue(node.x() / scale), y: snapValue(node.y() / scale), w: snapValue(width), h: snapValue(height), rotation: Math.round(node.rotation()) })
  }
  function valueFor(el: LabelElement){
    if(el.field?.startsWith('"') && el.field.endsWith('"')) return el.field.slice(1, -1)
    return el.field ? String(previewRow[el.field] ?? '') : (el.text || el.type)
  }
  function renderObject(el: LabelElement){
    const fill = mode === 'preview' ? '#111827' : 'rgba(163,230,53,0.16)'
    const stroke = selected.includes(el.id) && mode === 'edit' ? '#a3e635' : '#334155'
    const common = { fill, stroke, strokeWidth: selected.includes(el.id) ? 2 : 1 }
    if(el.type === 'line') return <Rect {...common} width={el.w * scale} height={Math.max(1, el.thickness || 1) * scale} />
    if(el.type === 'qrcode') return <><Rect {...common} width={el.w * scale} height={el.h * scale} /><QrNode value={`${el.prefix || ''}${valueFor(el)}`} width={el.w * scale} height={el.h * scale} /></>
    if(['rect','qrcode','code128','code39','datamatrix','ean13'].includes(el.type)) return <><Rect {...common} width={el.w * scale} height={el.h * scale} /><Text text={el.type === 'rect' ? '' : `${el.type.toUpperCase()}\n${valueFor(el).slice(0, 12)}`} width={el.w * scale} height={el.h * scale} align="center" verticalAlign="middle" fontSize={Math.max(8, (el.fontSize || 6) * scale / 2)} fill={mode === 'preview' ? '#111827' : '#64748b'} /></>
    return <Text text={valueFor(el)} width={el.w * scale} height={el.h * scale} fontSize={(el.fontSize || 6) * scale / 2} fontFamily={el.fontFamily || 'Arial'} fontStyle={el.bold ? 'bold' : 'normal'} textDecoration={el.underline ? 'underline' : ''} align={el.align || 'left'} verticalAlign="middle" fill={mode === 'preview' ? '#111827' : '#0f172a'} padding={2} />
  }

  return <div className="modal-overlay">
    <div className="modal editor-modal visual-editor">
      <div className="editor-topbar"><button className="icon-btn" onClick={onClose} title="Voltar">←</button><label className="model-name">Modelo<input value={modelName} onChange={e => setModelName(e.target.value)} /></label><label className="editor-dimension">Etiqueta (mm)<div><input type="number" step="0.5" value={labelWidth} onChange={e => setLabelWidth(Number(e.target.value) || 1)} /><span>×</span><input type="number" step="0.5" value={labelHeight} onChange={e => setLabelHeight(Number(e.target.value) || 1)} /></div></label><div className="row gap editor-top-actions"><button className="icon-btn" disabled={!past.length} onClick={() => { const previous = past[past.length - 1]; setPast(past.slice(0, -1)); setFuture([els, ...future]); setEls(previous) }} title="Desfazer">↶</button><button className="icon-btn" disabled={!future.length} onClick={() => { const next = future[0]; setFuture(future.slice(1)); setPast([...past, els]); setEls(next) }} title="Refazer">↷</button><button className={mode === 'preview' ? 'btn lime small' : 'btn outline small'} onClick={() => setMode(mode === 'preview' ? 'edit' : 'preview')}>{mode === 'preview' ? 'Editar' : 'Visualizar'}</button><button className="btn outline small" disabled={!current || !rows.length} onClick={() => onTestPrint?.(els, previewRow, { nome: modelName, largura: labelWidth, altura: labelHeight })}>Testar registro</button><button className="btn outline small" onClick={onClose}>Descartar</button><button className="btn lime small" onClick={() => onSave(els, { nome: modelName, largura: labelWidth, altura: labelHeight })}>Salvar</button></div></div>
      <div className="editor-actions"><div className="row gap"><label className="editor-control">Zoom<select value={zoom} onChange={e => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}>{zoomOptions.map(value => <option key={value} value={value}>{value}%</option>)}<option value="fit">Ajustar à tela</option></select></label><label className="toggle"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} /> Snap</label></div><span className="muted">{labelWidth.toFixed(1)} × {labelHeight.toFixed(1)} mm • {els.length} elementos</span></div>
      <div className="editor-grid">
        <aside className="editor-sidebar editor-palette"><h4>CAMPOS DISPONÍVEIS</h4><div className="palette-section"><b>Campos da matriz</b>{availableHeaders.length === 0 && <span className="muted">Importe uma planilha em Dados</span>}{availableHeaders.map(field => <div key={field} className="palette-item field-item" draggable onDragStart={e => { e.dataTransfer.setData('field', field); e.dataTransfer.setData('type', 'text') }} onDoubleClick={() => add('text', field)}><span>{'{}'}</span>{field}</div>)}</div><div className="palette-section"><b>Objetos fixos e códigos</b><select className="add-object-select" value="" onChange={e => { if(e.target.value) add(e.target.value as LabelElement['type']) }}><option value="">+ Adicionar</option>{toolTypes.map(tool => <option key={tool.type} value={tool.type}>{tool.label}</option>)}</select></div><div className="palette-section element-list"><b>Elementos</b>{els.map(el => <button key={el.id} className={`element-list-item ${selected.includes(el.id) ? 'selected' : ''}`} onClick={() => setSelected([el.id])}><span>{el.field ? '{}' : 'T'}</span><span>{el.field || el.text || el.type}</span><small>{el.w.toFixed(1)} × {el.h.toFixed(1)}</small></button>)}</div><div className="palette-help muted">Arraste um campo para o canvas ou selecione um elemento já colocado.</div></aside>
        <section ref={canvasAreaRef} className="editor-stage-wrap" onDragOver={e => e.preventDefault()} onDrop={dropField}><div className="editor-ruler ruler-top">{Array.from({ length: Math.ceil(labelWidth / 5) + 1 }, (_, i) => <span key={i} style={{ left: i * 5 * scale }}>{i * 5}</span>)}</div><div className="editor-ruler ruler-left">{Array.from({ length: Math.ceil(labelHeight / 5) + 1 }, (_, i) => <span key={i} style={{ top: i * 5 * scale }}>{i * 5}</span>)}</div><Stage width={labelWidth * scale} height={labelHeight * scale} onMouseDown={event => { if(event.target === event.target.getStage()) setSelected([]) }}><Layer><Rect width={labelWidth * scale} height={labelHeight * scale} fill="#fff" stroke="#111" strokeWidth={1} />{els.filter(el => !el.hidden).map(el => <Group key={el.id} ref={node => { if(node) shapeRefs.current[el.id] = node }} x={el.x * scale} y={el.y * scale} width={el.w * scale} height={el.h * scale} rotation={el.rotation || 0} draggable={mode === 'edit' && !el.locked} onClick={event => { event.cancelBubble = true; setSelected(event.evt.shiftKey ? [...new Set([...selected, el.id])] : [el.id]) }} onDragEnd={event => patch(el.id, { x: snapValue(event.target.x() / scale), y: snapValue(event.target.y() / scale) })} onTransformEnd={() => handleTransformEnd(el.id)}>{renderObject(el)}</Group>)}{mode === 'edit' && <Transformer ref={transformerRef} rotateEnabled enabledAnchors={['top-left','top-right','bottom-left','bottom-right']} boundBoxFunc={(oldBox, newBox) => newBox.width < 8 || newBox.height < 8 ? oldBox : newBox} />}</Layer></Stage></section>
        <aside className="editor-sidebar editor-props"><div className="props-head"><h4>PROPRIEDADES</h4>{current && <div className="row gap"><button className="icon-btn" onClick={duplicate} title="Duplicar">⧉</button><button className="icon-btn red" onClick={() => applyElements(els.filter(el => !selected.includes(el.id)))} title="Excluir">×</button></div>}</div>{!current ? <div className="muted">Selecione um elemento</div> : <><div className="type-badge">{current.type.toUpperCase()}</div><label className="property-toggle"><span>Exibir</span><input type="checkbox" checked={!current.hidden} onChange={e => patch(current.id, { hidden: !e.target.checked })} /></label><div className="property-section"><b>Posição (mm)</b><div className="grid2"><label>X<input type="number" step="0.5" value={current.x} onChange={e => patch(current.id, { x: Number(e.target.value) || 0 })} /></label><label>Y<input type="number" step="0.5" value={current.y} onChange={e => patch(current.id, { y: Number(e.target.value) || 0 })} /></label></div></div><div className="property-section"><b>Tamanho (mm)</b><div className="grid2"><label>Largura<input type="number" step="0.5" value={current.w} onChange={e => patch(current.id, { w: Number(e.target.value) || 1 })} /></label><label>Altura<input type="number" step="0.5" value={current.h} onChange={e => patch(current.id, { h: Number(e.target.value) || 1 })} /></label></div></div><div className="property-section"><b>Conteúdo</b><small className="muted">Vazio = usa a coluna do ID</small><select value={current.field || ''} onChange={e => patch(current.id, { field: e.target.value || undefined })}><option value="">Texto fixo</option>{availableHeaders.map(field => <option key={field} value={field}>{field}</option>)}</select>{current.type === 'text' && <input value={current.text || ''} placeholder="Texto fixo" onChange={e => patch(current.id, { text: e.target.value })} />}</div>{current.type === 'text' && <><label>Fonte<select value={current.fontFamily || 'Arial'} onChange={e => patch(current.id, { fontFamily: e.target.value })}><option>Arial</option><option>Courier New</option><option>Times New Roman</option></select></label><label>Tamanho<input type="number" min={1} value={current.fontSize || 6} onChange={e => patch(current.id, { fontSize: Number(e.target.value) || 1 })} /></label><div className="property-checks"><label><input type="checkbox" checked={!!current.bold} onChange={e => patch(current.id, { bold: e.target.checked })} /> Negrito</label><label><input type="checkbox" checked={!!current.italic} onChange={e => patch(current.id, { italic: e.target.checked })} /> Itálico</label><label><input type="checkbox" checked={!!current.underline} onChange={e => patch(current.id, { underline: e.target.checked })} /> Sublinhado</label></div></>}<label>Rotação<input type="number" step="90" value={current.rotation || 0} onChange={e => patch(current.id, { rotation: Number(e.target.value) || 0 })} /></label><label className="property-toggle"><span>Bloquear</span><input type="checkbox" checked={!!current.locked} onChange={e => patch(current.id, { locked: e.target.checked })} /></label></>}</aside>
      </div>
      {current?.type === 'qrcode' && <div className="qr-prefix-bar"><b>Prefixo do QR Code</b><input value={current.prefix || ''} placeholder="Ex.: https://exemplo.com/" onChange={e => patch(current.id, { prefix: e.target.value })} /><span className="muted">Será concatenado antes do valor do campo.</span></div>}
      <div className="editor-record"><span>Prévia com dados reais</span><select value={rowIndex} onChange={e => setRowIndex(Number(e.target.value))} disabled={!rows.length}><option value={0}>{rows.length ? 'Registro 1' : 'Nenhum registro importado'}</option>{rows.slice(1).map((row, index) => <option key={index + 1} value={index + 1}>Registro {index + 2} • {String(row[headers[0]] ?? '')}</option>)}</select>{rows.length > 0 && <span className="mono">{String(previewRow[headers[0]] ?? '')}</span>}</div>
      <div className="modal-foot"><button className="btn outline" onClick={onClose}>Cancelar</button><button className="btn lime" onClick={() => onSave(els, { nome: modelName, largura: labelWidth, altura: labelHeight })}>Salvar layout</button></div>
    </div>
  </div>
}
