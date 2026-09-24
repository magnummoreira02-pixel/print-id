import { useEffect, useRef, useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { cleanScan, normalize, beep } from '../utils/helpers'
import { buildZPL } from '../utils/zpl'
import { printZPL } from '../services/printer'

export default function Bipagem(){
  const { rows, headers, colunaChave, impressaoAutomatica, setImpressaoAutomatica, modelos, modeloAtivoId, config, addHistory, historicoSessao, clearSessao } = useStore()
  const modelo = modelos.find(m=>m.id===modeloAtivoId) || modelos[0]
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [lastResult, setLastResult] = useState<{encontrado:boolean, linhas:Record<string,any>[], codigo:string, status:string} | null>(null)
  const [isOtherFocused, setIsOtherFocused] = useState(false)

  // contadores
  const stats = useMemo(()=>{
    const encontrados = historicoSessao.filter(h=>h.encontrado).length
    const nao = historicoSessao.filter(h=>!h.encontrado).length
    const etiquetas = historicoSessao.reduce((a,b)=>a+b.qtdEtiquetas,0)
    return { bips: historicoSessao.length, encontrados, nao, etiquetas }
  },[historicoSessao])

  // auto-focus
  useEffect(()=>{
    const interval = setInterval(()=>{
      if(!isOtherFocused && inputRef.current && document.activeElement!==inputRef.current){
        inputRef.current.focus()
      }
    },800)
    return ()=>clearInterval(interval)
  },[isOtherFocused])

  useEffect(()=>{
    inputRef.current?.focus()
    const onFocusIn = ()=> {
      const el = document.activeElement as HTMLElement
      setIsOtherFocused(el!==inputRef.current && el?.tagName!=='BODY' && !!el?.closest('input,textarea,select'))
    }
    document.addEventListener('focusin', onFocusIn)
    return ()=>document.removeEventListener('focusin', onFocusIn)
  },[])

  // índice em memória para <50ms (Map)
  const index = useMemo(()=>{
    const map = new Map<string, Record<string,any>[]>()
    if(!colunaChave) return map
    for(const r of rows){
      const k = normalize(r[colunaChave])
      if(!k) continue
      if(!map.has(k)) map.set(k,[])
      map.get(k)!.push(r)
    }
    return map
  },[rows, colunaChave])

  async function handleSubmit(raw:string){
    const cleaned = cleanScan(raw, config.prefixoRemover, config.sufixoRemover)
    if(!cleaned){
      setCode(''); inputRef.current?.focus(); return
    }
    if(!colunaChave){
      alert('Defina a coluna-chave em CONFIGURAÇÕES > Bipagem')
      return
    }
    const matches = index.get(config.ignoreCase? normalize(cleaned): cleaned.trim()) || []
    // fallback case-insensitive exact if ignoreCase false? already handled
    const encontrado = matches.length>0
    beep(encontrado)

    let status: 'IMPRESSO'|'NAO_ENCONTRADO'|'ERRO' = encontrado?'IMPRESSO':'NAO_ENCONTRADO'
    let qtdEtiquetas = 0
    let erroMsg = ''
    if(encontrado && impressaoAutomatica){
      try{
        const zpl = buildZPL(modelo, matches, config.dpi, {offsetX:config.offsetX, offsetY:config.offsetY, velocidade:config.velocidade, densidade:config.densidade})
        await printZPL(zpl, config.impressora, {ip:config.ip, port:config.porta, conexao:config.conexao})
        qtdEtiquetas = matches.length * (modelo.copiasPorLinha||1)
      }catch(e:any){
        status='ERRO'; erroMsg=String(e?.message||e)
      }
    } else if(encontrado){
      qtdEtiquetas = 0
    }

    const entry = {
      id: Date.now().toString()+Math.random().toString(36).slice(2,6),
      ts: new Date().toISOString(),
      codigo: cleaned,
      colunaChave,
      encontrado,
      qtdLinhas: matches.length,
      qtdEtiquetas,
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      impressora: config.impressora,
      statusImpressao: status as any,
      linhas: matches,
      erro: erroMsg
    }
    addHistory(entry)
    setLastResult({encontrado, linhas:matches, codigo:cleaned, status})
    setCode('')
    setTimeout(()=>inputRef.current?.focus(),10)
  }

  async function reprint(lines:Record<string,any>[]){
    if(!lines.length) return
    const zpl = buildZPL(modelo, lines, config.dpi, {offsetX:config.offsetX, offsetY:config.offsetY, velocidade:config.velocidade, densidade:config.densidade})
    try{ await printZPL(zpl, config.impressora, {ip:config.ip, port:config.porta, conexao:config.conexao}); beep(true)}catch{beep(false)}
  }

  return (
    <div className="page bipagem">
      <header className="page-header">
        <h2>BIPAGEM</h2>
        <div className="header-meta">
          <span className="pill">COLUNA DE BIPAGEM: <b>{colunaChave||'—'}</b></span>
          <label className="toggle">
            <input type="checkbox" checked={impressaoAutomatica} onChange={e=>setImpressaoAutomatica(e.target.checked)} />
            <span className="slider"/> IMPRESSÃO AUTOMÁTICA
          </label>
        </div>
      </header>

      <div className="bipagem-grid">
        <div className="bipagem-main">
          <div className="scan-box">
            <label>CÓDIGO DO ITEM – {colunaChave||'ID'}</label>
            <div className="scan-input-wrap">
              <input
                ref={inputRef}
                value={code}
                onChange={e=>setCode(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); handleSubmit(code)} }}
                placeholder="Aguardando bip..."
                autoFocus
              />
              <span className="scan-corners tl"/><span className="scan-corners tr"/><span className="scan-corners bl"/><span className="scan-corners br"/>
            </div>
            <small>Leitor HID termina com Enter • Foco automático</small>
          </div>

          <div className="result-area">
            {!lastResult ? (
              <div className="empty-state">AGUARDANDO LEITURA</div>
            ) : lastResult.encontrado ? (
              <div className="card success">
                <div className="card-header">
                  <span className="badge ok">IMPRESSO</span>
                  <span className="mono">{lastResult.codigo}</span>
                  <span>{lastResult.linhas.length} linha(s) • {modelo.copiasPorLinha} cópia(s)</span>
                  <button className="btn lime" onClick={()=>reprint(lastResult.linhas)}>Reimprimir</button>
                </div>
                <div className="lines">
                  {lastResult.linhas.map((r,i)=>(
                    <div key={i} className="line-card">
                      {headers.map(h=>(
                        <div key={h} className="field"><span>{h}</span><b>{String(r[h]??'')}</b></div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card error">
                <div className="big-red">NÃO ENCONTRADO</div>
                <div className="mono">{lastResult.codigo}</div>
                <p>Código não existe na coluna <b>{colunaChave}</b></p>
              </div>
            )}
          </div>
        </div>

        <aside className="history-panel">
          <div className="history-head">
            <h3>HISTÓRICO DA SESSÃO</h3>
            <button className="icon-btn" onClick={clearSessao} title="Limpar visualização">🗑</button>
          </div>
          <div className="counters">
            <div><span>BIPS</span><b>{stats.bips}</b></div>
            <div className="lime"><span>ENCONTRADOS</span><b>{stats.encontrados}</b></div>
            <div className="red"><span>NÃO ENCONTRADOS</span><b>{stats.nao}</b></div>
            <div><span>ETIQUETAS</span><b>{stats.etiquetas}</b></div>
          </div>
          <div className="history-list">
            {historicoSessao.length===0 && <div className="muted">Nenhum bip nesta sessão</div>}
            {historicoSessao.map(h=>(
              <div key={h.id} className={`h-item ${h.encontrado?'ok':'err'}`} onClick={()=>h.linhas && h.linhas.length && reprint(h.linhas)}>
                <div className="h-top"><span className="mono">{h.codigo}</span><span>{new Date(h.ts).toLocaleTimeString('pt-BR')}</span></div>
                <div className="h-bottom"><span>{h.encontrado? `${h.qtdLinhas} linha(s) • ${h.qtdEtiquetas} etq` : 'NÃO ENCONTRADO'}</span><span className="status">{h.statusImpressao}</span></div>
              </div>
            ))}
          </div>
          <button className="btn-outline full" onClick={()=>{
            const { historico } = useStore.getState()
            if(!historico.length) return alert('Sem histórico')
            // export csv
            const csv = ['codigo,coluna,encontrado,qtdLinhas,qtdEtiquetas,modelo,impressora,status,data'].concat(historico.map(h=>[h.codigo,h.colunaChave,h.encontrado,h.qtdLinhas,h.qtdEtiquetas,h.modeloNome,h.impressora,h.statusImpressao,h.ts].join(','))).join('\n')
            const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='historico_print_id.csv'; a.click()
          }}>Exportar histórico</button>
        </aside>
      </div>
    </div>
  )
}
