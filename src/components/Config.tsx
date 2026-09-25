import { useState } from 'react'
import { useEffect } from 'react'
import QRCode from 'qrcode'
import { useStore, LabelModel } from '../store/useStore'
import { pageSizeCalc, buildZPL } from '../utils/zpl'
import { listPrinters, printZPL } from '../services/printer'
import LabelEditor from './LabelEditor'

export default function Config(){
  const { headers, rows, colunaChave, setColunaChave, modelos, modeloAtivoId, setModeloAtivo, setModelos, config, setConfig, impressaoAutomatica, setImpressaoAutomatica } = useStore()
  const modelo = modelos.find(m=>m.id===modeloAtivoId) || modelos[0]
  const [editingModel, setEditingModel] = useState<LabelModel|null>(null)
  const [printers, setPrinters] = useState<string[]>([])
  const [zplPreview, setZplPreview] = useState('')
  const [showZPL, setShowZPL] = useState(false)

  function updateModelo(patch: Partial<LabelModel>){
    setModelos(modelos.map(m=> m.id===modelo.id? {...m, ...patch}:m))
  }

  const calc = pageSizeCalc(modelo)

  async function detect(){
    const list=await listPrinters()
    setPrinters(list)
    if(list.length && !config.impressora) setConfig({impressora:list.find(p=>/zebra|zdesigner/i.test(p))||list[0]})
  }

  async function testConnection(){
    const list = await listPrinters()
    if(!config.impressora) return alert('Selecione uma impressora.')
    if(list.includes(config.impressora)) alert(`Impressora encontrada no spooler: ${config.impressora}`)
    else alert('A impressora selecionada não está disponível no spooler do Windows. Clique em "Detectar impressoras".')
  }

  function genZPL(){
    const exampleRow:Record<string,any>={}; headers.forEach(h=> exampleRow[h]='EXEMPLO'); if(headers.length===0) exampleRow['ID']='12345'
    if(headers.includes('ID')) exampleRow['ID']='RM-001'
    const z=buildZPL(modelo, [exampleRow], config.dpi, {offsetX:config.offsetX, offsetY:config.offsetY, velocidade:config.velocidade, densidade:config.densidade})
    setZplPreview(z); setShowZPL(true)
    return z
  }

  async function testDraft(draftModel: LabelModel, elements: LabelModel['elementos'], row: Record<string, any>, patch: Partial<LabelModel> = {}){
    const draft = {...draftModel, ...patch, elementos: elements}
    const z = buildZPL(draft, [row], config.dpi, {offsetX:config.offsetX, offsetY:config.offsetY, velocidade:config.velocidade, densidade:config.densidade})
    try{ await printZPL(z, config.impressora, {ip:config.ip, port:config.porta, conexao:config.conexao}); alert('Etiqueta do registro enviada!') }catch(e:any){ alert('Erro: '+e.message) }
  }

  async function testPrint(){
    const z=genZPL()
    try{ await printZPL(z, config.impressora, {ip:config.ip, port:config.porta, conexao:config.conexao}); alert('Etiqueta de teste enviada!')}catch(e:any){ alert('Erro: '+e.message)}
  }

  return (
    <div className="page config">
      <div className="config-grid">
        <div className="config-left">
          <section className="card">
            <h3>MODELOS DE ETIQUETA</h3>
            <p className="muted">O modelo ativo é usado na bipagem, no teste e na prévia.</p>
            <div className="model-list">
              {modelos.map(m=>(
                <div key={m.id} className={`model-item ${m.id===modeloAtivoId?'active':''}`} onClick={()=>setModeloAtivo(m.id)}>
                  <div className="radio">{m.id===modeloAtivoId?'●':'○'}</div>
                  <div><b>{m.nome}</b><small>{m.largura} × {m.altura} mm • {m.elementos.length} elementos</small></div>
                  {m.id===modeloAtivoId && <span className="badge lime">ATIVO</span>}
                  <div className="model-actions">
                    <button onClick={(e)=>{e.stopPropagation(); setEditingModel(m)}} title="Editar">✎</button>
                    <button onClick={(e)=>{e.stopPropagation(); const n={...m, id:Date.now().toString(), nome:m.nome+' (cópia)', ativo:false}; setModelos([...modelos,n])}} title="Duplicar">⎘</button>
                    <button onClick={(e)=>{e.stopPropagation(); const blob=new Blob([JSON.stringify(m,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=m.nome+'.json'; a.click()}} title="Exportar">⤓</button>
                    <button onClick={(e)=>{e.stopPropagation(); if(modelos.length===1) return alert('Mantenha ao menos 1 modelo'); if(confirm('Excluir?')) setModelos(modelos.filter(x=>x.id!==m.id))}} title="Excluir">×</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="row gap">
              <button className="btn lime" onClick={()=>{
                const id=Date.now().toString()
                const novo:LabelModel={ id, nome:'Novo modelo', largura:45.5, altura:18, linhas:1, colunas:1, margemTop:1,margemLeft:1,margemBottom:1,margemRight:1,gapH:2,gapV:2,copiasPorLinha:1,definirManual:false, elementos:[]}
                setModelos([...modelos,novo]); setModeloAtivo(id)
              }}>+ Novo modelo</button>
              <label className="btn outline">Importar modelo<input type="file" hidden accept=".json" onChange={async e=>{
                const f=e.target.files?.[0]; if(!f) return
                const j=JSON.parse(await f.text()); j.id=Date.now().toString(); setModelos([...modelos,j]); setModeloAtivo(j.id)
              }}/></label>
            </div>
          </section>

          <section className="card">
            <h3>ETIQUETA – CONFIGURAR PÁGINA</h3>
            <div className="grid2">
              <label>LARGURA (mm)<div className="num"><button onClick={()=>updateModelo({largura: +(modelo.largura-0.5).toFixed(1)})}>−</button><input type="number" step="0.5" value={modelo.largura} onChange={e=>updateModelo({largura: parseFloat(e.target.value)||0})}/><button onClick={()=>updateModelo({largura: +(modelo.largura+0.5).toFixed(1)})}>+</button></div></label>
              <label>ALTURA (mm)<div className="num"><button onClick={()=>updateModelo({altura: +(modelo.altura-0.5).toFixed(1)})}>−</button><input type="number" step="0.5" value={modelo.altura} onChange={e=>updateModelo({altura: parseFloat(e.target.value)||0})}/><button onClick={()=>updateModelo({altura: +(modelo.altura+0.5).toFixed(1)})}>+</button></div></label>
              <label>LINHAS<input type="number" min={1} value={modelo.linhas} onChange={e=>updateModelo({linhas: parseInt(e.target.value)||1})}/></label>
              <label>COLUNAS<select value={modelo.colunas} onChange={e=>updateModelo({colunas: parseInt(e.target.value)})}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label>
              <label>Margem top<input type="number" step="0.5" value={modelo.margemTop} onChange={e=>updateModelo({margemTop: parseFloat(e.target.value)||0})}/></label>
              <label>Margem left<input type="number" step="0.5" value={modelo.margemLeft} onChange={e=>updateModelo({margemLeft: parseFloat(e.target.value)||0})}/></label>
              <label>Margem bottom<input type="number" step="0.5" value={modelo.margemBottom} onChange={e=>updateModelo({margemBottom: parseFloat(e.target.value)||0})}/></label>
              <label>Margem right<input type="number" step="0.5" value={modelo.margemRight} onChange={e=>updateModelo({margemRight: parseFloat(e.target.value)||0})}/></label>
              <label>Gap H<input type="number" step="0.5" value={modelo.gapH} onChange={e=>updateModelo({gapH: parseFloat(e.target.value)||0})}/></label>
              <label>Gap V<input type="number" step="0.5" value={modelo.gapV} onChange={e=>updateModelo({gapV: parseFloat(e.target.value)||0})}/></label>
            </div>
            <label className="toggle"><input type="checkbox" checked={modelo.definirManual} onChange={e=>updateModelo({definirManual:e.target.checked})}/> Definir manualmente</label>
            <label>CÓPIAS POR LINHA<input type="number" min={1} value={modelo.copiasPorLinha} onChange={e=>updateModelo({copiasPorLinha: parseInt(e.target.value)||1})}/></label>
            <div className="calc">Formato de página: <b>{calc.w.toFixed(1)} × {calc.h.toFixed(1)} mm</b> • Modelo: {modelo.largura} × {modelo.altura} mm</div>
            <div className="row gap">
              <input placeholder="Renomear modelo" value={modelo.nome} onChange={e=>updateModelo({nome:e.target.value})} style={{flex:1}}/>
              <button className="btn outline" onClick={()=>setEditingModel(modelo)}>Editar layout</button>
            </div>
          </section>

          <section className="card">
            <h3>IMPRESSORA ZEBRA</h3>
            <button className="btn lime" onClick={detect}>Detectar impressoras</button>
            {printers.length>0 && <div className="printer-list">{printers.map(p=>(
              <div key={p} className={`printer ${config.impressora===p?'active':''} ${/zebra|zdesigner/i.test(p)?'zebra':''}`} onClick={()=>setConfig({impressora:p})}>{p} {/zebra|zdesigner/i.test(p) && <span className="badge lime">ZEBRA</span>}</div>
            ))}</div>}
            <div className="grid2">
              <label>Perfil<select value={config.dpi} onChange={e=>setConfig({dpi: parseInt(e.target.value) as any})}><option value={203}>ZT411 / ZT410 203 dpi</option><option value={300}>ZT411 / ZT410 300 dpi</option><option value={600}>ZT411 600 dpi</option><option value={203}>ZD220 203 dpi (56 mm)</option></select></label>
              <label>Conexão<select value={config.conexao} onChange={e=>setConfig({conexao:e.target.value as any})}><option value="spooler">Spooler Windows (RAW)</option><option value="tcp">TCP/IP 9100</option><option value="usb">USB direto</option></select></label>
              {config.conexao==='tcp' && <><label>IP<input value={config.ip||''} onChange={e=>setConfig({ip:e.target.value})} placeholder="192.168.1.100"/></label><label>Porta<input type="number" value={config.porta||9100} onChange={e=>setConfig({porta:parseInt(e.target.value)||9100})}/></label></>}
              <label>DPI<input type="number" value={config.dpi} onChange={e=>setConfig({dpi: parseInt(e.target.value) as any})}/></label>
              <label>Velocidade ^PR<input type="number" value={config.velocidade} onChange={e=>setConfig({velocidade:parseInt(e.target.value)||4})}/></label>
              <label>Densidade ~SD<input type="number" value={config.densidade} onChange={e=>setConfig({densidade:parseInt(e.target.value)||12})}/></label>
              <label>Modo térmico<select value={config.modoTermico} onChange={e=>setConfig({modoTermico:e.target.value as any})}><option value="transferencia">Transferência térmica</option><option value="direta">Térmica direta</option></select></label>
              <label>Tipo mídia<select value={config.tipoMidia} onChange={e=>setConfig({tipoMidia:e.target.value as any})}><option value="gap">Gap</option><option value="marca-preta">Marca preta</option><option value="continua">Contínua</option></select></label>
              <label>Offset X mm<input type="number" step="0.5" value={config.offsetX} onChange={e=>setConfig({offsetX:parseFloat(e.target.value)||0})}/></label>
              <label>Offset Y mm<input type="number" step="0.5" value={config.offsetY} onChange={e=>setConfig({offsetY:parseFloat(e.target.value)||0})}/></label>
            </div>
            <div className="row gap">
              <button className="btn outline" onClick={testConnection}>Testar conexão</button>
              <button className="btn lime" onClick={testPrint}>Imprimir etiqueta de teste</button>
              <button className="btn outline" onClick={()=>alert('Comando ~JC enviado (calibrar mídia)')}>Calibrar mídia (~JC)</button>
            </div>
            <div className="row gap">
              <button className="btn small" onClick={genZPL}>Ver ZPL gerado</button>
              {zplPreview && <button className="btn small" onClick={()=>navigator.clipboard.writeText(zplPreview)}>Copiar ZPL</button>}
            </div>
            {showZPL && <pre className="zpl-box">{zplPreview}</pre>}
          </section>

          <section className="card">
            <h3>BIPAGEM</h3>
            <label>COLUNA-CHAVE DO BIP<select value={colunaChave} onChange={e=>setColunaChave(e.target.value)}>{headers.length===0 && <option value="">— importe planilha —</option>}{headers.map(h=> <option key={h} value={h}>{h}</option>)}</select></label>
            <small className="muted">Coluna comparada com o código lido pelo leitor. Um mesmo valor pode retornar várias linhas (uma por LOCAL).</small>
            <div className="grid2">
              <label>Prefixo a remover<input value={config.prefixoRemover} onChange={e=>setConfig({prefixoRemover:e.target.value})} placeholder="ex: ID:"/></label>
              <label>Sufixo a remover<input value={config.sufixoRemover} onChange={e=>setConfig({sufixoRemover:e.target.value})}/></label>
            </div>
            <label className="toggle"><input type="checkbox" checked={config.ignoreCase} onChange={e=>setConfig({ignoreCase:e.target.checked})}/> Ignorar maiúsculas/minúsculas</label>
            <label className="toggle"><input type="checkbox" checked={impressaoAutomatica} onChange={e=>setImpressaoAutomatica(e.target.checked)}/> Impressão automática</label>
            <label className="toggle"><input type="checkbox" checked={config.repeticaoUltima} onChange={e=>setConfig({repeticaoUltima:e.target.checked})}/> Repetir última etiqueta se quantidade ímpar</label>
          </section>

          <section className="card danger">
            <h3>ZONA DE PERIGO</h3>
            <button className="btn danger" onClick={()=>{
              if(confirm('Resetar aplicativo? Isso apaga matriz, modelos e configurações.')){ if(confirm('Confirme novamente para apagar tudo')){ localStorage.clear(); location.reload() }}
            }}>Resetar aplicativo</button>
            <button className="btn danger outline" onClick={()=>{
              if(confirm('Desinstalar app?')) alert('Use Painel de Controle > Programas > Desinstalar "Print ID – Etiquetas" ou execute o Uninstaller em %APPDATA%')
            }}>Desinstalar</button>
          </section>

          <section className="card">
            <h3>SISTEMA</h3>
            <div className="sys"><span>Versão</span><b>v0.1.0</b></div>
            <div className="sys"><span>Armazenamento</span><b>SQLITE (localStorage ativo) – %APPDATA%\print-id</b></div>
            <div className="sys"><span>Desenvolvido por</span><b>Magnum Moreira</b></div>
          </section>
        </div>

        <div className="config-right">
          <div className="preview-card">
            <div className="preview-head">
              <h3>PRÉVIA</h3>
              <span>{modelo.largura} × {modelo.altura} mm • {calc.w.toFixed(1)} × {calc.h.toFixed(1)} mm • {config.dpi} dpi</span>
              <button className="btn small" onClick={genZPL}>↻ Atualizar</button>
            </div>
            <div className="preview-stage">
              <PreviewEtiqueta modelo={modelo} headers={headers} row={rows[0]}/>
            </div>
            <button className="btn lime full" onClick={testPrint}>Testar impressão</button>
          </div>
        </div>
      </div>

      {editingModel && <LabelEditor modelo={editingModel} headers={Array.from(new Set([...headers, ...rows.flatMap(row=>Object.keys(row))]))} rows={rows} onClose={()=>setEditingModel(null)} onSave={(els,patch)=>{ setModelos(modelos.map(m=>m.id===editingModel.id?{...m, ...patch, elementos:els}:m)); setEditingModel(null) }} onTestPrint={(els,row,patch)=>testDraft(editingModel,els,row,patch)}/>} 
    </div>
  )
}

function PreviewEtiqueta({modelo, headers, row}:{modelo:LabelModel, headers:string[], row?:Record<string,any>}){
  const example:Record<string,any>={...row}
  headers.forEach(h=> example[h]=h==='ID'?'RM-12345': h.slice(0,8))
  if(!headers.length) example['ID']='RM-001'
  // render escala: 4px por mm
  const scale=4
  return (
    <div style={{display:'flex', gap:modelo.gapH*scale, background:'#fff', padding:modelo.margemLeft*scale, border:'1px dashed #ccc'}}>
      {Array.from({length:modelo.colunas}).map((_,ci)=>(
        <div key={ci} style={{position:'relative', width:modelo.largura*scale, height:modelo.altura*scale, border:'1px solid #000', background:'#fff', overflow:'hidden'}}>
          {modelo.elementos.map(el=>{
            const val = el.field?.startsWith('"')? el.field.slice(1,-1) : (example[el.field||''] ?? el.text ?? el.field ?? '')
            const style:any={ position:'absolute', left:el.x*scale, top:el.y*scale, width:el.w*scale, height:el.h*scale, fontSize:(el.fontSize||6)*1.2, fontWeight:el.bold?'700':'400', textAlign:el.align||'left', border: el.type==='rect'? `${el.thickness||1}px solid #000` : undefined, overflow:'hidden', display:'flex', alignItems:'center', justifyContent: el.align==='center'?'center': el.align==='right'?'flex-end':'flex-start', wordBreak:'break-all' as const }
            if(el.type==='qrcode') return <QrPreview key={el.id} value={`${el.prefix||''}${String(val)}`} style={style}/>
            if(el.type==='rect' || el.type==='line') return <div key={el.id} style={style}/>
            return <div key={el.id} style={style}>{String(val)}</div>
          })}
        </div>
      ))}
    </div>
  )
}

function QrPreview({value, style}:{value:string, style:React.CSSProperties}){
  const [src, setSrc] = useState('')
  useEffect(()=>{ QRCode.toDataURL(value || ' ', {margin:0, errorCorrectionLevel:'M'}).then(setSrc).catch(()=>setSrc('')) },[value])
  return src ? <img src={src} alt="QR Code" style={{...style, objectFit:'contain'}}/> : <div style={style}>QR</div>
}
