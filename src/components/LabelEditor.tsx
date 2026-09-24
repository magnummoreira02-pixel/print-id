import { useState } from 'react'
import type { LabelElement } from '../store/useStore'

export default function LabelEditor({modelo, headers, onClose, onSave}:{modelo:any, headers:string[], onClose:()=>void, onSave:(els:LabelElement[])=>void}){
  const [els, setEls] = useState<LabelElement[]>(modelo.elementos)
  const [sel, setSel] = useState<string|null>(els[0]?.id||null)
  const cur = els.find(e=>e.id===sel) || null

  function add(type:LabelElement['type']){
    const id=Date.now().toString()
    const base:LabelElement={id, type, x:2,y:2,w:type==='qrcode'?14:20,h:type==='qrcode'?14:4, field: headers[0]||'ID', fontSize:6}
    if(type==='rect') base.thickness=1
    setEls([...els, base]); setSel(id)
  }
  function patch(id:string, p:Partial<LabelElement>){ setEls(els.map(e=>e.id===id?{...e,...p}:e))}

  return (
    <div className="modal-overlay">
      <div className="modal editor-modal">
        <div className="modal-head"><h3>Editor visual – {modelo.nome}</h3><button onClick={onClose}>×</button></div>
        <div className="editor-grid">
          <div className="editor-toolbar">
            <button onClick={()=>add('text')}>+ Texto</button>
            <button onClick={()=>add('qrcode')}>+ QR</button>
            <button onClick={()=>add('code128')}>+ Code128</button>
            <button onClick={()=>add('code39')}>+ Code39</button>
            <button onClick={()=>add('rect')}>+ Retângulo</button>
            <button onClick={()=>add('line')}>+ Linha</button>
            <button disabled={!sel} onClick={()=>{
              if(!sel) return; const c=els.find(e=>e.id===sel); if(!c) return; const n={...c, id:Date.now().toString(), x:c.x+2, y:c.y+2}; setEls([...els,n])
            }}>Copiar</button>
            <button disabled={!sel} onClick={()=>setEls(els.filter(e=>e.id!==sel))}>Excluir</button>
          </div>
          <div className="editor-stage-wrap">
            <div className="editor-stage" style={{width:modelo.largura*8, height:modelo.altura*8}}>
              {els.map(el=>(
                <div key={el.id} onClick={()=>setSel(el.id)} className={`el ${sel===el.id?'sel':''}`} style={{left:el.x*8, top:el.y*8, width:el.w*8, height:el.h*8}}>
                  {el.type==='text' ? (el.field||'texto') : el.type}
                </div>
              ))}
              <div className="grid-bg"/>
            </div>
          </div>
          <div className="editor-props">
            {!cur ? <div className="muted">Selecione um elemento</div> : (
              <>
                <label>Tipo<b>{cur.type}</b></label>
                <label>Campo vinculado<select value={cur.field||''} onChange={e=>patch(cur.id,{field:e.target.value})}><option value="">(texto fixo)</option>{headers.map(h=> <option key={h} value={h}>{h}</option>)}<option value='"FIXO"'>"FIXO"</option></select></label>
                {cur.type==='text' && <><label>Texto fixo<input value={cur.text||''} onChange={e=>patch(cur.id,{text:e.target.value})}/></label><label>Tamanho<input type="number" value={cur.fontSize||6} onChange={e=>patch(cur.id,{fontSize:parseFloat(e.target.value)||6})}/></label><label><input type="checkbox" checked={!!cur.bold} onChange={e=>patch(cur.id,{bold:e.target.checked})}/> Negrito</label><label>Alinhamento<select value={cur.align||'left'} onChange={e=>patch(cur.id,{align:e.target.value as any})}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></>}
                <div className="grid2">
                  <label>X<input type="number" step="0.5" value={cur.x} onChange={e=>patch(cur.id,{x:parseFloat(e.target.value)||0})}/></label>
                  <label>Y<input type="number" step="0.5" value={cur.y} onChange={e=>patch(cur.id,{y:parseFloat(e.target.value)||0})}/></label>
                  <label>W<input type="number" step="0.5" value={cur.w} onChange={e=>patch(cur.id,{w:parseFloat(e.target.value)||0})}/></label>
                  <label>H<input type="number" step="0.5" value={cur.h} onChange={e=>patch(cur.id,{h:parseFloat(e.target.value)||0})}/></label>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="modal-foot"><button className="btn outline" onClick={onClose}>Cancelar</button><button className="btn lime" onClick={()=>onSave(els)}>Salvar</button></div>
      </div>
    </div>
  )
}
